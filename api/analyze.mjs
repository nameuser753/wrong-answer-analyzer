export const config = { api: { bodyParser: { sizeLimit: "7mb" } } };

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "지원하지 않는 요청입니다." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({ error: "OpenAI API 키가 설정되지 않았습니다." });
  }

  const body = request.body || {};
  const required = ["subject", "unit", "problemType", "userAnswer", "correctAnswer", "situation"];
  if (required.some((key) => typeof body[key] !== "string" || !body[key].trim())) {
    return response.status(400).json({ error: "필수 입력 항목을 모두 작성해 주세요." });
  }

  const content = [{
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
  }];

  if (typeof body.imageDataUrl === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(body.imageDataUrl)) {
    content.push({ type: "input_image", image_url: body.imageDataUrl, detail: "auto" });
  }

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        store: false,
        reasoning: { effort: "low" },
        instructions: "당신은 한국 중·고등학생의 오답을 분석하는 학습 코치입니다. 학생의 답과 정답을 비교하되 정보가 부족하면 단정하지 마세요. 문제 이미지가 있으면 이미지의 문제 내용과 풀이도 확인하세요. 문제를 새로 만들지 말고, 공개 문제 데이터베이스 검색에 사용할 구체적인 한국어 핵심어를 제시하세요.",
        input: [{ role: "user", content }],
        max_output_tokens: 1800,
        text: { format: { type: "json_schema", name: "wrong_answer_analysis", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: {
            cause: { type: "string" },
            confidence: { type: "string", enum: ["높은 가능성", "보통 가능성", "추가 확인 필요"] },
            reason: { type: "string" }, concept: { type: "string" }, action: { type: "string" },
            recommendationReason: { type: "string" },
            recommendationKeywords: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
          },
          required: ["cause", "confidence", "reason", "concept", "action", "recommendationReason", "recommendationKeywords"],
        } } },
      }),
    });

    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = apiResponse.status === 401 ? "OpenAI API 키가 올바르지 않습니다."
        : apiResponse.status === 429 ? "API 사용 한도에 도달했습니다."
          : "GPT 분석 요청을 완료하지 못했습니다.";
      return response.status(apiResponse.status).json({ error: message });
    }

    const outputText = result.output?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) return response.status(502).json({ error: "GPT 분석 결과가 없습니다." });

    const analysis = JSON.parse(outputText);
    analysis.problems = await recommendProblems(body, analysis);
    delete analysis.recommendationKeywords;
    return response.status(200).json(analysis);
  } catch (error) {
    console.error(error);
    return response.status(502).json({ error: "AI 분석 또는 문제 추천을 완료하지 못했습니다." });
  }
}

async function recommendProblems(input, analysis) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase 설정이 없습니다.");
  const fields = "code,unit,problem_type,difficulty,question,hint,answer,explanation,tags,source_name,source_url,license";
  const dbResponse = await fetch(`${url}/rest/v1/problems?select=${fields}&limit=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!dbResponse.ok) throw new Error(`Supabase 요청 실패 (${dbResponse.status})`);
  const problems = await dbResponse.json();
  if (!Array.isArray(problems) || problems.length < 3) throw new Error("추천 문제가 부족합니다.");

  const keywords = [input.unit, input.problemType, analysis.concept, ...(analysis.recommendationKeywords || [])]
    .flatMap(tokenize).filter((word, index, all) => word.length > 1 && all.indexOf(word) === index);
  return problems.map((problem) => ({ problem, score: scoreProblem(problem, keywords, input) }))
    .sort((a, b) => b.score - a.score || a.problem.code.localeCompare(b.problem.code)).slice(0, 3)
    .map(({ problem }, index) => ({
      code: problem.code,
      title: `${problem.unit} · 추천 ${index + 1}`,
      difficulty: inferDifficulty(problem), question: problem.question, hint: problem.hint,
      answer: problem.answer, explanation: problem.explanation,
      sourceName: problem.source_name, sourceUrl: problem.source_url, license: problem.license,
    }));
}

function scoreProblem(problem, keywords, input) {
  const unit = normalize(problem.unit), type = normalize(problem.problem_type);
  const searchable = normalize([problem.unit, problem.problem_type, problem.question, ...(problem.tags || [])].join(" "));
  let score = unit === normalize(input.unit) ? 40 : 0;
  if (type === normalize(input.problemType)) score += 20;
  for (const keyword of keywords) {
    const value = normalize(keyword);
    score += unit.includes(value) ? 8 : type.includes(value) ? 5 : searchable.includes(value) ? 2 : 0;
  }
  return score;
}

function tokenize(value) {
  return String(value || "").split(/[\s,·/()]+/)
    .map((word) => word.replace(/[^0-9A-Za-z가-힣]/g, "")).filter(Boolean);
}
function normalize(value) { return String(value || "").toLowerCase().replace(/\s+/g, ""); }
function clean(value, max) { return value.trim().slice(0, max); }

function inferDifficulty(problem) {
  const question = String(problem.question || "");
  let complexity = 0;
  complexity += Math.min(3, (question.match(/\^/g) || []).length);
  complexity += Math.min(2, (question.match(/\\frac|\\sqrt/g) || []).length * 2);
  complexity += Math.min(2, (question.match(/[(){}]/g) || []).length / 2);
  complexity += question.length > 45 ? 2 : question.length > 25 ? 1 : 0;
  if (complexity <= 1) return "쉬움";
  if (complexity <= 3) return "보통";
  return "어려움";
}
