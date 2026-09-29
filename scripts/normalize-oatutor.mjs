import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] || "data/oatutor-problems-ko.json";
const items = JSON.parse(readFileSync(file, "utf8"));
const unitNames = new Map([
  ["3.1", "3.1 문제 해결 전략 사용하기"],
  ["4.6", "4.6 직선의 방정식 구하기"],
  ["6.3", "6.3 다항식 곱하기"],
  ["8.7", "8.7 비례식과 닮은 도형 활용 문제 풀기"],
]);

for (const item of items) {
  const prefix = String(item.unit).match(/^\d+\.\d+/)?.[0];
  if (prefix && unitNames.has(prefix)) item.unit = unitNames.get(prefix);
}

writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
console.log(`Normalized ${items.length} problems in ${file}`);

