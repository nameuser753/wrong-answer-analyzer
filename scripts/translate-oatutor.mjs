import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

loadEnv(join(process.cwd(), ".env"));

const inputFile = process.argv[2] || join("data", "oatutor-problems-en.json");
const outputFile = process.argv[3] || join("data", "oatutor-problems-ko.json");
const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const source = JSON.parse(readFileSync(inputFile, "utf8"));

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing.");

const translated = [];
for (let offset = 0; offset < source.length; offset += 10) {
  const batch = source.slice(offset, offset + 10).map(({ code, title, unit, question, hints }) => ({
    code,
    title,
    unit,
    question,
    hints,
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      instructions: [
        "Translate only the supplied educational text into natural Korean for Korean middle/high school students.",
        "Do not create, remove, solve, or alter any problem. Preserve every number, variable, answer choice, LaTeX expression, and array length exactly.",
        "Return one item for every code in the same order. Translate title, unit, question, and hints only.",
      ].join(" "),
      input: JSON.stringify(batch),
      max_output_tokens: 10000,
      text: {
        format: {
          type: "json_schema",
          name: "translated_problems",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                minItems: batch.length,
                maxItems: batch.length,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    code: { type: "string" },
                    title: { type: "string" },
                    unit: { type: "string" },
                    question: { type: "string" },
                    hints: { type: "array", items: { type: "string" } },
                  },
                  required: ["code", "title", "unit", "question", "hints"],
                },
              },
            },
            required: ["items"],
          },
        },
      },
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `Translation failed (${response.status}).`);
  const outputText = result.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error(`No translation returned for offset ${offset}.`);

  const items = JSON.parse(outputText).items;
  for (let index = 0; index < batch.length; index += 1) {
    if (items[index].code !== batch[index].code) throw new Error(`Code mismatch at ${offset + index}.`);
    translated.push({ ...source[offset + index], ...items[index] });
  }
  console.log(`Translated ${translated.length}/${source.length}`);
}

writeFileSync(outputFile, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
console.log(`Saved ${translated.length} translated problems to ${outputFile}`);

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

