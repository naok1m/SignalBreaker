const LEVELS = [
  { a: 1, b: 1, inputs: [1, 2, 3, 4] },
  { a: 2, b: 0, inputs: [1, 2, 3, 4] },
  { a: 2, b: 1, inputs: [1, 2, 3, 4] },
  { a: -1, b: 5, inputs: [0, 1, 2, 3] },
  { a: 3, b: -2, inputs: [1, 2, 3, 4] },
  { a: -2, b: 8, inputs: [0, 1, 2, 3] },
];

const HINTS = [
  "Compare dois outputs seguidos. A diferença entre eles mostra o valor de a.",
  "Depois de descobrir a, use um par da tabela em b = output - (a x input).",
  "Se os outputs diminuem quando os inputs aumentam, o valor de a é negativo.",
  "Quando x = 0 aparece na tabela, o output desse par já é o valor de b.",
];

let audioCtx = null;
let currentLevel = 0;
let totalAttempts = 0;
let levelAttempts = 0;
let hintIndex = 0;
let selectedOptionIndex = null;
let currentOptions = [];
let lockedLevel = false;

const $ = (id) => document.getElementById(id);

const inputsEl = $("inputs");
const expectedEl = $("expected-outputs");
const optionsEl = $("answer-options");
const questionPrompt = $("question-prompt");
const feedbackPanel = $("feedback");
const feedbackText = $("feedback-text");
const levelDisplay = $("level-display");
const levelTotal = $("level-total");
const attemptsEl = $("attempts");
const progressFill = $("progress-fill");
const confirmButton = $("btn-execute");

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  audioCtx.resume();
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $(id).classList.add("active");
}

function playSound(type) {
  try {
    ensureAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.value = 0.15;

    if (type === "success") {
      osc.type = "square";
      osc.frequency.setValueAtTime(523, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, audioCtx.currentTime);
      osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.value = 0.08;
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    }
  } catch (e) {
    // Web Audio not available.
  }
}

let typingInterval = null;

function typeText(element, text, speed = 15) {
  if (typingInterval) clearInterval(typingInterval);
  element.textContent = "";
  let i = 0;
  element.classList.add("typing-cursor");
  typingInterval = setInterval(() => {
    element.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(typingInterval);
      typingInterval = null;
      element.classList.remove("typing-cursor");
    }
  }, speed);
}

function formatFunction(a, b) {
  let str = "f(x) = ";

  if (a === 1) str += "x";
  else if (a === -1) str += "-x";
  else str += `${a}x`;

  if (b > 0) str += ` + ${b}`;
  else if (b < 0) str += ` - ${Math.abs(b)}`;

  return str;
}

function sameFunction(first, second) {
  return first.a === second.a && first.b === second.b;
}

function uniqueOptions(options) {
  return options.filter((option, index, list) => (
    list.findIndex((candidate) => sameFunction(candidate, option)) === index
  ));
}

function makeOptions(level, index) {
  const candidates = uniqueOptions([
    { a: level.a, b: level.b, correct: true },
    { a: level.a + 1, b: level.b, correct: false },
    { a: level.a - 1, b: level.b, correct: false },
    { a: level.a, b: level.b + 1, correct: false },
    { a: level.a, b: level.b - 1, correct: false },
    { a: -level.a, b: level.b, correct: false },
    { a: level.a, b: -level.b, correct: false },
  ]);

  const correct = candidates.find((option) => option.correct);
  const distractors = candidates.filter((option) => !option.correct).slice(0, 3);
  const options = [correct, ...distractors];
  const shift = index % options.length;

  return [...options.slice(shift), ...options.slice(0, shift)];
}

function renderOptions() {
  optionsEl.innerHTML = "";

  currentOptions.forEach((option, index) => {
    const button = document.createElement("button");
    const letter = String.fromCharCode(65 + index);
    button.className = "answer-option";
    button.type = "button";
    button.dataset.index = index;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");
    button.innerHTML = `
      <span class="option-letter">${letter}</span>
      <span class="option-function">${formatFunction(option.a, option.b)}</span>
    `;
    button.addEventListener("click", () => selectOption(index));
    optionsEl.appendChild(button);
  });
}

function selectOption(index) {
  if (lockedLevel) return;

  playSound("click");
  selectedOptionIndex = index;
  confirmButton.disabled = false;
  hideFeedback();

  optionsEl.querySelectorAll(".answer-option").forEach((button, buttonIndex) => {
    const selected = buttonIndex === index;
    button.classList.remove("wrong");
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
}

function loadLevel(index) {
  const level = LEVELS[index];
  levelAttempts = 0;
  hintIndex = 0;
  selectedOptionIndex = null;
  lockedLevel = false;
  currentOptions = makeOptions(level, index);

  levelDisplay.textContent = String(index + 1).padStart(2, "0");
  levelTotal.textContent = String(LEVELS.length).padStart(2, "0");
  attemptsEl.textContent = totalAttempts;
  progressFill.style.width = `${(index / LEVELS.length) * 100}%`;
  confirmButton.disabled = true;
  confirmButton.textContent = "[ CONFIRMAR RESPOSTA ]";

  questionPrompt.textContent = "Escolha a função que transforma todos os inputs nos outputs da tabela.";
  inputsEl.innerHTML = "";
  expectedEl.innerHTML = "";

  level.inputs.forEach((x) => {
    const inputCell = document.createElement("div");
    inputCell.className = "signal-cell input-cell";
    inputCell.textContent = x;
    inputsEl.appendChild(inputCell);

    const expectedCell = document.createElement("div");
    expectedCell.className = "signal-cell expected-cell";
    expectedCell.textContent = level.a * x + level.b;
    expectedEl.appendChild(expectedCell);
  });

  renderOptions();
  hideFeedback();
}

function hideFeedback() {
  feedbackPanel.classList.add("hidden");
  feedbackPanel.classList.remove("success", "error");
}

function showFeedback(message, isSuccess) {
  feedbackPanel.classList.remove("hidden", "success", "error");
  feedbackPanel.classList.add(isSuccess ? "success" : "error");
  typeText(feedbackText, message);
}

function markOptions(isSuccess) {
  optionsEl.querySelectorAll(".answer-option").forEach((button, index) => {
    const option = currentOptions[index];
    button.disabled = isSuccess;
    button.classList.toggle("correct", isSuccess && option.correct);
    button.classList.toggle("wrong", !option.correct && index === selectedOptionIndex);
  });
}

function explainWrongAnswer(level, selected) {
  const x = level.inputs[0];
  const selectedOutput = selected.a * x + selected.b;
  const expectedOutput = level.a * x + level.b;
  const baseHint = HINTS[hintIndex % HINTS.length];
  hintIndex++;

  return [
    "> SINAL REJEITADO.",
    "",
    `Testando ${formatFunction(selected.a, selected.b)} no primeiro input:`,
    `para x = ${x}, ela gera ${selectedOutput}, mas a tabela pede ${expectedOutput}.`,
    "",
    `Dica: ${baseHint}`,
  ].join("\n");
}

function checkAnswer() {
  if (selectedOptionIndex === null || lockedLevel) return;

  const level = LEVELS[currentLevel];
  const selected = currentOptions[selectedOptionIndex];

  if (selected.correct) {
    lockedLevel = true;
    playSound("success");
    markOptions(true);

    const panel = document.querySelector(".panel-signal");
    panel.classList.add("success-flash");
    setTimeout(() => panel.classList.remove("success-flash"), 800);

    showFeedback([
      "> SINAL DECODIFICADO!",
      "",
      `A função correta era ${formatFunction(level.a, level.b)}.`,
      `O valor de a (${level.a}) é a diferença entre outputs consecutivos; b (${level.b}) ajusta o resultado final.`,
    ].join("\n"), true);

    confirmButton.disabled = true;
    confirmButton.textContent = "[ AVANÇANDO... ]";

    setTimeout(() => {
      currentLevel++;
      if (currentLevel >= LEVELS.length) {
        endGame();
      } else {
        loadLevel(currentLevel);
      }
    }, 2600);
  } else {
    playSound("error");
    totalAttempts++;
    levelAttempts++;
    attemptsEl.textContent = totalAttempts;
    markOptions(false);
    showFeedback(explainWrongAnswer(level, selected), false);
  }
}

function showHint() {
  playSound("click");
  const level = LEVELS[currentLevel];
  const expectedFirst = level.a * level.inputs[0] + level.b;
  const expectedSecond = level.a * level.inputs[1] + level.b;
  const diff = expectedSecond - expectedFirst;

  const hint = [
    "> DICA DO SISTEMA",
    "",
    `A diferença entre outputs consecutivos é ${diff}.`,
    `Isso indica que a = ${diff}.`,
    `Agora use b = output - (a x input).`,
    `Com o primeiro par: b = ${expectedFirst} - (${diff} x ${level.inputs[0]}) = ${expectedFirst - diff * level.inputs[0]}.`,
  ].join("\n");

  showFeedback(hint, false);
  feedbackPanel.classList.remove("error");
  feedbackPanel.style.borderColor = "var(--neon-cyan)";
  setTimeout(() => {
    feedbackPanel.style.borderColor = "";
  }, 5000);
}

function endGame() {
  progressFill.style.width = "100%";

  setTimeout(() => {
    showScreen("screen-end");
    $("end-levels").textContent = LEVELS.length;
    $("end-attempts").textContent = totalAttempts;

    let rating;
    if (totalAttempts === 0) {
      rating = "CLASSIFICAÇÃO: ELITE HACKER - Zero erros. Impressionante.";
    } else if (totalAttempts <= 3) {
      rating = "CLASSIFICAÇÃO: HACKER AVANÇADO - Poucos erros. Excelente desempenho.";
    } else if (totalAttempts <= 8) {
      rating = "CLASSIFICAÇÃO: HACKER INTERMEDIÁRIO - Bom trabalho, continue praticando.";
    } else {
      rating = "CLASSIFICAÇÃO: HACKER INICIANTE - Cada erro é aprendizado. Tente novamente!";
    }

    $("end-rating").textContent = rating;
  }, 500);
}

function resetGame() {
  currentLevel = 0;
  totalAttempts = 0;
  levelAttempts = 0;
  hintIndex = 0;
  showScreen("screen-game");
  loadLevel(0);
}

$("btn-start").addEventListener("click", () => {
  ensureAudioContext();
  playSound("click");
  showScreen("screen-game");
  loadLevel(0);
});

confirmButton.addEventListener("click", checkAnswer);
$("btn-hint").addEventListener("click", showHint);
$("btn-restart").addEventListener("click", () => {
  playSound("click");
  resetGame();
});

document.addEventListener("keydown", (e) => {
  if (!$("screen-game").classList.contains("active")) return;

  if (e.key >= "1" && e.key <= "4") {
    const optionIndex = Number(e.key) - 1;
    if (currentOptions[optionIndex]) selectOption(optionIndex);
  }

  if (e.key === "Enter") checkAnswer();
});
