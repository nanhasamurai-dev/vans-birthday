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
  //videoEmbedHtml: '<iframe src="https://player.vimeo.com/video/1117547643?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" width="1080" height="1920" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" title="LoL Just Kidding"></iframe>'
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
  // Remove timeout to make confetti run continuously
  // setTimeout(() => running = false, durationMs);
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
  const animations = [
    'float-around-full',
    'spiral-dance', 
    'bounce-zoom',
    'wave-motion',
    'zigzag-dance',
    'orbit-motion'
  ];
  
  CONFIG.galleryImages.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${CONFIG.friendName} photo`;
    img.className = "floating-photo";
    
    // Calculate random position across entire viewport
    const leftPos = Math.random() * (window.innerWidth - 160);
    const topPos = Math.random() * (window.innerHeight - 160);
    
    // Randomly select animation and duration
    const animation = animations[Math.floor(Math.random() * animations.length)];
    const duration = 6 + Math.random() * 4; // 6-10 seconds
    const delay = index * 0.8 + Math.random() * 2; // Staggered start times
    
    img.style.cssText = `
      position: fixed;
      width: 160px;
      height: 160px;
      object-fit: cover;
      border-radius: 50%;
      border: 4px solid var(--ferrari-gold);
      box-shadow: 0 0 25px rgba(255, 215, 0, 0.8), 0 0 50px rgba(220, 20, 60, 0.4);
      z-index: 1000;
      pointer-events: auto;
      left: ${leftPos}px;
      top: ${topPos}px;
      animation: ${animation} ${duration}s ease-in-out infinite;
      animation-delay: ${delay}s;
      cursor: pointer;
    `;
    
    // Add click interaction for photos with special effect
    img.addEventListener("click", () => {
      img.style.animation = "none";
      img.style.transform = "scale(1.8) rotate(720deg)";
      img.style.transition = "all 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)";
      img.style.boxShadow = "0 0 50px rgba(255, 215, 0, 1), 0 0 100px rgba(220, 20, 60, 0.8)";
      
      setTimeout(() => {
        img.style.animation = `${animation} ${duration}s ease-in-out infinite`;
        img.style.transform = "";
        img.style.transition = "";
        img.style.boxShadow = "0 0 25px rgba(255, 215, 0, 0.8), 0 0 50px rgba(220, 20, 60, 0.4)";
      }, 1500);
    });
    
    document.body.appendChild(img);
    photos.push(img);
  });
  
  // Keep photos animating continuously - no removal
  // Photos will animate forever until page refresh
}

function showSurprisePopup() {
  const popup = document.createElement("div");
  popup.className = "surprise-popup";
  popup.innerHTML = `
    <div class="surprise-content">
      <h3>🎉 Click here for surprise! 🎉</h3>
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
      <div class="video-header">
        <h2>🎬 Happy Birthday Vans 🎬</h2>
        <button type="button" class="close-btn" aria-label="Close video">✕</button>
      </div>
      <div class="video-container">
        ${CONFIG.videoEmbedHtml}
      </div>
      <div class="video-controls">
        <button type="button" class="control-btn" id="playPauseBtn">▶️ Play</button>
        <button type="button" class="control-btn" id="muteBtn">🔊 Unmute</button>
        <button type="button" class="control-btn" id="fullscreenBtn">⛶ Fullscreen</button>
        <div class="volume-control">
          <label for="volumeSlider">🔊</label>
          <input type="range" id="volumeSlider" min="0" max="100" value="100" class="volume-slider">
        </div>
      </div>
      <div class="video-info">
        <p>🎉 Enjoy this special birthday video! 🎉</p>
        <p>Click anywhere outside the video to close</p>
      </div>
    </form>
  `;
  videoModal.style.cssText = `
    border: none;
    border-radius: 16px;
    padding: 0;
    background: var(--ferrari-black);
    color: var(--text);
    max-width: 500px;
    width: 95vw;
    box-shadow: 0 0 50px rgba(220, 20, 60, 0.5);
  `;
  videoModal.style.setProperty("::backdrop", "background: rgba(0,0,0,0.9)");
  
  document.body.appendChild(videoModal);
  
  // Add event listeners for custom controls
  const iframe = videoModal.querySelector('iframe');
  const playPauseBtn = videoModal.querySelector('#playPauseBtn');
  const muteBtn = videoModal.querySelector('#muteBtn');
  const fullscreenBtn = videoModal.querySelector('#fullscreenBtn');
  const volumeSlider = videoModal.querySelector('#volumeSlider');
  const closeBtn = videoModal.querySelector('.close-btn');
  
  // Close button functionality
  closeBtn.addEventListener('click', () => {
    videoModal.close();
  });
  
  // Play/Pause button (note: limited control over Vimeo iframe)
  playPauseBtn.addEventListener('click', () => {
    // Vimeo iframe doesn't allow external control, so we'll just show a message
    showToast("Use the video controls to play/pause");
  });
  
  // Mute button (note: limited control over Vimeo iframe)
  muteBtn.addEventListener('click', () => {
    showToast("Use the video controls to mute/unmute");
  });
  
  // Fullscreen button
  fullscreenBtn.addEventListener('click', () => {
    if (iframe.requestFullscreen) {
      iframe.requestFullscreen();
    } else if (iframe.webkitRequestFullscreen) {
      iframe.webkitRequestFullscreen();
    } else if (iframe.msRequestFullscreen) {
      iframe.msRequestFullscreen();
    }
  });
  
  // Volume slider (note: limited control over Vimeo iframe)
  volumeSlider.addEventListener('input', (e) => {
    showToast(`Volume: ${e.target.value}%`);
  });
  
  // Close on backdrop click
  videoModal.addEventListener('click', (e) => {
    if (e.target === videoModal) {
      videoModal.close();
    }
  });
  
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

function lightUpLetters() {
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
    }, index * 100); // 100ms delay between each letter (faster)
  });
  
  // Start photo animation after all letters are lit
  setTimeout(() => {
    createFloatingPhotos();
  }, letters.length * 100 + 500); // Wait for all letters + 0.5 seconds
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
  setTimeout(() => {
    document.body.classList.add("celebrate");
    playBirthdayJingle();
    startConfetti(); // Run continuously
    
    // Light up letters first (this will also start photos after completion)
    setTimeout(() => {
      lightUpLetters();
    }, 1000);
    
    // Show surprise popup at the very end (after all animations)
    setTimeout(() => {
      showSurprisePopup();
    }, 20000); // Much later - after letter lighting + photos + confetti
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


