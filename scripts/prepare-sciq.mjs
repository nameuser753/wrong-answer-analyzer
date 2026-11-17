import { readFileSync, writeFileSync } from "node:fs";

const sourcePath = process.argv[2] || "data/sciq-source-100.json";
const jsonPath = process.argv[3] || "data/sciq-problems-en.json";
const sqlPath = process.argv[4] || "data/sciq-problems.sql";
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

const problems = source.rows.map(({ row, row_idx: index }) => {
  const options = rotate([
    row.correct_answer,
    row.distractor1,
    row.distractor2,
    row.distractor3,
  ], index % 4);
  const answerIndex = options.indexOf(row.correct_answer);
  const unit = classifyUnit(`${row.question} ${row.support}`);
  const difficulty = row.question.length <= 70 ? "쉬움" : row.question.length <= 125 ? "보통" : "응용";

  return {
    code: `sciq-train-${String(index).padStart(4, "0")}`,
    subject: "과학",
    unit,
    problem_type: "객관식",
    difficulty,
    question: `${row.question}\n\n${options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`).join("\n")}`,
    hint: firstSentence(row.support) || "각 선택지가 과학 개념과 어떻게 연결되는지 비교해 보세요.",
    answer: `${String.fromCharCode(65 + answerIndex)}. ${row.correct_answer}`,
    explanation: row.support || `The correct answer is ${row.correct_answer}.`,
    tags: [unit, "Science", "multiple choice", "SciQ", "CC BY-NC 3.0"],
    source_name: "SciQ: Crowdsourcing Multiple Choice Science Questions",
    source_author: "Johannes Welbl, Nelson F. Liu, and Matt Gardner",
    source_url: "https://huggingface.co/datasets/allenai/sciq",
    license: "CC BY-NC 3.0",
    attribution: "SciQ by Johannes Welbl, Nelson F. Liu, and Matt Gardner. Licensed under CC BY-NC 3.0. Original English text retained.",
  };
});

writeFileSync(jsonPath, `${JSON.stringify(problems, null, 2)}\n`, "utf8");

const sql = `-- Generated from allenai/sciq (CC BY-NC 3.0). Keep attribution fields.\n` +
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
console.log(`Prepared ${problems.length} SciQ problems.`);

function rotate(items, amount) {
  return [...items.slice(amount), ...items.slice(0, amount)];
}

function firstSentence(value) {
  return String(value || "").match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || String(value || "").slice(0, 180);
}

function classifyUnit(value) {
  const text = value.toLowerCase();
  const groups = [
    ["생명과학", ["cell", "organism", "gene", "dna", "plant", "animal", "bacteria", "protein", "enzyme", "evolution", "ecology", "body", "blood"]],
    ["화학", ["atom", "molecule", "chemical", "element", "compound", "acid", "base", "reaction", "electron", "bond", "gas", "solution"]],
    ["물리", ["force", "energy", "motion", "velocity", "mass", "electric", "magnet", "wave", "light", "sound", "heat", "pressure"]],
    ["지구과학", ["earth", "rock", "mineral", "weather", "climate", "ocean", "atmosphere", "planet", "star", "solar", "volcano", "geology"]],
  ];
  let best = { unit: "통합과학", score: 0 };
  for (const [unit, words] of groups) {
    const score = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    if (score > best.score) best = { unit, score };
  }
  return best.unit;
}
