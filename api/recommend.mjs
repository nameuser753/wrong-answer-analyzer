export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "지원하지 않는 요청입니다." });
  }

  const body = request.body || {};
  if (typeof body.subject !== "string" || typeof body.unit !== "string" || typeof body.problemType !== "string" || typeof body.concept !== "string") {
    return response.status(400).json({ error: "추천에 필요한 정보가 부족합니다." });
  }

  try {
    const problems = await fetchProblems(body.subject);
    const excluded = new Set(Array.isArray(body.excludeCodes) ? body.excludeCodes.slice(0, 500) : []);
    const difficulty = ["쉬움", "보통", "어려움"].includes(body.difficulty) ? body.difficulty : "전체";
    const keywords = [body.unit, body.problemType, body.concept]
      .flatMap(tokenize).filter((word, index, all) => word.length > 1 && all.indexOf(word) === index);

    const recommendations = problems
      .filter((problem) => !excluded.has(problem.code))
      .map((problem) => ({ problem, difficulty: inferDifficulty(problem) }))
      .filter((item) => difficulty === "전체" || item.difficulty === difficulty)
      .map((item) => ({ ...item, score: scoreProblem(item.problem, keywords, body) }))
      .sort((a, b) => b.score - a.score || a.problem.code.localeCompare(b.problem.code))
      .slice(0, 3)
      .map(({ problem, difficulty: level }, index) => ({
        code: problem.code,
        title: `${problem.unit} · 추천 ${index + 1}`,
        difficulty: level,
        question: problem.question,
        hint: problem.hint,
        answer: problem.answer,
        explanation: problem.explanation,
        sourceName: problem.source_name,
        sourceUrl: problem.source_url,
        license: problem.license,
      }));

    return response.status(200).json({ problems: recommendations });
  } catch (error) {
    console.error(error);
    return response.status(502).json({ error: "데이터베이스에서 다른 문제를 가져오지 못했습니다." });
  }
}

async function fetchProblems(subject) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase 설정이 없습니다.");
  const fields = "code,subject,unit,problem_type,difficulty,question,hint,answer,explanation,tags,source_name,source_url,license";
  const subjectFilter = encodeURIComponent(`eq.${subject}`);
  const result = await fetch(`${url}/rest/v1/problems?select=${fields}&subject=${subjectFilter}&limit=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!result.ok) throw new Error(`Supabase 요청 실패 (${result.status})`);
  const problems = await result.json();
  if (!Array.isArray(problems)) throw new Error("문제 데이터 형식이 올바르지 않습니다.");
  return problems;
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

function inferDifficulty(problem) {
  if (problem.subject !== "수학") {
    return problem.difficulty === "응용" ? "어려움" : problem.difficulty;
  }
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

function tokenize(value) {
  return String(value || "").split(/[\s,·/()]+/)
    .map((word) => word.replace(/[^0-9A-Za-z가-힣]/g, "")).filter(Boolean);
}
function normalize(value) { return String(value || "").toLowerCase().replace(/\s+/g, ""); }
