const form = document.querySelector("#wrong-answer-form");
const imageInput = document.querySelector("#problem-image");
const uploadTitle = document.querySelector("#upload-title");
const uploadHelp = document.querySelector("#upload-help");
const resultCard = document.querySelector("#result-card");
const resultList = document.querySelector("#result-list");
const analysisCause = document.querySelector("#analysis-cause");
const analysisConfidence = document.querySelector("#analysis-confidence");
const analysisReason = document.querySelector("#analysis-reason");
const analysisConcept = document.querySelector("#analysis-concept");
const analysisAction = document.querySelector("#analysis-action");
const progressSteps = document.querySelectorAll(".progress-item");

const analysisRules = {
  "개념이 기억나지 않음": {
    cause: "개념 이해 부족",
    confidence: "높은 가능성",
    reason: "풀이에 필요한 개념이 바로 떠오르지 않았다고 선택했기 때문이에요.",
    action: "교과서의 핵심 개념과 대표 예제를 먼저 복습한 뒤, 같은 단원의 쉬운 문제부터 다시 풀어 보세요.",
  },
  "계산 실수": {
    cause: "계산 실수",
    confidence: "높은 가능성",
    reason: "풀이 방법은 알고 있었지만 계산 과정에서 실수했다고 선택했기 때문이에요.",
    action: "풀이의 계산 단계를 한 줄씩 분리해 쓰고, 부호·괄호·단위를 마지막에 한 번 더 확인해 보세요.",
  },
  "조건을 놓침": {
    cause: "조건 해석 오류",
    confidence: "높은 가능성",
    reason: "문제에 제시된 조건을 놓쳤다고 선택했기 때문이에요.",
    action: "문제에서 수치, 범위, 단위를 밑줄로 표시한 뒤 각 조건을 풀이에 사용했는지 확인해 보세요.",
  },
  "풀이 방법을 모름": {
    cause: "풀이 전략 부족",
    confidence: "높은 가능성",
    reason: "문제를 시작할 풀이 방법을 찾지 못했다고 선택했기 때문이에요.",
    action: "같은 유형의 대표 문제 풀이를 보고 첫 단계가 무엇인지 정리한 다음, 숫자만 바꾼 문제를 풀어 보세요.",
  },
  "풀이 누락": {
    cause: "풀이 과정 누락",
    confidence: "높은 가능성",
    reason: "풀이를 끝까지 작성하지 못했다고 선택했기 때문이에요.",
    action: "답을 구한 뒤에도 식, 근거, 단위를 모두 썼는지 확인하는 마무리 체크를 해 보세요.",
  },
  "기타": {
    cause: "추가 확인 필요",
    confidence: "판단 보류",
    reason: "선택한 정보만으로는 대표 오답 유형을 정확히 정하기 어려워요.",
    action: "틀린 풀이와 정답 풀이를 한 단계씩 비교해 처음 달라진 지점을 찾아 적어 보세요.",
  },
};

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  uploadTitle.textContent = file.name;
  uploadHelp.textContent = "이미지가 선택되었습니다. 다시 누르면 변경할 수 있어요.";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const selectedSituation = form.querySelector('input[name="situation"]:checked');
  const wrongAnswer = {
    subject: document.querySelector("#subject").value,
    unit: document.querySelector("#unit").value.trim(),
    problemType: document.querySelector("#problem-type").value.trim(),
    userAnswer: document.querySelector("#user-answer").value.trim(),
    correctAnswer: document.querySelector("#correct-answer").value.trim(),
    situation: selectedSituation.value,
    imageName: imageInput.files[0]?.name || "등록하지 않음",
  };

  console.log("등록된 오답 정보:", wrongAnswer);

  const analysis = analysisRules[wrongAnswer.situation];
  analysisCause.textContent = analysis.cause;
  analysisConfidence.textContent = analysis.confidence;
  analysisReason.textContent = `${analysis.reason} 내 답(${wrongAnswer.userAnswer})과 정답(${wrongAnswer.correctAnswer})이 달라진 과정을 함께 비교하면 원인을 더 정확히 찾을 수 있어요.`;
  analysisConcept.textContent = `${wrongAnswer.subject}의 ‘${wrongAnswer.unit}’ 단원 중 ${wrongAnswer.problemType} 문제에 필요한 핵심 개념과 풀이 순서를 다시 확인해 보세요.`;
  analysisAction.textContent = analysis.action;

  const labels = {
    subject: "과목",
    unit: "단원",
    problemType: "유형",
    userAnswer: "내 답",
    correctAnswer: "정답",
    situation: "상황",
    imageName: "이미지",
  };

  resultList.replaceChildren();
  Object.entries(wrongAnswer).forEach(([key, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = labels[key];
    description.textContent = value;
    resultList.append(term, description);
  });

  resultCard.hidden = false;
  progressSteps.forEach((step) => {
    step.classList.remove("active", "complete");
    if (step.dataset.step === "1") step.classList.add("complete");
    if (step.dataset.step === "2") step.classList.add("active");
  });
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
