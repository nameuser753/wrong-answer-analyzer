import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
loadLocalEnv();

const port = Number(process.env.PORT || 4173);
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/analyze") {
      await handleAnalysis(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "지원하지 않는 요청입니다." });
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message || "서버에서 예상하지 못한 문제가 발생했습니다." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`오답 탐정 실행 중: http://127.0.0.1:${port}`);
});

async function handleAnalysis(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: "OpenAI API 키가 설정되지 않았습니다. README의 설정 방법을 확인해 주세요.",
    });
    return;
  }

  const body = await readJsonBody(request, 7 * 1024 * 1024);
  const requiredFields = ["subject", "unit", "problemType", "userAnswer", "correctAnswer", "situation"];
  if (requiredFields.some((key) => typeof body[key] !== "string" || !body[key].trim())) {
    sendJson(response, 400, { error: "필수 입력 항목을 모두 작성해 주세요." });
    return;
  }

  const content = [
    {
      type: "input_text",
      text: [
        `과목: ${clean(body.subject, 40)}`,
        `단원: ${clean(body.unit, 100)}`,
        `문제 유형: ${clean(body.problemType, 100)}`,
        `학생의 답과 풀이: ${clean(body.userAnswer, 1500)}`,
        `정답: ${clean(body.correctAnswer, 1000)}`,
        `학생이 선택한 상황: ${clean(body.situation, 100)}`,
        "위 정보를 분석하고, 데이터베이스에서 같은 약점을 보완할 문제를 찾기 위한 핵심 검색어를 제시해 주세요.",
      ].join("\n"),
    },
  ];

  if (typeof body.imageDataUrl === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(body.imageDataUrl)) {
    content.push({ type: "input_image", image_url: body.imageDataUrl, detail: "auto" });
  }

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      instructions: "당신은 한국 중·고등학생의 오답을 분석하는 학습 코치입니다. 학생의 답과 정답을 비교하되 정보가 부족하면 단정하지 마세요. 문제 이미지가 있으면 이미지의 문제 내용과 풀이도 확인하세요. 설명은 정확하고 친절한 한국어로 작성하세요. 문제를 새로 만들지 말고, 별도의 공개 문제 데이터베이스를 검색하는 데 사용할 짧고 구체적인 한국어 핵심어를 제시하세요.",
      input: [{ role: "user", content }],
      max_output_tokens: 2500,
      text: {
        format: {
          type: "json_schema",
          name: "wrong_answer_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              cause: { type: "string" },
              confidence: { type: "string", enum: ["높은 가능성", "보통 가능성", "추가 확인 필요"] },
              reason: { type: "string" },
              concept: { type: "string" },
              action: { type: "string" },
              recommendationReason: { type: "string" },
              recommendationKeywords: {
                type: "array",
                minItems: 2,
                maxItems: 6,
                items: { type: "string" },
              },
            },
            required: ["cause", "confidence", "reason", "concept", "action", "recommendationReason", "recommendationKeywords"],
          },
        },
      },
    }),
  });

  const result = await apiResponse.json();
  if (!apiResponse.ok) {
    console.error("OpenAI API error:", result.error?.message || result);
    const message = apiResponse.status === 401
      ? "OpenAI API 키가 올바르지 않습니다."
      : apiResponse.status === 429
        ? "API 사용 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요."
        : "GPT 분석 요청을 완료하지 못했습니다.";
    sendJson(response, apiResponse.status, { error: message });
    return;
  }

  const outputText = result.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;

  if (!outputText) {
    sendJson(response, 502, { error: "GPT가 분석 결과를 반환하지 않았습니다." });
    return;
  }

  const analysis = JSON.parse(outputText);

  try {
    analysis.problems = await recommendProblems(body, analysis);
  } catch (error) {
    console.error("Supabase recommendation error:", error.message);
    sendJson(response, 502, {
      error: "오답 분석은 완료했지만 데이터베이스에서 추천 문제를 가져오지 못했습니다.",
    });
    return;
  }

  delete analysis.recommendationKeywords;
  sendJson(response, 200, analysis);
}

async function recommendProblems(input, analysis) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  const fields = "code,unit,problem_type,difficulty,question,hint,answer,explanation,tags,source_name,source_url,license";
  const databaseResponse = await fetch(`${supabaseUrl}/rest/v1/problems?select=${fields}&limit=500`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!databaseResponse.ok) {
    throw new Error(`Supabase 요청 실패 (${databaseResponse.status})`);
  }

  const problems = await databaseResponse.json();
  if (!Array.isArray(problems) || problems.length < 3) {
    throw new Error("추천할 문제가 3개 미만입니다.");
  }

  const keywords = [
    clean(input.unit, 100),
    clean(input.problemType, 100),
    clean(analysis.concept, 200),
    ...(analysis.recommendationKeywords || []),
  ]
    .flatMap(tokenize)
    .filter((word, index, all) => word.length > 1 && all.indexOf(word) === index);

  return problems
    .map((problem) => ({ problem, score: scoreProblem(problem, keywords, input) }))
    .sort((a, b) => b.score - a.score || a.problem.code.localeCompare(b.problem.code))
    .slice(0, 3)
    .map(({ problem }, index) => ({
      title: `${problem.unit} · 추천 ${index + 1}`,
      difficulty: problem.difficulty,
      question: problem.question,
      hint: problem.hint,
      answer: problem.answer,
      explanation: problem.explanation,
      sourceName: problem.source_name,
      sourceUrl: problem.source_url,
      license: problem.license,
    }));
}

function scoreProblem(problem, keywords, input) {
  const unit = normalizeText(problem.unit);
  const type = normalizeText(problem.problem_type);
  const searchable = normalizeText([
    problem.unit,
    problem.problem_type,
    problem.question,
    ...(problem.tags || []),
  ].join(" "));
  let score = 0;

  if (unit === normalizeText(input.unit)) score += 40;
  if (type === normalizeText(input.problemType)) score += 20;
  for (const keyword of keywords) {
    const normalized = normalizeText(keyword);
    if (unit.includes(normalized)) score += 8;
    else if (type.includes(normalized)) score += 5;
    else if (searchable.includes(normalized)) score += 2;
  }
  return score;
}

function tokenize(value) {
  return String(value || "")
    .split(/[\s,·/()]+/)
    .map((word) => word.replace(/[^0-9A-Za-z가-힣]/g, ""))
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

async function serveStatic(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("페이지를 찾을 수 없습니다.");
    return;
  }

  const data = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  if (request.method === "HEAD") response.end();
  else response.end(data);
}

function readJsonBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("요청 크기가 너무 큽니다."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("요청 형식이 올바르지 않습니다."));
      }
    });
    request.on("error", reject);
  });
}

function clean(value, maxLength) {
  return value.trim().slice(0, maxLength);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function loadLocalEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}
