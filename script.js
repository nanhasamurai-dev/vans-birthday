// Configuration: personalize here
const CONFIG = {
  solutionWord: "AWAKE", // e.g., "CAKE"; null -> use daily/random
  maxGuesses: 6,
  wordLength: 5,
  friendName: "Vans",
  birthdayMessage: "Wishing you a day as amazing as you are!",
  galleryImages: [
    // Place image paths in `assets/` and list them here
    // "assets/photo1.jpg",
    // "assets/photo2.jpg",
  ],
  videoEmbedHtml: "", // e.g., '<iframe src="https://www.youtube.com/embed/xyz" allowfullscreen></iframe>'
};

// Allow URL overrides like ?name=Alex&word=CAKE
const params = new URLSearchParams(location.search);
if (params.get("name")) CONFIG.friendName = params.get("name");
if (params.get("msg")) CONFIG.birthdayMessage = params.get("msg");
if (params.get("word")) CONFIG.solutionWord = params.get("word").toUpperCase();

// Minimal 5-letter dictionary and allowed guesses (can be expanded)
const WORDS = [
  "HEART","SMILE","PARTY","CAKES","LOVED","HAPPY","BRAVE","CHEER","STARS","LIGHT",
  "SWEET","GRACE","SPARK","MAGIC","DANCE","SMASH","GIFTS","KISSES","BLOSS","BERRY","AWAKE"
];

// If custom solution is invalid length, fall back to random
function pickSolution() {
  const override = CONFIG.solutionWord;
  if (override && override.length === CONFIG.wordLength && /^[A-Z]+$/.test(override)) {
    return override;
  }
  const seed = new Date().toISOString().slice(0,10);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return WORDS[hash % WORDS.length];
}

const state = {
  solution: pickSolution(),
  currentRow: 0,
  currentCol: 0,
  grid: Array.from({ length: CONFIG.maxGuesses }, () => Array(CONFIG.wordLength).fill("")),
  statuses: new Map(), // letter -> "correct" | "present" | "absent"
  gameOver: false
};

const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const toast = document.getElementById("toast");
const helpBtn = document.getElementById("helpBtn");
const howto = document.getElementById("howto");
const reveal = document.getElementById("reveal");
const revealTitle = document.getElementById("revealTitle");
const revealMessage = document.getElementById("revealMessage");
const revealGallery = document.getElementById("revealGallery");
const revealVideoContainer = document.getElementById("revealVideoContainer");
const confettiCanvas = document.getElementById("confetti");

// Build board
function renderBoard() {
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${CONFIG.wordLength}, 1fr)`;
  for (let r = 0; r < CONFIG.maxGuesses; r++) {
    for (let c = 0; c < CONFIG.wordLength; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${r}-${c}`;
      tile.textContent = state.grid[r][c];
      board.appendChild(tile);
    }
  }
}

// Build keyboard
function renderKeyboard() {
  const rows = ["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];
  keyboard.innerHTML = "";
  rows.forEach((row, i) => {
    for (const ch of row) addKey(ch);
    if (i === 0) addSpacer(0);
    if (i === 1) addKey("ENTER", true);
  });
  addKey("⌫", true);

  function addSpacer(span) {
    const s = document.createElement("div");
    s.style.gridColumn = `span ${span}`;
    keyboard.appendChild(s);
  }
  function addKey(label, wide = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `key${wide ? " key--wide" : ""}`;
    btn.textContent = label;
    btn.setAttribute("data-key", label);
    btn.addEventListener("click", () => onKey(label));
    keyboard.appendChild(btn);
  }
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("toast--show");
  setTimeout(() => toast.classList.remove("toast--show"), 1100);
}

function onKey(k) {
  if (state.gameOver) return;
  if (k === "ENTER") return onEnter();
  if (k === "⌫") return onBackspace();
  if (/^[A-Z]$/.test(k)) return onLetter(k);
}

function onLetter(ch) {
  if (state.currentCol >= CONFIG.wordLength) return;
  state.grid[state.currentRow][state.currentCol] = ch;
  updateTile(state.currentRow, state.currentCol, ch);
  state.currentCol++;
}

function onBackspace() {
  if (state.currentCol === 0) return;
  state.currentCol--;
  state.grid[state.currentRow][state.currentCol] = "";
  updateTile(state.currentRow, state.currentCol, "");
}

function updateTile(r, c, ch) {
  const tile = document.getElementById(`tile-${r}-${c}`);
  if (tile) tile.textContent = ch;
}

function onEnter() {
  if (state.currentCol < CONFIG.wordLength) {
    showToast("Not enough letters");
    return;
  }
  const guess = state.grid[state.currentRow].join("");
  if (!isValidGuess(guess)) {
    showToast("Not in list");
    return;
  }
  const result = evaluateGuess(guess, state.solution);
  revealRow(result);
  updateKeyboardStatuses(result);

  if (guess === state.solution) {
    winSequence();
    return;
  }
  state.currentRow++;
  state.currentCol = 0;
  if (state.currentRow >= CONFIG.maxGuesses) {
    state.gameOver = true;
    showToast(state.solution);
  }
}

function isValidGuess(word) {
  return WORDS.includes(word);
}

function evaluateGuess(guess, solution) {
  const result = Array(CONFIG.wordLength).fill({ status: "absent", letter: "" });
  const remaining = {};
  for (let i = 0; i < CONFIG.wordLength; i++) {
    const s = solution[i];
    remaining[s] = (remaining[s] || 0) + 1;
  }
  // First pass: correct
  for (let i = 0; i < CONFIG.wordLength; i++) {
    const g = guess[i];
    if (g === solution[i]) {
      result[i] = { status: "correct", letter: g };
      remaining[g]--;
    } else {
      result[i] = { status: "", letter: g };
    }
  }
  // Second pass: present/absent
  for (let i = 0; i < CONFIG.wordLength; i++) {
    if (result[i].status) continue;
    const g = guess[i];
    if (remaining[g] > 0) {
      result[i] = { status: "present", letter: g };
      remaining[g]--;
    } else {
      result[i] = { status: "absent", letter: g };
    }
  }
  return result;
}

function revealRow(result) {
  const r = state.currentRow;
  result.forEach((cell, i) => {
    const tile = document.getElementById(`tile-${r}-${i}`);
    setTimeout(() => {
      tile.classList.add("tile--flip");
      setTimeout(() => {
        tile.classList.remove("tile--flip");
        tile.classList.add("tile--reveal", `tile--${cell.status}`);
      }, 150);
    }, i * 220);
  });
}

function updateKeyboardStatuses(result) {
  for (const { letter, status } of result) {
    const prev = state.statuses.get(letter);
    const rank = { absent: 0, present: 1, correct: 2 };
    if (!prev || rank[status] > rank[prev]) state.statuses.set(letter, status);
  }
  for (const [letter, status] of state.statuses.entries()) {
    const btn = keyboard.querySelector(`[data-key="${letter}"]`);
    if (!btn) continue;
    btn.classList.remove("key--ok","key--present","key--absent");
    if (status === "correct") btn.classList.add("key--ok");
    else if (status === "present") btn.classList.add("key--present");
    else btn.classList.add("key--absent");
  }
}

// Confetti
function startConfetti(durationMs = 5000) {
  const ctx = confettiCanvas.getContext("2d");
  let w, h; resize();
  const colors = ["#22c55e","#f59e0b","#60a5fa","#f43f5e","#a78bfa"];
  const pieces = Array.from({ length: 180 }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h,
    r: 6 + Math.random() * 6,
    c: colors[Math.floor(Math.random()*colors.length)],
    s: 2 + Math.random() * 3,
    a: Math.random() * Math.PI
  }));
  let running = true;
  setTimeout(() => running = false, durationMs);
  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);

  function resize() {
    w = confettiCanvas.width = window.innerWidth;
    h = confettiCanvas.height = window.innerHeight;
  }
  function loop() {
    const ctx2 = ctx;
    ctx2.clearRect(0,0,w,h);
    pieces.forEach(p => {
      p.y += p.s;
      p.x += Math.sin(p.y * 0.02) * 1.5;
      p.a += 0.03;
      ctx2.save();
      ctx2.translate(p.x, p.y);
      ctx2.rotate(p.a);
      ctx2.fillStyle = p.c;
      ctx2.fillRect(-p.r/2, -p.r/2, p.r, p.r);
      ctx2.restore();
      if (p.y > h + 20) p.y = -20;
    });
    if (running) requestAnimationFrame(loop);
  }
}

function populateReveal() {
  revealTitle.textContent = `Happy Birthday, ${CONFIG.friendName}!`;
  revealMessage.textContent = CONFIG.birthdayMessage;
  revealGallery.innerHTML = "";
  CONFIG.galleryImages.forEach(src => {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = src;
    img.alt = `${CONFIG.friendName} photo`;
    revealGallery.appendChild(img);
  });
  revealVideoContainer.innerHTML = CONFIG.videoEmbedHtml || "";
}

function winSequence() {
  state.gameOver = true;
  showToast("You got it!");
  setTimeout(() => {
    populateReveal();
    if (typeof reveal.showModal === "function") reveal.showModal();
    startConfetti(6000);
  }, 1000);
}

// Events
helpBtn.addEventListener("click", () => {
  if (typeof howto.showModal === "function") howto.showModal();
});
document.addEventListener("keydown", (e) => {
  if (state.gameOver) return;
  const k = e.key.toUpperCase();
  if (k === "ENTER") onEnter();
  else if (k === "BACKSPACE") onBackspace();
  else if (/^[A-Z]$/.test(k)) onLetter(k);
});

const shareBtn = document.getElementById("shareBtn");
shareBtn.addEventListener("click", async () => {
  const text = `I solved a birthday Wordle for ${CONFIG.friendName}!`;
  try {
    if (navigator.share) {
      await navigator.share({ text, url: location.href });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      showToast("Link copied!");
    }
  } catch {}
});

// Initialize
renderBoard();
renderKeyboard();
