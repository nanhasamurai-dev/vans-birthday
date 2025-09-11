// Configuration: personalize here
const CONFIG = {
  solutionWord: "AWAKE", // e.g., "CAKE"; null -> use daily/random
  maxGuesses: 6,
  wordLength: 5,
  friendName: "Vans",
  birthdayMessage: "Wishing you a day as amazing as you are!",
  galleryImages: [
    "assets/vans1.jpg",
    "assets/vans2.jpg", 
    "assets/vans3.jpg",
    "assets/vans4.jpg",
    "assets/vans5.jpg",
    "assets/vans6.jpg",
    "assets/vans7.jpg",
    "assets/vans8.jpg"
  ],
  videoEmbedHtml: '<iframe id="vimeoPlayer" src="https://player.vimeo.com/video/1117547643?autopause=1&playsinline=1&title=0&byline=0&portrait=0" style="width:100%;aspect-ratio:9/16;height:auto;max-height:80vh;border:0;border-radius:12px;background:#000" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" allowfullscreen webkitallowfullscreen mozallowfullscreen title="Happy Birthday Vans !!!!!"></iframe>'
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
    // Hide hint and keyboard after game is over (loss case)
    const hint = document.getElementById('hint');
    const keyboard = document.getElementById('keyboard');
    if (hint) hint.style.display = 'none';
    if (keyboard) keyboard.style.display = 'none';
    // Show play again option after loss
    setTimeout(() => {
      showPlayAgainPopup();
    }, 2000);
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

// Keyboard sound for letter lighting
function playKeyboardSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
}

// Add game sound effects
function playGameSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    if (type === 'bounce') {
      // Ball bounce sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === 'paddle') {
      // Paddle hit sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    }
  } catch (e) {
    // Silently fail if audio context not available
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
  const wrappers = [];
  const tiltAnimations = [
    'threeD-tilt-a',
    'threeD-tilt-b',
    'threeD-tilt-c',
    'threeD-tilt-d'
  ];
  // Build a larger pool of unique click effects and shuffle assignment
  const baseEffects = [
    (el, v, strongGlow, softGlow) => { el.style.animation = 'none'; el.style.transition = 'transform 1.1s cubic-bezier(0.19,1,0.22,1), box-shadow 1.1s'; el.style.transform = `scale(${1.7+v}) rotate(${360+180*v}deg)`; el.style.boxShadow = `0 0 80px ${strongGlow}, 0 0 140px ${softGlow}`; },
    (el, v, strongGlow, softGlow) => { el.style.animation = 'none'; el.style.transition = 'transform 1s ease, box-shadow 1s'; el.style.transform = `rotateY(${540+90*v}deg) scale(${1.5+0.2*v})`; el.style.boxShadow = `0 0 80px ${strongGlow}, 0 0 140px ${softGlow}`; },
    (el, v, strongGlow, softGlow) => { el.style.animation = 'none'; el.style.transition = 'transform 900ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 900ms'; el.style.transform = `translate(${(-30+60*v)}px, -50px) scale(${1.8+0.1*v})`; el.style.boxShadow = `0 0 90px ${strongGlow}, 0 0 150px ${softGlow}`; },
    (el, v, strongGlow, softGlow) => { el.style.animation = 'none'; el.style.transition = 'transform 1.1s ease, filter 1.1s, box-shadow 1.1s'; el.style.transform = `rotate(${540+180*v}deg) skew(${4+2*v}deg, ${4+2*v}deg) scale(${1.7+0.1*v})`; el.style.filter = 'saturate(1.4)'; el.style.boxShadow = `0 0 100px ${strongGlow}, 0 0 160px ${softGlow}`; },
    (el, v, strongGlow, softGlow) => { el.style.animation = 'none'; el.style.transition = 'transform 1s ease, box-shadow 1s'; el.style.transform = `perspective(700px) rotateX(${20+10*v}deg) rotateY(${20+10*v}deg) scale(${1.75+0.1*v})`; el.style.boxShadow = `0 20px 90px rgba(0,0,0,0.5), 0 0 100px ${strongGlow}`; },
    (el, v, strongGlow, softGlow) => { el.style.animation = 'none'; el.style.transition = 'transform 1s ease, box-shadow 1s'; el.style.transform = `translate(${(-60+120*v)}px, ${-20+30*v}px) rotate(${300+60*v}deg) scale(${1.6+0.2*v})`; el.style.boxShadow = `0 0 95px ${strongGlow}, 0 0 150px ${softGlow}`; }
  ];
  const effectOrder = [];
  const total = CONFIG.galleryImages.length;
  while (effectOrder.length < total) {
    for (let i = 0; i < baseEffects.length && effectOrder.length < total; i++) effectOrder.push(i);
  }
  // Fisher-Yates shuffle for uniqueness across photos
  for (let i = effectOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [effectOrder[i], effectOrder[j]] = [effectOrder[j], effectOrder[i]];
  }
  // Define size classifications
  const sizeClasses = [
    { name: 'small', baseSize: 80, range: 20 },    // 70-90px
    { name: 'medium', baseSize: 110, range: 20 },  // 100-120px
    { name: 'large', baseSize: 140, range: 20 },   // 130-150px
    { name: 'xlarge', baseSize: 170, range: 20 }   // 160-180px
  ];
  
  // Ensure at least one photo from each size class
  const photoSizeAssignments = [];
  CONFIG.galleryImages.forEach((src, index) => {
    const guaranteedClass = index < sizeClasses.length ? index : Math.floor(Math.random() * sizeClasses.length);
    photoSizeAssignments.push(guaranteedClass);
  });
  
  CONFIG.galleryImages.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${CONFIG.friendName} photo`;
    img.className = "floating-photo";
    
    // Assign size class
    const sizeClassIndex = photoSizeAssignments[index];
    const sizeClass = sizeClasses[sizeClassIndex];
    const baseSize = sizeClass.baseSize + Math.random() * sizeClass.range - sizeClass.range/2;
    const size = Math.max(60, Math.min(200, baseSize));
    
    const leftPos = Math.max(0, Math.random() * (window.innerWidth - size));
    const topPos = Math.max(0, Math.random() * (window.innerHeight - size));
    // Randomized glow colors and border colors (HSL-based with alpha)
    const hue = Math.floor(Math.random() * 360);
    const strongGlow = `hsla(${hue} 100% 60% / 1)`;
    const softGlow = `hsla(${(hue + 30) % 360} 100% 60% / 0.6)`;
    const borderColor = `hsla(${hue} 90% 65% / 1)`;
    
    const tiltAnim = tiltAnimations[Math.floor(Math.random() * tiltAnimations.length)];
    const duration = 10 + Math.random() * 8; // unused for path now
    const delay = Math.random() * 0.6; // tiny stagger for tilt/glow
    const tiltDuration = 6 + Math.random() * 5; // 6-11s tilt
    
    // Create wrapper to carry path transform so image tilt can compose in 3D
    const wrap = document.createElement('div');
    wrap.className = 'floating-photo-wrap';
    wrap.style.cssText = `
      position: fixed;
      left: 0px;
      top: 0px;
      width: ${size}px;
      height: ${size}px;
      z-index: 1000;
      pointer-events: auto;
      will-change: transform;
      transform: translate3d(${leftPos}px, ${topPos}px, 0);
      transform-style: preserve-3d;
      -webkit-transform: translate3d(${leftPos}px, ${topPos}px, 0);
      -webkit-transform-style: preserve-3d;
      --ph-size: ${size}px;
    `;

    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      border: 4px solid ${borderColor};
      box-shadow: 0 0 25px ${softGlow}, 0 0 50px ${strongGlow};
      cursor: pointer;
      will-change: transform;
      transform-style: preserve-3d;
      transition: all 0.3s ease-out;
      animation: photo-glow 4s ease-in-out infinite, ${tiltAnim} ${(tiltDuration + 2)}s ease-in-out infinite alternate;
      animation-delay: ${delay}s;
    `;
    // Unique click animations per photo, guaranteed assignment
    const baseIndex = effectOrder[index] % baseEffects.length;
    const variant = (index % 3) / 3; // small per-photo variation
    let isAnimating = false;
    img.addEventListener("click", () => {
      if (isAnimating) return;
      isAnimating = true;
      const prevZ = wrap.style.zIndex;
      wrap.style.zIndex = '2001';
      // Randomly pick a dramatic effect on click
      const dramatic = Math.floor(Math.random()*3);
      if (dramatic === 0) {
        // Hyper spin
        img.style.animation = 'none';
        img.style.transition = 'transform 900ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 900ms';
        img.style.transform = 'scale(2) rotate(1080deg)';
        img.style.boxShadow = `0 0 90px ${strongGlow}, 0 0 160px ${softGlow}`;
      } else if (dramatic === 1) {
        // Proper fold: flip 0 -> 90, swap, then 90 -> 180
        img.style.animation = 'none';
        img.style.backfaceVisibility = 'hidden';
        img.style.transformStyle = 'preserve-3d';
        img.style.transition = 'transform 350ms ease';
        img.style.transform = 'rotateY(90deg)';
        setTimeout(() => {
          const nextIdx = (index + 1) % CONFIG.galleryImages.length;
          img.src = CONFIG.galleryImages[nextIdx];
          // continue the fold to show opposite side
          img.style.transition = 'transform 350ms ease';
          img.style.transform = 'rotateY(180deg)';
          setTimeout(() => {
            // reset back to 0 for future folds
            img.style.transition = 'transform 0ms';
            img.style.transform = 'rotateY(0deg)';
          }, 360);
        }, 360);
      } else {
        // Bounce to opposite wall then back, swap image on each contact
        wrap.style.transition = 'transform 700ms cubic-bezier(0.34,1.56,0.64,1)';
        const toRight = (parseFloat(wrap.style.left) || 0) < window.innerWidth/2;
        const targetX = toRight ? (window.innerWidth - size - 10) : 10;
        const targetY = (parseFloat(wrap.style.top) || 0) < window.innerHeight/2 ? (window.innerHeight - size - 10) : 10;
        wrap.style.transform = `translate(${targetX - leftPos}px, 0)`;
        setTimeout(() => {
          img.src = CONFIG.galleryImages[(index + 1) % CONFIG.galleryImages.length];
          wrap.style.transform = `translate(${targetX - leftPos}px, ${targetY - topPos}px)`;
          setTimeout(() => {
            img.src = CONFIG.galleryImages[(index + 2) % CONFIG.galleryImages.length];
            wrap.style.transform = 'translate(0, 0)';
          }, 720);
        }, 720);
      }
      try { baseEffects[baseIndex](img, variant, strongGlow, softGlow); } catch {}
      setTimeout(() => {
        img.style.animation = `photo-glow 3s ease-in-out infinite, photo-bounce 2s ease-in-out infinite, ${tiltAnim} ${tiltDuration}s ease-in-out infinite alternate`;
        img.style.transform = "";
        img.style.transition = "";
        img.style.filter = "";
        img.style.boxShadow = `0 0 25px ${softGlow}, 0 0 50px ${strongGlow}`;
        wrap.style.zIndex = prevZ;
        isAnimating = false;
      }, 1200);
    });
    
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    // Physics state per wrapper - balanced speed for smooth but lively animation
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 80; // px/s
    const state = {
      wrap,
      img,
      x: leftPos,
      y: topPos,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      currentSizeClass: sizeClassIndex,
      targetSize: size,
      sizeTransitionSpeed: 0.02 + Math.random() * 0.03, // Random transition speed
      nextSizeChangeTime: performance.now() + 3000 + Math.random() * 5000, // 3-8 seconds
      nextIdx: (index + 1) % CONFIG.galleryImages.length
    };
    wrappers.push(state);
  });
  
  // Start physics loop once
  try {
    window._floatingPhotos = wrappers;
    if (!window._floatingPhotoLoop) {
      window._floatingPhotoLoop = true;
      startFloatingPhotoBounceLoop();
    }
  } catch {}
}

function startFloatingPhotoBounceLoop() {
  let last = performance.now();
  let frameCount = 0;
  
  // Force enable on mobile by checking user agent
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    console.log('Mobile device detected, enabling photo animations');
  }
  
  function step(now) {
    const dt = Math.min(16.67, now - last) / 1000; // cap at 60fps
    last = now;
    frameCount++;
    
    const states = window._floatingPhotos || [];
    const maxX = Math.max(0, window.innerWidth);
    const maxY = Math.max(0, window.innerHeight);
    
    // Skip if no photos or window dimensions are invalid
    if (states.length === 0 || maxX <= 0 || maxY <= 0) {
      if (window._floatingPhotoLoop) {
        requestAnimationFrame(step);
      }
      return;
    }
    
    // Size classifications for dynamic sizing
    const sizeClasses = [
      { name: 'small', baseSize: 80, range: 20 },
      { name: 'medium', baseSize: 110, range: 20 },
      { name: 'large', baseSize: 140, range: 20 },
      { name: 'xlarge', baseSize: 170, range: 20 }
    ];
    
    // Process all photos each frame for smoother animation
    states.forEach((s) => {
      if (!s || !s.wrap || s._inGame) return;
      
      // Force re-enable hardware acceleration on mobile
      if (!s.wrap.style.willChange || s.wrap.style.willChange === 'auto') {
        s.wrap.style.willChange = 'transform';
      }
      
      // Handle size transitions
      if (now >= s.nextSizeChangeTime) {
        // Ensure at least one photo from each size class exists
        const classCounts = [0, 0, 0, 0];
        states.forEach(state => {
          if (state && !state._inGame) classCounts[state.currentSizeClass]++;
        });
        
        // Find classes with no representatives
        const emptyClasses = classCounts.map((count, index) => count === 0 ? index : -1).filter(i => i >= 0);
        
        let newSizeClass;
        if (emptyClasses.length > 0) {
          // Assign to an empty class
          newSizeClass = emptyClasses[Math.floor(Math.random() * emptyClasses.length)];
        } else {
          // Random class change
          do {
            newSizeClass = Math.floor(Math.random() * sizeClasses.length);
          } while (newSizeClass === s.currentSizeClass && Math.random() > 0.3); // 70% chance to change class
        }
        
        s.currentSizeClass = newSizeClass;
        const newSizeClass_obj = sizeClasses[newSizeClass];
        s.targetSize = newSizeClass_obj.baseSize + Math.random() * newSizeClass_obj.range - newSizeClass_obj.range/2;
        s.targetSize = Math.max(60, Math.min(200, s.targetSize));
        s.nextSizeChangeTime = now + 4000 + Math.random() * 6000; // 4-10 seconds
      }
      
      // Smooth size transition
      if (Math.abs(s.size - s.targetSize) > 1) {
        const sizeDiff = s.targetSize - s.size;
        s.size += sizeDiff * s.sizeTransitionSpeed;
        
        // Update wrapper and image size
        s.wrap.style.width = `${s.size}px`;
        s.wrap.style.height = `${s.size}px`;
        s.wrap.style.setProperty('--ph-size', `${s.size}px`);
      }
      
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const right = maxX - s.size;
      const bottom = maxY - s.size;
      let bounced = false;

      if (s.x <= 1) { s.x = 1; s.vx = Math.abs(s.vx); }
      if (s.x >= right - 1) { s.x = right - 1; s.vx = -Math.abs(s.vx); }
      if (s.y <= 1) { s.y = 1; s.vy = Math.abs(s.vy); }
      else if (s.y >= bottom) { s.y = bottom; s.vy = -Math.abs(s.vy); bounced = true; }

      if (bounced && s.img) {
        try {
          s.img.src = CONFIG.galleryImages[s.nextIdx];
          s.nextIdx = (s.nextIdx + 1) % CONFIG.galleryImages.length;
        } catch {}
      }
      
      s.wrap.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      s.wrap.style.webkitTransform = `translate3d(${s.x}px, ${s.y}px, 0)`;
    });

    // Handle photo-photo collisions (elastic, equal mass)
    for (let i = 0; i < states.length; i++) {
      const a = states[i];
      if (!a || !a.wrap) continue;
      for (let j = i + 1; j < states.length; j++) {
        const b = states[j];
        if (!b || !b.wrap) continue;
        const ax = a.x + a.size / 2;
        const ay = a.y + a.size / 2;
        const bx = b.x + b.size / 2;
        const by = b.y + b.size / 2;
        const dx = bx - ax;
        const dy = by - ay;
        const distSq = dx * dx + dy * dy;
        const r = (a.size + b.size) / 2;
        if (distSq > 0 && distSq <= r * r) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const nx = dx / dist;
          const ny = dy / dist;
          // Relative velocity along normal
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const rvn = rvx * nx + rvy * ny;
          if (rvn < 0) {
            // Elastic collision, equal mass -> swap normal components
            const impulse = -rvn; // mass terms cancel for equal mass with e=1, split across both
            const jx = impulse * nx;
            const jy = impulse * ny;
            a.vx -= jx;
            a.vy -= jy;
            b.vx += jx;
            b.vy += jy;
            // Positional correction to resolve overlap
            const overlap = r - dist + 0.5; // small slop
            const corrX = nx * overlap * 0.5;
            const corrY = ny * overlap * 0.5;
            a.x -= corrX;
            a.y -= corrY;
            b.x += corrX;
            b.y += corrY;
            // Swap images on contact
            try {
              if (a.img) { a.img.src = CONFIG.galleryImages[a.nextIdx]; a.nextIdx = (a.nextIdx + 1) % CONFIG.galleryImages.length; }
              if (b.img) { b.img.src = CONFIG.galleryImages[b.nextIdx]; b.nextIdx = (b.nextIdx + 1) % CONFIG.galleryImages.length; }
            } catch {}
          }
        }
      }
    }
    if (window._floatingPhotoLoop) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// Turn a clicked photo into a mini game (breakout-like single paddle)
function enablePhotoBounceGameClicks() {
  try {
    const states = window._floatingPhotos || [];
    states.forEach((s) => {
      if (!s || !s.img || s._gameBound) return;
      s._gameBound = true;
      
      // Add click handler
      s.img.addEventListener('click', () => startPhotoPaddleGame(s));
      
      // Add double tap handler for mobile with better detection
      let tapCount = 0;
      let tapTimer = null;
      
      s.img.addEventListener('touchstart', (e) => {
        tapCount++;
        if (tapCount === 1) {
          tapTimer = setTimeout(() => {
            tapCount = 0; // Reset if no second tap
          }, 300);
        } else if (tapCount === 2) {
          clearTimeout(tapTimer);
          tapCount = 0;
          e.preventDefault();
          e.stopPropagation();
          startPhotoPaddleGame(s);
        }
      });
    });
  } catch {}
}

function startPhotoPaddleGame(state) {
  const wrap = state.wrap;
  const img = state.img;
  if (!wrap || !img) return;
  state._inGame = true;
  // Mark wrapper as in-game for CSS override
  wrap.setAttribute('data-in-game', 'true');
  // Bring game layer to top
  const prevZ = wrap.style.zIndex;
  wrap.style.zIndex = '3000';
  // Hide other photos entirely and stop their animations
  try {
    (window._floatingPhotos || []).forEach((s) => { 
      if (s !== state) { 
        const w = s.wrap; 
        if (w) {
          w.style.display = 'none';
          w.style.willChange = 'auto'; // Remove performance hint
        }
        if (s.img) {
          s.img.style.animation = 'none'; // Stop all animations
        }
      }
    });
  } catch {}
  
  // Hide hint and keyboard during bounce game
  const hint = document.getElementById('hint');
  const keyboard = document.getElementById('keyboard');
  if (hint) hint.style.display = 'none';
  if (keyboard) keyboard.style.display = 'none';

  // Create paddle
  const paddle = document.createElement('div');
  const paddleWidth = Math.max(80, Math.min(160, Math.floor(window.innerWidth * 0.24)));
  const paddleHeight = 14;
  paddle.style.cssText = `
    position: fixed;
    left: ${(window.innerWidth - paddleWidth) / 2}px;
    top: ${window.innerHeight - 28}px;
    width: ${paddleWidth}px;
    height: ${paddleHeight}px;
    background: linear-gradient(90deg, var(--ferrari-gold), #fff59e);
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    z-index: 3500;
  `;
  document.body.appendChild(paddle);

  // Control paddle with mouse/touch and arrow keys
  let paddleX = (window.innerWidth - paddleWidth) / 2;
  function setPaddle(x) {
    paddleX = Math.max(0, Math.min(window.innerWidth - paddleWidth, x));
    paddle.style.left = `${paddleX}px`;
  }
  function onMove(e) {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setPaddle(clientX - paddleWidth / 2);
  }
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  function onKey(e) {
    const step = 28;
    if (e.key === 'ArrowLeft') setPaddle(paddleX - step);
    else if (e.key === 'ArrowRight') setPaddle(paddleX + step);
  }
  window.addEventListener('keydown', onKey);

  // Ball uses the clicked photo wrapper - make it smaller for better gameplay
  let x = state.x;
  let y = state.y;
  let vx = Math.sign(state.vx || 1) || 1;
  let vy = Math.sign(state.vy || 1) || 1;
  const originalSpeed = Math.max(220, Math.hypot(state.vx, state.vy));
  let speed = originalSpeed;
  const originalSize = state.size;
  const size = Math.max(60, originalSize * 0.6); // Make photo 60% smaller, minimum 60px
  let lastSwap = 0;
  let running = true;
  let lastX = x, lastY = y;
  let score = 0;
  
  // Store original styles to restore later
  const originalAnimation = img.style.animation;
  const originalTransform = img.style.transform;
  const originalTransition = img.style.transition;
  const originalBoxShadow = img.style.boxShadow;
  const originalFilter = img.style.filter;
  
  // Completely remove all visual effects that could interfere with collision detection
  img.style.animation = 'none !important';
  img.style.transform = 'none !important';
  img.style.transition = 'none !important';
  img.style.boxShadow = 'none !important';
  img.style.filter = 'none !important';
  
  // Also remove wrapper effects
  wrap.style.animation = 'none !important';
  wrap.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) !important';
  
  // Resize the photo for gameplay
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  wrap.style.setProperty('--ph-size', `${size}px`);

  // Score UI
  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = `
    position: fixed; top: max(8px, env(safe-area-inset-top)); right: max(8px, env(safe-area-inset-right));
    z-index: 3600; color: var(--ferrari-gold); font-weight: 800; font-size: 14px;
    background: rgba(0,0,0,0.45); padding: 6px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);
  `;
  scoreEl.textContent = 'Score: 0';
  document.body.appendChild(scoreEl);

  let lastTime = performance.now();
  const gameStartTime = performance.now();
  
  function gameStep(currentTime) {
    if (!running) return;
    
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 1/30); // Cap at 30fps minimum
    lastTime = currentTime;
    
    // Update position
    x += vx * speed * deltaTime;
    y += vy * speed * deltaTime;
    
    // Score is now seconds played
    score = (currentTime - gameStartTime) / 1000;
    
    // Update score display every 100ms
    if (Math.floor(currentTime / 100) !== Math.floor((currentTime - deltaTime * 1000) / 100)) {
      scoreEl.textContent = `Time: ${score.toFixed(1)}s`;
    }
    
    const right = window.innerWidth - size;
    const bottom = window.innerHeight - size;
    
    // Wall collisions with proper boundary detection
    if (x <= 1) { x = 1; vx = Math.abs(vx); swapImage(); playGameSound('bounce'); }
    if (x >= right - 1) { x = right - 1; vx = -Math.abs(vx); swapImage(); playGameSound('bounce'); }
    if (y <= 1) { 
      y = 1; 
      vy = Math.abs(vy); 
      speed *= 1.08; // Gradual speed increase
      swapImage(); 
      playGameSound('bounce');
    }

    // Paddle collision - fixed to ensure photo border actually touches paddle
    const paddleTop = window.innerHeight - 28;
    const ballBottom = y + size;
    const ballCenterX = x + size / 2;
    const ballLeft = x;
    const ballRight = x + size;
    
    if (ballBottom >= paddleTop - 2 && ballBottom <= paddleTop + paddleHeight + 2 && 
        ballRight >= paddleX && ballLeft <= paddleX + paddleWidth) {
      // Ensure ball is exactly touching paddle top
      y = paddleTop - size;
      // Reflect with angle based on hit position
      const hitPos = (ballCenterX - paddleX) / paddleWidth - 0.5; // -0.5..0.5
      const angle = hitPos * (Math.PI / 2.5); // spread
      const speedMag = speed * 1.08; // Gradual speed increase
      vx = Math.sin(angle) * speedMag / speed;
      vy = -Math.cos(angle) * speedMag / speed;
      speed = speedMag;
      swapImage();
      playGameSound('paddle');
    }

    // Missed paddle -> end game
    if (y > bottom + 24) {
      endGame(false);
      return;
    }
    
    // Apply transform with hardware acceleration
    wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    wrap.style.webkitTransform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(gameStep);
  }
  
  requestAnimationFrame(gameStep);

  function swapImage() {
    const now = performance.now();
    if (now - lastSwap < 120) return; // throttle
    lastSwap = now;
    try {
      img.src = CONFIG.galleryImages[state.nextIdx];
      state.nextIdx = (state.nextIdx + 1) % CONFIG.galleryImages.length;
    } catch {}
  }

  function endGame(won) {
    running = false;
    
    // Save score to leaderboard
    const finalScore = Math.floor(score);
    saveScore(finalScore);
    
    // Show game over popup with final score
    showGameOverPopup(finalScore);
    
    // Restore other photos and their animations with full opacity
    try { 
      (window._floatingPhotos || []).forEach((s) => { 
        const w = s.wrap; 
        if (w) { 
          w.style.display = ''; 
          w.style.opacity = '1';
          w.style.willChange = 'transform'; // Re-enable performance hint
        }
        if (s.img && s !== state) {
          // Restart animations for other photos and ensure full opacity
          s.img.style.animation = '';
          s.img.style.opacity = '1';
        }
      }); 
    } catch {}
  
    // Show game menu instead of hint after bounce game
    setTimeout(() => {
      showGameMenu();
    }, 1000);
    // Remove paddle and listeners
    try { paddle.remove(); } catch {}
    try { scoreEl.remove(); } catch {}
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('keydown', onKey);
    // Restore photo to original size, effects, and position
    wrap.style.width = `${originalSize}px`;
    wrap.style.height = `${originalSize}px`;
    wrap.style.setProperty('--ph-size', `${originalSize}px`);
    
    // Restore original visual effects
    img.style.animation = originalAnimation;
    img.style.transform = originalTransform;
    img.style.transition = originalTransition;
    img.style.boxShadow = originalBoxShadow;
    img.style.filter = originalFilter;
    
    // Restore wrapper effects
    wrap.style.animation = '';
    
    // Restore this photo to physics pool with original speed
    state.x = Math.max(0, Math.min(window.innerWidth - originalSize, x));
    state.y = Math.max(0, Math.min(window.innerHeight - originalSize, y));
    state.vx = vx * originalSpeed; // Restore original speed
    state.vy = vy * originalSpeed;
    state.size = originalSize; // Restore original size to state
    wrap.style.zIndex = prevZ;
    wrap.removeAttribute('data-in-game');
    state._inGame = false;
  }
}

function showGameOverPopup(finalScore) {
  const popup = document.createElement("div");
  popup.className = "game-over-popup";
  popup.innerHTML = `
    <div class="game-over-content">
      <h2>🎮 Game Over! 🎮</h2>
      <div class="final-score">
        <span class="score-label">Final Score:</span>
        <span class="score-value">${finalScore}</span>
      </div>
      <p class="score-message">${getScoreMessage(finalScore)}</p>
      <div class="popup-buttons">
        <button class="play-again-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
          Play Again
        </button>
        <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
          Close
        </button>
      </div>
    </div>
  `;
  popup.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 4000;
    backdrop-filter: blur(5px);
  `;
  
  const content = popup.querySelector('.game-over-content');
  content.style.cssText = `
    background: linear-gradient(135deg, var(--ferrari-black), #2a0a0a);
    border: 2px solid var(--ferrari-gold);
    border-radius: 16px;
    padding: 30px;
    text-align: center;
    color: var(--text);
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.5), 0 0 60px rgba(220, 20, 60, 0.3);
    animation: popup-bounce 0.5s ease-out;
    max-width: 400px;
    width: 90vw;
  `;
  
  const scoreValue = popup.querySelector('.score-value');
  scoreValue.style.cssText = `
    font-size: 48px;
    font-weight: 800;
    color: var(--ferrari-gold);
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    display: block;
    margin: 10px 0;
  `;
  
  const playAgainBtn = popup.querySelector('.play-again-btn');
  playAgainBtn.style.cssText = `
    background: linear-gradient(135deg, var(--ferrari-red), #ff4757);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 20px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(220, 20, 60, 0.4);
  `;
  
  playAgainBtn.addEventListener('mouseenter', () => {
    playAgainBtn.style.transform = 'translateY(-2px)';
    playAgainBtn.style.boxShadow = '0 6px 20px rgba(220, 20, 60, 0.6)';
  });
  
  playAgainBtn.addEventListener('mouseleave', () => {
    playAgainBtn.style.transform = 'translateY(0)';
    playAgainBtn.style.boxShadow = '0 4px 15px rgba(220, 20, 60, 0.4)';
  });
  
  document.body.appendChild(popup);
  
  // Auto-remove after 10 seconds if user doesn't interact
  setTimeout(() => {
    if (popup.parentElement) {
      popup.remove();
    }
  }, 10000);
}

function getScoreMessage(score) {
  if (score >= 30) return "🎉 Yayyyyy! 🎉";
  if (score >= 15) return "👍 Do better! 👍";
  return "😬 Ewwwwww 😬";
}

function showSurprisePopup() {
  const popup = document.createElement("div");
  popup.className = "surprise-popup";
  popup.innerHTML = `
    <div class=\"surprise-content\" style=\"position: relative; display: inline-block;\">
      <img src=\"https://wallpapers.com/images/hd/charles-leclerc-pointing-up-f1b0dmr96gkgfeoa.jpg\" alt=\"Surprise\" style=\"display:block; width:min(92vw, 540px); height:auto; border-radius:12px;\" />
      <button type=\"button\" class=\"surprise-badge\" style=\"position:absolute; top:8px; left:50%; transform:translateX(-50%); background: rgba(0,0,0,0.55); color:#fff; padding:8px 12px; border-radius:10px; font-weight:800; font-size:12px; letter-spacing:0.02em; border:none; cursor:pointer; box-shadow: 0 0 14px var(--ferrari-red), 0 0 28px rgba(220,20,60,0.5);\">click here for the surprise</button>
    </div>
  `;
  popup.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    padding: 0;
    border-radius: 0;
    text-align: center;
    z-index: 2000;
    box-shadow: 0 0 0 rgba(0,0,0,0);
    opacity: 0;
    transition: opacity 1400ms ease;
  `;
  
  // Ferrari red glow pulse on badge
  const badge = popup.querySelector('.surprise-badge');
  let glowUp = true;
  const glowTimer = setInterval(() => {
    if (!badge) return;
    if (glowUp) {
      badge.style.boxShadow = '0 0 20px var(--ferrari-red), 0 0 40px rgba(220,20,60,0.7)';
    } else {
      badge.style.boxShadow = '0 0 10px var(--ferrari-red), 0 0 20px rgba(220,20,60,0.5)';
    }
    glowUp = !glowUp;
  }, 600);

  // Only the badge opens the video
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    clearInterval(glowTimer);
    popup.remove();
    showVideoModal();
  });
  
  document.body.appendChild(popup);
  return popup;
}

function showVideoModal() {
  const videoModal = document.createElement("dialog");
  videoModal.className = "video-modal";
  videoModal.innerHTML = `
    <form method="dialog">
      <h2>🎬 Happy Birthday Vans !!!!! 🎬</h2>
      <div class="video-container">
        ${CONFIG.videoEmbedHtml}
      </div>
      <menu>
        <button class="btn close-video-btn" style="background: #ffd700; color: #000; border: 2px solid #ffd700;">Close</button>
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
  
  const vimeoIframe = videoModal.querySelector('#vimeoPlayer');
  const restoreBodyScroll = () => { try { document.body.style.overflow = ""; } catch {} };
  // Lock background scroll on mobile
  try { document.body.style.overflow = "hidden"; } catch {}
  
  if (typeof videoModal.showModal === "function") {
    videoModal.showModal();
  }
  
  // Close on backdrop click
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) {
      videoModal.close();
    }
  });

  // Close on Escape
  videoModal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') videoModal.close();
  });

  // Ensure video stops when dialog closes
  const closeVideoModal = () => {
    // Stop video playback by clearing src
    const vimeoIframe = videoModal.querySelector('iframe');
    if (vimeoIframe) {
      const src = vimeoIframe.getAttribute('src');
      vimeoIframe.setAttribute('src', '');
      // Small timeout to fully detach, then restore original src for next open
      setTimeout(() => { try { vimeoIframe.setAttribute('src', src || ''); } catch {} }, 0);
    }
    restoreBodyScroll();
    videoModal.remove();
    
    // Restore photo opacity immediately after video popup is closed
    try {
      (window._floatingPhotos || []).forEach((s) => {
        const w = s.wrap;
        if (w) {
          w.style.opacity = '1';
        }
        if (s.img) {
          s.img.style.opacity = '1';
        }
      });
    } catch {}
  
    // Show menu after video popup is closed
    showGameMenu();
  };

  videoModal.addEventListener("close", closeVideoModal);
  
  // Add click handler for close button
  const closeBtn = videoModal.querySelector('.close-video-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeVideoModal();
    });
  }
}

function showGameMenu() {
  // Remove any existing menu
  const existingMenu = document.getElementById('game-menu');
  if (existingMenu) existingMenu.remove();
  
  const menu = document.createElement('div');
  menu.id = 'game-menu';
  menu.innerHTML = `
    <div class="menu-content">
      <button class="menu-btn play-game-btn" onclick="startBounceGame()">
        🎮 Play Game
      </button>
      <button class="menu-btn watch-video-btn" onclick="showVideoModal()">
        🎬 Watch Video
      </button>
      <button class="menu-btn leaderboard-btn" onclick="showLeaderboard()">
        🏆 Leaderboard
      </button>
    </div>
  `;
  
  menu.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1500;
    background: linear-gradient(135deg, var(--ferrari-black), #2a0a0a);
    border: 2px solid var(--ferrari-gold);
    border-radius: 12px;
    padding: 15px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    .menu-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .menu-btn {
      background: linear-gradient(135deg, var(--ferrari-red), #b91c3c);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(220, 20, 60, 0.3);
      min-width: 140px;
    }
    
    .menu-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(220, 20, 60, 0.4);
      background: linear-gradient(135deg, #e11d48, var(--ferrari-red));
    }
    
    .menu-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(220, 20, 60, 0.3);
    }
    
    @media (max-width: 480px) {
      #game-menu {
        top: 10px;
        right: 10px;
        padding: 12px;
      }
      
      .menu-btn {
        padding: 10px 16px;
        font-size: 13px;
        min-width: 120px;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(menu);
}

function startNewGame() {
  // Reset game state
  state.currentRow = 0;
  state.currentCol = 0;
  state.gameOver = false;
  state.grid = Array.from({ length: CONFIG.maxGuesses }, () => Array(CONFIG.wordLength).fill(""));
  state.statuses = new Map();
  state.solution = pickSolution();
  
  // Clear the board
  board.innerHTML = "";
  
  // Recreate the board
  for (let row = 0; row < CONFIG.maxGuesses; row++) {
    for (let col = 0; col < CONFIG.wordLength; col++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = row;
      tile.dataset.col = col;
      board.appendChild(tile);
    }
  }
  
  // Show hint and keyboard again
  const hint = document.getElementById('hint');
  const keyboard = document.getElementById('keyboard');
  if (hint) hint.style.display = 'block';
  if (keyboard) keyboard.style.display = 'block';
  
  // Remove celebration effects
  document.body.classList.remove("celebrate");
  
  // Clear floating photos
  try {
    const photos = window._floatingPhotos || [];
    photos.forEach((state) => {
      if (state.wrap) state.wrap.remove();
    });
    window._floatingPhotos = [];
    window._floatingPhotoLoop = false;
  } catch {}
  
  // Remove menu
  const menu = document.getElementById('game-menu');
  if (menu) menu.remove();
  
  // Reset keyboard colors
  updateKeyboardStatuses(new Map());
}

function startBounceGame() {
  // Remove the menu first
  const menu = document.getElementById('game-menu');
  if (menu) menu.remove();
  
  // Find a random floating photo to start the bounce game with
  const photos = window._floatingPhotos || [];
  if (photos.length === 0) {
    // If no photos exist, create them first
    createFloatingPhotos();
    setTimeout(() => {
      const newPhotos = window._floatingPhotos || [];
      if (newPhotos.length > 0) {
        const randomPhoto = newPhotos[Math.floor(Math.random() * newPhotos.length)];
        startPhotoPaddleGame(randomPhoto);
      }
    }, 100);
  } else {
    // Use existing photo
    const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
    startPhotoPaddleGame(randomPhoto);
  }
}

// Firebase Leaderboard system
async function saveScore(score) {
  try {
    const playerName = getPlayerName();
    const newScore = {
      name: playerName,
      score: score,
      date: new Date().toLocaleDateString(),
      timestamp: Date.now()
    };
    
    // Try Firebase first
    if (window.firebaseDB) {
      await window.firebaseAddDoc(
        window.firebaseCollection(window.firebaseDB, "leaderboard"), 
        newScore
      );
      console.log('Score saved to Firebase');
    } else {
      // Fallback to localStorage if Firebase not available
      const scores = await getLeaderboard();
      scores.push(newScore);
      scores.sort((a, b) => b.score - a.score);
      scores.splice(10);
      localStorage.setItem('bounceGameLeaderboard', JSON.stringify(scores));
      console.log('Score saved to localStorage (Firebase not available)');
    }
  } catch (e) {
    console.warn('Could not save score:', e);
    // Fallback to localStorage on Firebase error
    try {
      const scores = await getLeaderboard();
      scores.push({
        name: getPlayerName(),
        score: score,
        date: new Date().toLocaleDateString(),
        timestamp: Date.now()
      });
      scores.sort((a, b) => b.score - a.score);
      scores.splice(10);
      localStorage.setItem('bounceGameLeaderboard', JSON.stringify(scores));
    } catch (localError) {
      console.error('Failed to save score anywhere:', localError);
    }
  }
}

async function getLeaderboard() {
  try {
    // Try Firebase first
    if (window.firebaseDB) {
      const q = window.firebaseQuery(
        window.firebaseCollection(window.firebaseDB, "leaderboard"),
        window.firebaseOrderBy("score", "desc"),
        window.firebaseLimit(10)
      );
      const querySnapshot = await window.firebaseGetDocs(q);
      const firebaseScores = querySnapshot.docs.map(doc => doc.data());
      
      if (firebaseScores.length > 0) {
        return firebaseScores;
      }
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('bounceGameLeaderboard');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Error getting leaderboard:', e);
    // Final fallback to localStorage
    try {
      const stored = localStorage.getItem('bounceGameLeaderboard');
      return stored ? JSON.parse(stored) : [];
    } catch (localError) {
      return [];
    }
  }
}

function getPlayerName() {
  try {
    let name = localStorage.getItem('bounceGamePlayerName');
    if (!name) {
      name = prompt('Enter your name for the leaderboard:') || 'Anonymous';
      localStorage.setItem('bounceGamePlayerName', name);
    }
    return name;
  } catch (e) {
    return 'Anonymous';
  }
}

async function showLeaderboard() {
  const scores = await getLeaderboard();
  const popup = document.createElement("div");
  popup.className = "leaderboard-popup";
  
  let scoresHtml = '';
  if (scores.length === 0) {
    scoresHtml = '<p class="no-scores">No scores yet! Play the bounce game to set a record!</p>';
  } else {
    scoresHtml = '<div class="leaderboard-list">';
    scores.forEach((score, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      scoresHtml += `
        <div class="score-entry ${index < 3 ? 'top-three' : ''}">
          <span class="rank">${medal}</span>
          <span class="name">${score.name}</span>
          <span class="score">${score.score}s</span>
          <span class="date">${score.date}</span>
        </div>
      `;
    });
    scoresHtml += '</div>';
  }
  
  popup.innerHTML = `
    <div class="leaderboard-content">
      <h2>🏆 Leaderboard 🏆</h2>
      ${scoresHtml}
      <div class="leaderboard-buttons">
        <button class="clear-scores-btn" onclick="clearLeaderboard()">Clear Scores</button>
        <button class="change-name-btn" onclick="changePlayerName()">Change Name</button>
        <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button>
      </div>
    </div>
  `;
  
  popup.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 4000;
    backdrop-filter: blur(5px);
  `;
  
  const content = popup.querySelector('.leaderboard-content');
  content.style.cssText = `
    background: linear-gradient(135deg, var(--ferrari-black), #2a0a0a);
    border: 2px solid var(--ferrari-gold);
    border-radius: 16px;
    padding: 30px;
    text-align: center;
    color: white;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: popup-bounce 0.6s ease-out;
    max-width: 500px;
    width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
  `;
  
  document.body.appendChild(popup);
}

function clearLeaderboard() {
  if (confirm('Are you sure you want to clear all scores?')) {
    localStorage.removeItem('bounceGameLeaderboard');
    const popup = document.querySelector('.leaderboard-popup');
    if (popup) popup.remove();
    showLeaderboard(); // Refresh the display
  }
}

function changePlayerName() {
  const newName = prompt('Enter your new name:');
  if (newName && newName.trim()) {
    localStorage.setItem('bounceGamePlayerName', newName.trim());
    alert(`Name changed to: ${newName.trim()}`);
  }
}

function showPlayAgainPopup() {
  const popup = document.createElement("div");
  popup.className = "play-again-popup";
  popup.innerHTML = `
    <div class="play-again-content">
      <h2>😬 Ewwwww, Try again 😬</h2>
      <button class="play-again-btn" onclick="this.parentElement.parentElement.remove(); startNewGame()">
        🎮 Play Again
      </button>
    </div>
  `;
  
  popup.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 4000;
    backdrop-filter: blur(5px);
  `;
  
  const content = popup.querySelector('.play-again-content');
  content.style.cssText = `
    background: linear-gradient(135deg, var(--ferrari-black), #2a0a0a);
    border: 2px solid var(--ferrari-gold);
    border-radius: 16px;
    padding: 30px;
    text-align: center;
    color: white;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: popup-bounce 0.6s ease-out;
    max-width: 400px;
    width: 90vw;
  `;
  
  // Auto-dismiss after 10 seconds if no interaction
  setTimeout(() => {
    if (popup.parentElement) {
      popup.remove();
      startNewGame();
    }
  }, 10000);
  
  document.body.appendChild(popup);
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

function lightUpLetters(callback) {
  const message = "HAPPY BIRTHDAY VANS";
  const letters = message.split("");
  
  // First, restructure the grid to show the birthday message
  restructureGridForMessage(message);
  
  letters.forEach((letter, index) => {
    setTimeout(() => {
      // Find the corresponding key on keyboard
      const key = keyboard.querySelector(`[data-key="${letter}"]`);
      if (key) {
        // Add special lighting effect
        key.classList.add("key--lighting");
        key.style.animation = "letter-glow 0.2s ease-in-out";
        
        // Play keyboard sound
        playKeyboardSound();
        
        // Find and light up the corresponding tile in the grid
        lightUpGridTileByLetter(letter);
        
        // Remove effect after animation
        setTimeout(() => {
          key.classList.remove("key--lighting");
          key.style.animation = "";
        }, 750);
      }
    }, index * 200); // slower pacing
  });
  
  // Call callback after all letters are done
  if (callback) {
    const totalDuration = letters.length * 200 + 750; // animation time + last letter effect
    setTimeout(callback, totalDuration);
  }
}

function restructureGridForMessage(message) {
  // Clear existing board
  board.innerHTML = "";
  
  // Split message into words
  const words = ["HAPPY", "BIRTHDAY", "VANS"];
  
  board.style.gridTemplateColumns = `repeat(8, 1fr)`; // 8 columns for each row
  board.style.gridTemplateRows = `repeat(3, 1fr)`;   // 3 rows
  board.style.gap = "8px";
  board.style.justifyItems = "center";
  board.style.margin = "12px 0 24px 0";
  
  let tileIndex = 0;
  
  // Create 8 tiles for each row (3 rows total)
  for (let row = 0; row < 3; row++) {
    const word = words[row];
    const letters = word.split("");
    
    // Create 8 tiles for this row
    for (let col = 0; col < 8; col++) {
      const tile = document.createElement("div");
      tile.className = "tile tile--message";
      tile.id = `message-tile-${tileIndex}`;
      
      if (col < letters.length) {
        // Fill with letter
        tile.textContent = letters[col];
        tile.style.cssText = `
          width: 50px;
          height: 50px;
          border: 2px solid var(--tile-border);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          text-transform: uppercase;
          background: var(--bg);
          color: var(--text);
          opacity: 0.3;
          transition: all 0.3s ease;
          grid-column: ${col + 1};
          grid-row: ${row + 1};
        `;
      } else {
        // Empty tile
        tile.textContent = "";
        tile.style.cssText = `
          width: 50px;
          height: 50px;
          border: 2px solid transparent;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 20px;
          background: transparent;
          opacity: 0;
          grid-column: ${col + 1};
          grid-row: ${row + 1};
        `;
      }
      
      board.appendChild(tile);
      tileIndex++;
    }
  }
}

function lightUpGridTileByLetter(letter) {
  // Find all tiles with this letter and light up the first unlit one
  const allTiles = board.querySelectorAll('.tile--message');
  for (let tile of allTiles) {
    if (tile.textContent === letter && !tile.classList.contains('tile--lit')) {
      // Mark this tile as lit
      tile.classList.add('tile--lit');
      
      // Light up the tile
      tile.style.cssText = `
        width: 50px;
        height: 50px;
        border: 2px solid var(--ferrari-gold);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 20px;
        text-transform: uppercase;
        background: var(--ferrari-gold);
        color: #000;
        opacity: 1;
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
        transform: scale(1.1);
        transition: all 0.3s ease;
        grid-column: ${tile.style.gridColumn};
        grid-row: ${tile.style.gridRow};
      `;
      
      // Add pulsing effect
      setTimeout(() => {
        tile.style.transform = "scale(1)";
      }, 300);
      
      break; // Only light up one tile per letter
    }
  }
}

function winSequence() {
  state.gameOver = true;
  showToast("🏎️ Checkered flag! 🏁");
  
  // Hide hint and keyboard after game is over
  const hint = document.getElementById('hint');
  const keyboard = document.getElementById('keyboard');
  if (hint) hint.style.display = 'none';
  if (keyboard) keyboard.style.display = 'none';
  
  setTimeout(() => {
    document.body.classList.add("celebrate");
    playBirthdayJingle();
    startConfetti(6000);
    // Light up letters first, then start photos after completion
    setTimeout(() => { 
      lightUpLetters(() => {
        // Callback: start photos after letters are done
        setTimeout(() => {
          createFloatingPhotos();
        }, 500);
      });
    }, 400);
    
    // After photos animate for 7s, crossfade to surprise overlay
    setTimeout(() => {
      try {
        const photos = window._floatingPhotos || [];
        const overlay = showSurprisePopup();
        if (overlay) {
          requestAnimationFrame(() => { overlay.style.opacity = '0'; });
          // start crossfade
          photos.forEach((state) => {
            const wrap = state.wrap || state; 
            wrap.style.transition = 'opacity 1400ms ease';
            wrap.style.opacity = '0.35';
          });
          setTimeout(() => { try { overlay.style.opacity = '1'; } catch {} }, 20);
          // Keep photo wrappers after popup so they continue animating behind
        } else {
          photos.forEach((state) => {
            const wrap = state.wrap || state;
            wrap.style.transition = 'opacity 1400ms ease';
            wrap.style.opacity = '0.35';
          });
          setTimeout(() => {
            showSurprisePopup();
          }, 1420);
        }
      } catch {
        showSurprisePopup();
      }
    }, 7000);
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

// Removed share button functionality

// Initialize
renderBoard();
renderKeyboard();

