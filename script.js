const LEVELS = [
  { a: 1,  b: 1, inputs: [1, 2, 3, 4] },
  { a: 2,  b: 0, inputs: [1, 2, 3, 4] },
  { a: 2,  b: 1, inputs: [1, 2, 3, 4] },
  { a: -1, b: 5, inputs: [0, 1, 2, 3] },
  { a: 3,  b: -2, inputs: [1, 2, 3, 4] },
  { a: -2, b: 8, inputs: [0, 1, 2, 3] },
];

const HINTS = [
  "Observe se os valores crescem sempre na mesma proporção.",
  "O parâmetro a controla a inclinação/crescimento da função.",
  "O parâmetro b desloca todos os resultados para cima ou para baixo.",
  "Compare o primeiro input com o primeiro output.",
  "Se os outputs diminuem quando os inputs aumentam, a pode ser negativo.",
  "Quando x = 0, f(0) = b. Use isso para encontrar b.",
  "A diferença entre outputs consecutivos é igual ao valor de a.",
  "Tente calcular: (output - b) / input para encontrar a.",
];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

let currentLevel = 0;
let totalAttempts = 0;
let levelAttempts = 0;
let hintIndex = 0;

const $ = (id) => document.getElementById(id);

const sliderA = $("slider-a");
const sliderB = $("slider-b");
const valueA = $("value-a");
const valueB = $("value-b");
const displayA = $("display-a");
const displayB = $("display-b");
const inputsEl = $("inputs");
const expectedEl = $("expected-outputs");
const calculatedEl = $("calculated-outputs");
const feedbackPanel = $("feedback");
const feedbackText = $("feedback-text");
const levelDisplay = $("level-display");
const levelTotal = $("level-total");
const attemptsEl = $("attempts");
const progressFill = $("progress-fill");

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
}

function playSound(type) {
  try {
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
    // Web Audio not available
  }
}

let typingInterval = null;

function typeText(element, text, speed = 20) {
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
  else str += a + "x";

  if (b > 0) str += " + " + b;
  else if (b < 0) str += " - " + Math.abs(b);

  return str;
}

function loadLevel(index) {
  const level = LEVELS[index];
  levelAttempts = 0;
  hintIndex = 0;

  sliderA.value = 0;
  sliderB.value = 0;

  levelDisplay.textContent = String(index + 1).padStart(2, "0");
  levelTotal.textContent = String(LEVELS.length).padStart(2, "0");
  attemptsEl.textContent = totalAttempts;
  progressFill.style.width = ((index / LEVELS.length) * 100) + "%";

  inputsEl.innerHTML = "";
  expectedEl.innerHTML = "";
  calculatedEl.innerHTML = "";

  level.inputs.forEach((x) => {
    const inputCell = document.createElement("div");
    inputCell.className = "signal-cell input-cell";
    inputCell.textContent = x;
    inputsEl.appendChild(inputCell);

    const expectedCell = document.createElement("div");
    expectedCell.className = "signal-cell expected-cell";
    expectedCell.textContent = level.a * x + level.b;
    expectedEl.appendChild(expectedCell);

    const calcCell = document.createElement("div");
    calcCell.className = "signal-cell calc-cell";
    calcCell.textContent = "?";
    calculatedEl.appendChild(calcCell);
  });

  hideFeedback();
  updateParams();
}

function updateParams() {
  const a = parseInt(sliderA.value);
  const b = parseInt(sliderB.value);
  valueA.textContent = a;
  valueB.textContent = b;
  displayA.textContent = a;
  displayB.textContent = b;
  updateCalculated();
}

function updateCalculated() {
  const a = parseInt(sliderA.value);
  const b = parseInt(sliderB.value);
  const level = LEVELS[currentLevel];
  const cells = calculatedEl.querySelectorAll(".signal-cell");
  const expectedCells = expectedEl.querySelectorAll(".signal-cell");

  level.inputs.forEach((x, i) => {
    const result = a * x + b;
    cells[i].textContent = result;
    cells[i].classList.remove("match", "mismatch");
  });
}

function hideFeedback() {
  feedbackPanel.classList.add("hidden");
  feedbackPanel.classList.remove("success", "error");
}

function showFeedback(message, isSuccess) {
  feedbackPanel.classList.remove("hidden", "success", "error");
  feedbackPanel.classList.add(isSuccess ? "success" : "error");
  typeText(feedbackText, message, 15);
}

function checkAnswer() {
  const a = parseInt(sliderA.value);
  const b = parseInt(sliderB.value);
  const level = LEVELS[currentLevel];

  if (a === level.a && b === level.b) {
    playSound("success");

    const panel = document.querySelector(".panel-signal");
    panel.classList.add("success-flash");
    setTimeout(() => panel.classList.remove("success-flash"), 800);

    const cells = calculatedEl.querySelectorAll(".signal-cell");
    cells.forEach((c) => {
      c.classList.remove("mismatch");
      c.classList.add("match");
    });

    const funcStr = formatFunction(level.a, level.b);
    const msg = `> SINAL DECODIFICADO!\n\nA função era ${funcStr}.\nO valor de a (${level.a}) multiplica cada entrada e o valor de b (${level.b}) ajusta o resultado final.`;

    showFeedback(msg, true);

    setTimeout(() => {
      currentLevel++;
      if (currentLevel >= LEVELS.length) {
        endGame();
      } else {
        loadLevel(currentLevel);
      }
    }, 3000);
  } else {
    playSound("error");
    totalAttempts++;
    levelAttempts++;
    attemptsEl.textContent = totalAttempts;

    const cells = calculatedEl.querySelectorAll(".signal-cell");
    const expectedCells = expectedEl.querySelectorAll(".signal-cell");

    level.inputs.forEach((x, i) => {
      const result = a * x + b;
      const expected = level.a * x + level.b;
      if (result !== expected) {
        cells[i].classList.add("mismatch");
      }
    });

    const hint = HINTS[hintIndex % HINTS.length];
    hintIndex++;

    let msg = `> SINAL REJEITADO.\n\nSua função: f(x) = ${a}x + ${b}\n`;

    if (a !== level.a && b !== level.b) {
      msg += "Tanto a quanto b estão incorretos.\n";
    } else if (a !== level.a) {
      msg += "O parâmetro b está correto, mas a está errado.\n";
    } else {
      msg += "O parâmetro a está correto, mas b está errado.\n";
    }

    msg += `\nDica: ${hint}`;

    showFeedback(msg, false);
  }
}

function showHint() {
  playSound("click");
  const level = LEVELS[currentLevel];
  const expectedFirst = level.a * level.inputs[0] + level.b;
  const expectedSecond = level.a * level.inputs[1] + level.b;
  const diff = expectedSecond - expectedFirst;

  let hint = `> DICA DO SISTEMA\n\n`;
  hint += `A diferença entre outputs consecutivos é ${diff}.\n`;
  hint += `Isso significa que a = ${diff}.\n`;
  hint += `Se a = ${diff}, então b = output - (a × input).\n`;
  hint += `Tente: b = ${expectedFirst} - (${diff} × ${level.inputs[0]}) = ${expectedFirst - diff * level.inputs[0]}`;

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
      rating = "CLASSIFICAÇÃO: ELITE HACKER — Zero erros. Impressionante.";
    } else if (totalAttempts <= 3) {
      rating = "CLASSIFICAÇÃO: HACKER AVANÇADO — Poucos erros. Excelente desempenho.";
    } else if (totalAttempts <= 8) {
      rating = "CLASSIFICAÇÃO: HACKER INTERMEDIÁRIO — Bom trabalho, continue praticando.";
    } else {
      rating = "CLASSIFICAÇÃO: HACKER INICIANTE — Cada erro é aprendizado. Tente novamente!";
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

// Event listeners
$("btn-start").addEventListener("click", () => {
  audioCtx.resume();
  playSound("click");
  showScreen("screen-game");
  loadLevel(0);
});

$("btn-execute").addEventListener("click", checkAnswer);
$("btn-hint").addEventListener("click", showHint);
$("btn-restart").addEventListener("click", () => {
  playSound("click");
  resetGame();
});

sliderA.addEventListener("input", updateParams);
sliderB.addEventListener("input", updateParams);

document.querySelectorAll(".btn-adjust").forEach((btn) => {
  btn.addEventListener("click", () => {
    playSound("click");
    const param = btn.dataset.param;
    const delta = parseInt(btn.dataset.delta);
    const slider = param === "a" ? sliderA : sliderB;
    const newVal = Math.max(-10, Math.min(10, parseInt(slider.value) + delta));
    slider.value = newVal;
    updateParams();
  });
});

document.addEventListener("keydown", (e) => {
  if (!$("screen-game").classList.contains("active")) return;
  if (e.key === "Enter") checkAnswer();
});
