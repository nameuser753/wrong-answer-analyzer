const form = document.querySelector("#wrong-answer-form");
const imageInput = document.querySelector("#problem-image");
const uploadTitle = document.querySelector("#upload-title");
const uploadHelp = document.querySelector("#upload-help");
const analyzeButton = document.querySelector("#analyze-button");
const formMessage = document.querySelector("#form-message");
const resultCard = document.querySelector("#result-card");
const resultList = document.querySelector("#result-list");
const recommendationCard = document.querySelector("#recommendation-card");
const recommendationReason = document.querySelector("#recommendation-reason");
const problemList = document.querySelector("#problem-list");
const progressSteps = document.querySelectorAll(".progress-item");
const screens = document.querySelectorAll(".screen");
const stepBadge = document.querySelector("#step-badge");

document.querySelector("#back-to-input").addEventListener("click", () => showScreen(1));
document.querySelector("#go-to-recommendation").addEventListener("click", () => showScreen(3));
document.querySelector("#back-to-analysis").addEventListener("click", () => showScreen(2));
document.querySelector("#start-over").addEventListener("click", () => {
  form.reset();
  uploadTitle.textContent = "문제 이미지 추가";
  uploadHelp.textContent = "사진을 선택하거나 촬영해 주세요 (선택)";
  showScreen(1);
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    imageInput.value = "";
    showError("이미지 파일만 선택할 수 있어요.");
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    imageInput.value = "";
    showError("문제 이미지는 4MB 이하로 선택해 주세요.");
    return;
  }

  hideError();
  uploadTitle.textContent = file.name;
  uploadHelp.textContent = "이미지가 선택되었습니다. GPT가 문제 내용을 함께 확인합니다.";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();
  setLoading(true);

  try {
    const selectedSituation = form.querySelector('input[name="situation"]:checked');
    const wrongAnswer = {
      subject: document.querySelector("#subject").value,
      unit: document.querySelector("#unit").value.trim(),
      problemType: document.querySelector("#problem-type").value.trim(),
      userAnswer: document.querySelector("#user-answer").value.trim(),
      correctAnswer: document.querySelector("#correct-answer").value.trim(),
      situation: selectedSituation.value,
      imageName: imageInput.files[0]?.name || "등록하지 않음",
      imageDataUrl: imageInput.files[0] ? await fileToDataUrl(imageInput.files[0]) : null,
    };

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrongAnswer),
    });
    const responseText = await response.text();
    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error("GPT 서버와 연결되지 않았습니다. server.mjs로 실행했는지 확인해 주세요.");
    }

    if (!response.ok) throw new Error(payload.error || "AI 분석 중 문제가 발생했습니다.");
    renderAnalysis(payload, wrongAnswer);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

function renderAnalysis(result, wrongAnswer) {
  document.querySelector("#analysis-cause").textContent = result.cause;
  document.querySelector("#analysis-confidence").textContent = result.confidence;
  document.querySelector("#analysis-reason").textContent = result.reason;
  document.querySelector("#analysis-concept").textContent = result.concept;
  document.querySelector("#analysis-action").textContent = result.action;
  recommendationReason.textContent = result.recommendationReason;

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
  Object.entries(labels).forEach(([key, label]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = wrongAnswer[key];
    resultList.append(term, description);
  });

  problemList.replaceChildren();
  result.problems.forEach((problem, index) => {
    const article = document.createElement("article");
    article.className = "problem-item";

    const head = document.createElement("div");
    head.className = "problem-head";
    const title = document.createElement("h3");
    title.textContent = `${index + 1}. ${problem.title}`;
    const difficulty = document.createElement("span");
    difficulty.className = "difficulty";
    difficulty.textContent = problem.difficulty;
    head.append(title, difficulty);

    const question = document.createElement("p");
    question.className = "problem-question";
    question.textContent = problem.question;

    const hintDetails = document.createElement("details");
    hintDetails.className = "hint-details";
    const hintSummary = document.createElement("summary");
    hintSummary.textContent = "힌트 보기";
    const hint = document.createElement("p");
    hint.textContent = problem.hint;
    hintDetails.append(hintSummary, hint);

    const answerDetails = document.createElement("details");
    answerDetails.className = "answer-details";
    const answerSummary = document.createElement("summary");
    answerSummary.textContent = "정답과 해설 보기";
    const solution = document.createElement("p");
    solution.textContent = `정답: ${problem.answer}\n\n해설: ${problem.explanation}`;
    answerDetails.append(answerSummary, solution);
    article.append(head, question, hintDetails, answerDetails);
    problemList.append(article);
  });

  showScreen(2);
}

function showScreen(stepNumber) {
  const screenIds = ["input-screen", "analysis-screen", "recommendation-screen"];
  const badgeLabels = ["1단계 · 오답 등록", "2단계 · 원인 분석", "3단계 · 문제 추천"];

  screens.forEach((screen) => {
    screen.hidden = screen.id !== screenIds[stepNumber - 1];
  });
  progressSteps.forEach((step) => {
    const value = Number(step.dataset.step);
    step.classList.toggle("active", value === stepNumber);
    step.classList.toggle("complete", value < stepNumber);
  });
  stepBadge.textContent = badgeLabels[stepNumber - 1];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLoading(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.firstChild.textContent = isLoading ? "GPT가 분석하고 있어요... " : "AI로 오답 분석하기 ";
}

function showError(message) {
  formMessage.textContent = message;
  formMessage.hidden = false;
}

function hideError() {
  formMessage.hidden = true;
  formMessage.textContent = "";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}
