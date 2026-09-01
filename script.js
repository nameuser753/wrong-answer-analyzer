const form = document.querySelector("#wrong-answer-form");
const imageInput = document.querySelector("#problem-image");
const uploadTitle = document.querySelector("#upload-title");
const uploadHelp = document.querySelector("#upload-help");
const resultCard = document.querySelector("#result-card");
const resultList = document.querySelector("#result-list");

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
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
