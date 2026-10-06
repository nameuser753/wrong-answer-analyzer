import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const inputFile = process.argv[2] || join("data", "oatutor-problems-ko.json");
const outputFile = process.argv[3] || join("data", "oatutor-problems.sql");
const items = JSON.parse(readFileSync(inputFile, "utf8"));

const rows = items.map((item) => {
  const hint = item.hints[0] || "문제에서 요구하는 계산 규칙을 먼저 확인해 보세요.";
  const explanation = item.hints.length
    ? `해결 단계: ${item.hints.join(" → ")}\n정답: ${item.answer}`
    : `정답: ${item.answer}`;
  const tags = [item.unit, item.title, "OATutor", "CC BY 4.0"];
  return {
    code: item.code,
    subject: item.subject,
    unit: item.unit,
    problem_type: item.answerType === "arithmetic" ? "계산형" : "연습형",
    difficulty: "보통",
    question: item.question,
    hint,
    answer: item.answer,
    explanation,
    tags,
    source_name: item.sourceName,
    source_author: item.sourceAuthor,
    source_url: item.sourceUrl,
    license: item.license,
    attribution: item.attribution,
  };
});

const sql = `-- Generated from CAHLR/OATutor-Content. Do not remove attribution fields.\n` +
  `insert into public.problems\n` +
  `  (code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags,\n` +
  `   source_name, source_author, source_url, license, attribution)\n` +
  `select code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags,\n` +
  `       source_name, source_author, source_url, license, attribution\n` +
  `from jsonb_to_recordset($problem_data$${JSON.stringify(rows)}$problem_data$::jsonb) as item(\n` +
  `  code text, subject text, unit text, problem_type text, difficulty text, question text,\n` +
  `  hint text, answer text, explanation text, tags text[], source_name text, source_author text,\n` +
  `  source_url text, license text, attribution text\n` +
  `)\n` +
  `on conflict (code) do update set\n` +
  `  unit = excluded.unit, problem_type = excluded.problem_type, difficulty = excluded.difficulty,\n` +
  `  question = excluded.question, hint = excluded.hint, answer = excluded.answer,\n` +
  `  explanation = excluded.explanation, tags = excluded.tags, source_name = excluded.source_name,\n` +
  `  source_author = excluded.source_author, source_url = excluded.source_url,\n` +
  `  license = excluded.license, attribution = excluded.attribution;\n`;

writeFileSync(outputFile, sql, "utf8");
console.log(`Generated SQL for ${items.length} problems at ${outputFile}`);

