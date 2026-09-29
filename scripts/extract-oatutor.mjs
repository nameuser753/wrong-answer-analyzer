import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const sourceRepo = process.argv[2];
const outputFile = process.argv[3] || join("data", "oatutor-problems-en.json");
const limit = Number(process.argv[4] || 100);

if (!sourceRepo) {
  throw new Error("Usage: node scripts/extract-oatutor.mjs <source-repo> [output-file] [limit]");
}

function git(...args) {
  return execFileSync(
    "git",
    ["-c", `safe.directory=${sourceRepo.replaceAll("\\", "/")}`, "-C", sourceRepo, ...args],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
}

function readJson(path) {
  return JSON.parse(git("show", `HEAD:${path}`));
}

const paths = git("ls-tree", "-r", "--name-only", "HEAD:content-pool")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((path) => `content-pool/${path}`);

const rootPaths = git(
  "grep",
  "-l",
  '"courseName": "OpenStax: Elementary Algebra"',
  "HEAD",
  "--",
  "content-pool/*/*.json",
)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.replace(/^HEAD:/, ""));

const records = [];

for (const rootPath of rootPaths) {
  if (records.length >= limit) break;

  let root;
  try {
    root = readJson(rootPath);
  } catch {
    continue;
  }

  if (root.courseName !== "OpenStax: Elementary Algebra") continue;

  const base = rootPath.slice(0, rootPath.lastIndexOf("/"));
  const stepPaths = paths.filter((path) =>
    path.startsWith(`${base}/steps/`) &&
    !path.includes("/tutoring/") &&
    path.endsWith(".json"),
  );

  for (const stepPath of stepPaths) {
    if (records.length >= limit) break;

    let step;
    try {
      step = readJson(stepPath);
    } catch {
      continue;
    }

    const question = [step.stepTitle, step.stepBody].filter(Boolean).join("\n").trim();
    const answers = Array.isArray(step.stepAnswer) ? step.stepAnswer.filter(Boolean) : [];
    if (!question || answers.length === 0) continue;

    const stepDir = stepPath.slice(0, stepPath.lastIndexOf("/"));
    const tutoringPath = paths.find((path) =>
      path.startsWith(`${stepDir}/tutoring/`) && path.endsWith("DefaultPathway.json"),
    );

    let hints = [];
    if (tutoringPath) {
      try {
        hints = readJson(tutoringPath)
          .filter((item) => item.type === "hint" || item.type === "scaffold")
          .map((item) => item.text || item.title)
          .filter(Boolean);
      } catch {
        hints = [];
      }
    }

    records.push({
      code: `oatutor-${step.id}`,
      sourceId: step.id,
      subject: "수학",
      unit: root.lesson || "Elementary Algebra",
      problemType: step.problemType || "TextBox",
      difficulty: "보통",
      title: root.title || "Elementary Algebra",
      question,
      hints,
      answer: answers.join(" 또는 "),
      answerType: step.answerType || "",
      sourceName: "OpenStax: Elementary Algebra 2e / OATutor",
      sourceAuthor: "OpenStax and OATutor Project",
      sourceUrl: "https://github.com/CAHLR/OATutor-Content",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      originalPath: stepPath,
      attribution: "Problem content adapted from OpenStax Elementary Algebra 2e; hints and scaffolds by the OATutor Project. Licensed under CC BY 4.0.",
    });
  }
}

if (records.length < limit) {
  throw new Error(`Only ${records.length} usable problems were found; expected ${limit}.`);
}

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`Extracted ${records.length} problems to ${outputFile}`);

