// Configuration: personalize here
const CONFIG = {
  solutionWord: "AWAKE", // e.g., "CAKE"; null -> use daily/random
  maxGuesses: 6,
  wordLength: 5,
  friendName: "Vans",
  birthdayMessage: "Wishing you a day as amazing as you are!",
  galleryImages: [
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=300&h=300&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300&h=300&fit=crop&crop=face",
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face"
  ],
  videoEmbedHtml: '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Birthday Video" allowfullscreen></iframe>'
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

// Build keyboard - exact NYT Wordle layout
function renderKeyboard() {
  keyboard.innerHTML = "";
  
  // Row 1: Q W E R T Y U I O P
  const row1 = document.createElement("div");
  row1.className = "keyboard-row";
  "QWERTYUIOP".split("").forEach(ch => addKey(ch, row1));
  keyboard.appendChild(row1);
  
  // Row 2: A S D F G H J K L + ENTER
  const row2 = document.createElement("div");
  row2.className = "keyboard-row";
  "ASDFGHJKL".split("").forEach(ch => addKey(ch, row2));
  addKey("ENTER", row2, true);
  keyboard.appendChild(row2);
  
  // Row 3: Z X C V B N M + BACKSPACE
  const row3 = document.createElement("div");
  row3.className = "keyboard-row";
  "ZXCVBNM".split("").forEach(ch => addKey(ch, row3));
  addKey("⌫", row3, true);
  keyboard.appendChild(row3);

  function addKey(label, container, wide = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `key${wide ? " key--wide" : ""}`;
    btn.textContent = label;
    btn.setAttribute("data-key", label);
    btn.addEventListener("click", () => onKey(label));
    container.appendChild(btn);
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
  const tile = document.getElementById(`tile-${state.currentRow}-${state.currentCol}`);
  if (tile) tile.classList.add("tile--pop");
  setTimeout(() => tile && tile.classList.remove("tile--pop"), 120);
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
    rowShake(state.currentRow);
    showToast("Not enough letters");
    return;
  }
  const guess = state.grid[state.currentRow].join("");
  // Remove word list validation - accept any 5-letter word like NYT Wordle
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

function rowShake(r) {
  // Add a temporary wrapper class to trigger shake
  const start = r * CONFIG.wordLength;
  const tiles = [];
  for (let i = 0; i < CONFIG.wordLength; i++) tiles.push(document.getElementById(`tile-${r}-${i}`));
  tiles.forEach(t => t && t.parentElement && t.parentElement.classList && t.parentElement.classList.add("row--shake"));
  // Fallback: apply directly to tiles
  tiles.forEach(t => t && t.classList.add("tile--shake"));
  setTimeout(() => {
    tiles.forEach(t => t && t.parentElement && t.parentElement.classList && t.parentElement.classList.remove("row--shake"));
    tiles.forEach(t => t && t.classList.remove("tile--shake"));
  }, 450);
}

// Removed isValidGuess function - NYT Wordle accepts any 5-letter word

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
      tile.classList.add("tile--flip-in");
      setTimeout(() => {
        tile.classList.remove("tile--flip-in");
        tile.classList.add(`tile--${cell.status}`);
        tile.classList.add("tile--flip-out");
        setTimeout(() => tile.classList.remove("tile--flip-out"), 160);
      }, 150);
    }, i * 350);
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

// Birthday jingle sound
function playBirthdayJingle() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const notes = [
    {freq: 523.25, duration: 200}, // C5
    {freq: 523.25, duration: 200}, // C5
    {freq: 659.25, duration: 400}, // E5
    {freq: 523.25, duration: 400}, // C5
    {freq: 698.46, duration: 400}, // F5
    {freq: 659.25, duration: 800}, // E5
  ];
  
  let startTime = audioContext.currentTime;
  notes.forEach((note, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(note.freq, startTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, startTime + note.duration / 1000);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + note.duration / 1000);
    
    startTime += note.duration / 1000;
  });
}

// Confetti
function startConfetti(durationMs = 5000) {
  const ctx = confettiCanvas.getContext("2d");
  let w, h; resize();
  const colors = ["#dc143c","#ffd700","#ffffff","#ff6b6b","#4ecdc4"];
  const pieces = Array.from({ length: 220 }, () => ({
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

function createFloatingPhotos() {
  const photos = [];
  CONFIG.galleryImages.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${CONFIG.friendName} photo`;
    img.className = "floating-photo";
    img.style.cssText = `
      position: fixed;
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: 50%;
      border: 3px solid var(--ferrari-gold);
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
      z-index: 1000;
      pointer-events: none;
      left: ${20 + (index * 15)}%;
      top: ${30 + (index * 10)}%;
      animation: float-around 4s ease-in-out infinite;
      animation-delay: ${index * 0.5}s;
    `;
    document.body.appendChild(img);
    photos.push(img);
  });
  
  // Remove photos after animation
  setTimeout(() => {
    photos.forEach(img => img.remove());
    showSurprisePopup();
  }, 5000);
}

function showSurprisePopup() {
  const popup = document.createElement("div");
  popup.className = "surprise-popup";
  popup.innerHTML = `
    <div class="surprise-content">
      <h3>🎉 Click here for surprise! 🎉</h3>
      <p>Special birthday video awaits!</p>
    </div>
  `;
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, var(--ferrari-red), var(--ferrari-gold));
    color: white;
    padding: 30px;
    border-radius: 20px;
    text-align: center;
    cursor: pointer;
    z-index: 2000;
    box-shadow: 0 0 30px rgba(220, 20, 60, 0.8);
    animation: pulse-glow 2s ease-in-out infinite;
  `;
  
  popup.addEventListener("click", () => {
    popup.remove();
    showVideoModal();
  });
  
  document.body.appendChild(popup);
}

function showVideoModal() {
  const videoModal = document.createElement("dialog");
  videoModal.className = "video-modal";
  videoModal.innerHTML = `
    <form method="dialog">
      <h2>🎬 Birthday Video for ${CONFIG.friendName}! 🎬</h2>
      <div class="video-container">
        ${CONFIG.videoEmbedHtml}
      </div>
      <menu>
        <button class="btn">Close</button>
      </menu>
    </form>
  `;
  videoModal.style.cssText = `
    border: none;
    border-radius: 12px;
    padding: 20px;
    background: var(--ferrari-black);
    color: var(--text);
    max-width: 800px;
    width: 90vw;
  `;
  videoModal.style.setProperty("::backdrop", "background: rgba(0,0,0,0.8)");
  
  document.body.appendChild(videoModal);
  if (typeof videoModal.showModal === "function") {
    videoModal.showModal();
  }
  
  videoModal.addEventListener("close", () => {
    videoModal.remove();
  });
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
  revealVideoContainer.innerHTML = ""; // Video now handled separately
}

function winSequence() {
  state.gameOver = true;
  showToast("🏎️ Checkered flag! 🏁");
  setTimeout(() => {
    document.body.classList.add("celebrate");
    playBirthdayJingle();
    startConfetti(6000);
    
    // Slow transition with animated photos
    setTimeout(() => {
      createFloatingPhotos();
    }, 2000);
    
    // Show birthday modal after photos
    setTimeout(() => {
      populateReveal();
      if (typeof reveal.showModal === "function") reveal.showModal();
    }, 3000);
  }, 800);
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
