import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const inputFile = process.argv[2] || join("data", "oatutor-problems-ko.json");
const outputFile = process.argv[3] || join("data", "oatutor-problems.sql");
const items = JSON.parse(readFileSync(inputFile, "utf8"));

const quote = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const rows = items.map((item) => {
  const hint = item.hints[0] || "문제에서 요구하는 계산 규칙을 먼저 확인해 보세요.";
  const explanation = item.hints.length
    ? `해결 단계: ${item.hints.join(" → ")}\n정답: ${item.answer}`
    : `정답: ${item.answer}`;
  const tags = [item.unit, item.title, "OATutor", "CC BY 4.0"];
  return `  (${[
    quote(item.code),
    quote(item.subject),
    quote(item.unit),
    quote(item.answerType === "arithmetic" ? "계산형" : "연습형"),
    quote("보통"),
    quote(item.question),
    quote(hint),
    quote(item.answer),
    quote(explanation),
    `array[${tags.map(quote).join(", ")}]`,
    quote(item.sourceName),
    quote(item.sourceAuthor),
    quote(item.sourceUrl),
    quote(item.license),
    quote(item.attribution),
  ].join(", ")})`;
});

const sql = `-- Generated from CAHLR/OATutor-Content. Do not remove attribution fields.\n` +
  `insert into public.problems\n` +
  `  (code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags,\n` +
  `   source_name, source_author, source_url, license, attribution)\n` +
  `values\n${rows.join(",\n")}\n` +
  `on conflict (code) do update set\n` +
  `  unit = excluded.unit, problem_type = excluded.problem_type, difficulty = excluded.difficulty,\n` +
  `  question = excluded.question, hint = excluded.hint, answer = excluded.answer,\n` +
  `  explanation = excluded.explanation, tags = excluded.tags, source_name = excluded.source_name,\n` +
  `  source_author = excluded.source_author, source_url = excluded.source_url,\n` +
  `  license = excluded.license, attribution = excluded.attribution;\n`;

writeFileSync(outputFile, sql, "utf8");
console.log(`Generated SQL for ${items.length} problems at ${outputFile}`);

