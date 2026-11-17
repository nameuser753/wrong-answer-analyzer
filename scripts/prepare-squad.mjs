import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = process.argv[2] || "data/squad-source-100.json";
const jsonPath = process.argv[3] || "data/squad-problems-en.json";
const sqlPath = process.argv[4] || "data/squad-problems.sql";
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const problems = source.rows.map(({ row }, index) => {
  const answer = row.answers?.text?.[0] || "";
  const answerStart = row.answers?.answer_start?.[0] ?? row.context.indexOf(answer);
  const difficulty = row.context.length <= 500 ? "쉬움" : row.context.length <= 900 ? "보통" : "응용";

  return {
    code: `squad-${row.id || String(index).padStart(4, "0")}`,
    subject: "영어",
    unit: "영어 독해",
    problem_type: "독해형",
    difficulty,
    question: `[Passage: ${row.title.replaceAll("_", " ")}]\n${row.context}\n\n[Question]\n${row.question}`,
    hint: "Find the sentence in the passage that uses the same key idea as the question.",
    answer,
    explanation: evidenceSentence(row.context, answerStart, answer),
    tags: ["영어 독해", "reading comprehension", row.title.replaceAll("_", " "), "SQuAD", "CC BY-SA 4.0"],
    source_name: "Stanford Question Answering Dataset (SQuAD)",
    source_author: "Pranav Rajpurkar, Jian Zhang, Konstantin Lopyrev, and Percy Liang",
    source_url: "https://rajpurkar.github.io/SQuAD-explorer/",
    license: "CC BY-SA 4.0",
    attribution: "Adapted from the Stanford Question Answering Dataset (SQuAD), licensed under CC BY-SA 4.0. Passage sources originate from Wikipedia; original English text retained.",
  };
});

writeFileSync(jsonPath, `${JSON.stringify(problems, null, 2)}\n`, "utf8");

const sql = `-- Generated from Stanford SQuAD (CC BY-SA 4.0). Keep attribution fields.\n` +
  `insert into public.problems\n` +
  `  (code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags,\n` +
  `   source_name, source_author, source_url, license, attribution)\n` +
  `select code, subject, unit, problem_type, difficulty, question, hint, answer, explanation, tags,\n` +
  `       source_name, source_author, source_url, license, attribution\n` +
  `from jsonb_to_recordset($problem_data$${JSON.stringify(problems)}$problem_data$::jsonb) as item(\n` +
  `  code text, subject text, unit text, problem_type text, difficulty text, question text,\n` +
  `  hint text, answer text, explanation text, tags text[], source_name text, source_author text,\n` +
  `  source_url text, license text, attribution text\n` +
  `)\n` +
  `on conflict (code) do update set\n` +
  `  subject = excluded.subject, unit = excluded.unit, problem_type = excluded.problem_type,\n` +
  `  difficulty = excluded.difficulty, question = excluded.question, hint = excluded.hint,\n` +
  `  answer = excluded.answer, explanation = excluded.explanation, tags = excluded.tags,\n` +
  `  source_name = excluded.source_name, source_author = excluded.source_author,\n` +
  `  source_url = excluded.source_url, license = excluded.license, attribution = excluded.attribution;\n`;

writeFileSync(sqlPath, sql, "utf8");
console.log(`Prepared ${problems.length} SQuAD problems.`);

function evidenceSentence(context, start, answer) {
  if (!context) return `The answer is ${answer}.`;
  const safeStart = Math.max(0, Number(start) || 0);
  const before = context.lastIndexOf(".", safeStart - 1);
  const after = context.indexOf(".", safeStart + answer.length);
  const sentence = context.slice(before < 0 ? 0 : before + 1, after < 0 ? context.length : after + 1).trim();
  return sentence || `The answer is ${answer}.`;
}
