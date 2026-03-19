// ═══════════════════════════════════════════════════════
//  BINGO — Client Application
// ═══════════════════════════════════════════════════════

// Connect to backend — uses BACKEND_URL if set (for split deploy), otherwise same origin
const BACKEND = window.BACKEND_URL || '';
const socket = BACKEND ? io(BACKEND, { transports: ['websocket', 'polling'] }) : io();

// ─── State ─────────────────────────────────────────────
let state = {
  playerName: '',
  roomCode: '',
  isHost: false,
  maxNum: 25,
  callerSpeed: 5000,
  board: [],
  calledNumbers: [],
  voiceEnabled: true,
  myId: null
};

// ─── DOM Elements ──────────────────────────────────────
const screens = {
  home: document.getElementById('screen-home'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game')
};

const els = {
  playerName: document.getElementById('player-name'),
  btnCreate: document.getElementById('btn-create'),
  roomCodeInput: document.getElementById('room-code-input'),
  btnJoin: document.getElementById('btn-join'),
  displayRoomCode: document.getElementById('display-room-code'),
  btnCopyCode: document.getElementById('btn-copy-code'),
  playersList: document.getElementById('players-list'),
  playerCount: document.getElementById('player-count'),
  btnStart: document.getElementById('btn-start'),
  waitingText: document.getElementById('waiting-text'),
  btnLeaveLobby: document.getElementById('btn-leave-lobby'),
  lobbyModeBadge: document.getElementById('lobby-mode-badge'),
  lobbySpeedBadge: document.getElementById('lobby-speed-badge'),
  bingoBoard: document.getElementById('bingo-board'),
  tickerTrack: document.getElementById('ticker-track'),
  currentNumber: document.getElementById('current-number'),
  calledNumbersGrid: document.getElementById('called-numbers-grid'),
  numbersCalledCount: document.getElementById('numbers-called-count'),
  numbersTotal: document.getElementById('numbers-total'),
  btnBingo: document.getElementById('btn-bingo'),
  btnVoiceToggle: document.getElementById('btn-voice-toggle'),
  gamePlayersList: document.getElementById('game-players-list'),
  winOverlay: document.getElementById('win-overlay'),
  winTitle: document.getElementById('win-title'),
  winMessage: document.getElementById('win-message'),
  winType: document.getElementById('win-type'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  btnBackHome: document.getElementById('btn-back-home'),
  confettiContainer: document.getElementById('confetti-container'),
  toastContainer: document.getElementById('toast-container')
};

// ─── Particles Background ──────────────────────────────
function createParticles() {
  const container = document.getElementById('particles');
  const colors = ['#00d4ff', '#a855f7', '#f472b6', '#34d399', '#fbbf24'];
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (8 + Math.random() * 15) + 's';
    p.style.animationDelay = Math.random() * 10 + 's';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.width = (2 + Math.random() * 4) + 'px';
    p.style.height = p.style.width;
    container.appendChild(p);
  }
}
createParticles();

// ─── Screen Navigation ─────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ─── Toast Notifications ───────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Avatars ───────────────────────────────────────────
const avatarColors = [
  ['#00d4ff', '#0ea5e9'], ['#a855f7', '#7c3aed'], ['#f472b6', '#ec4899'],
  ['#34d399', '#10b981'], ['#fbbf24', '#f59e0b'], ['#fb923c', '#f97316'],
  ['#f87171', '#ef4444'], ['#818cf8', '#6366f1']
];
function getAvatarColor(index) {
  return avatarColors[index % avatarColors.length];
}

// ═══════ HOME SCREEN HANDLERS ═══════

// Mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.maxNum = parseInt(btn.dataset.max);
  });
});

// Speed buttons
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.callerSpeed = parseInt(btn.dataset.speed);
  });
});

// Create Room
els.btnCreate.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  if (!name) {
    showToast('Please enter your name!', 'error');
    els.playerName.focus();
    return;
  }
  state.playerName = name;
  socket.emit('create-room', {
    playerName: name,
    maxNum: state.maxNum,
    callerSpeed: state.callerSpeed
  });
});

// Join Room
els.btnJoin.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const code = els.roomCodeInput.value.trim().toUpperCase();
  if (!name) {
    showToast('Please enter your name!', 'error');
    els.playerName.focus();
    return;
  }
  if (code.length < 6) {
    showToast('Please enter a valid 6-digit room code!', 'error');
    els.roomCodeInput.focus();
    return;
  }
  state.playerName = name;
  socket.emit('join-room', { playerName: name, roomCode: code });
});

// Enter key support
els.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') els.roomCodeInput.focus();
});
els.roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') els.btnJoin.click();
});

// ═══════ LOBBY HANDLERS ═══════

// Copy code
els.btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode).then(() => {
    showToast('Room code copied!', 'success');
    els.btnCopyCode.textContent = '✅';
    setTimeout(() => els.btnCopyCode.textContent = '📋', 2000);
  });
});

// Start Game
els.btnStart.addEventListener('click', () => {
  socket.emit('start-game');
});

// Leave Lobby
els.btnLeaveLobby.addEventListener('click', () => {
  location.reload();
});

// ═══════ GAME HANDLERS ═══════

// Mark cell
function onCellClick(row, col) {
  if (state.board[row][col].marked || state.board[row][col].value === 'FREE') return;
  if (!state.calledNumbers.includes(state.board[row][col].value)) {
    showToast('This number hasn\'t been called yet!', 'error');
    return;
  }
  socket.emit('mark-number', { row, col });
}

// Claim BINGO
els.btnBingo.addEventListener('click', () => {
  socket.emit('claim-bingo');
});

// Voice Toggle
els.btnVoiceToggle.addEventListener('click', () => {
  state.voiceEnabled = !state.voiceEnabled;
  els.btnVoiceToggle.textContent = state.voiceEnabled ? '🔊' : '🔇';
  els.btnVoiceToggle.classList.toggle('off', !state.voiceEnabled);
  showToast(state.voiceEnabled ? 'Voice ON' : 'Voice OFF', 'info');
});

// Win overlay buttons
els.btnPlayAgain.addEventListener('click', () => {
  els.winOverlay.style.display = 'none';
  socket.emit('play-again');
});

els.btnBackHome.addEventListener('click', () => {
  location.reload();
});

// ═══════ RENDERING FUNCTIONS ═══════

function renderPlayersList(players) {
  els.playersList.innerHTML = '';
  els.playerCount.textContent = `(${players.length})`;
  players.forEach((p, i) => {
    const colors = getAvatarColor(i);
    const div = document.createElement('div');
    div.className = 'player-item';
    div.innerHTML = `
      <div class="player-avatar" style="background: linear-gradient(135deg, ${colors[0]}, ${colors[1]})">
        ${p.name.charAt(0)}
      </div>
      <span class="player-name">${escapeHtml(p.name)}</span>
      ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
    `;
    els.playersList.appendChild(div);
  });
}

function renderGamePlayers(players) {
  els.gamePlayersList.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'game-player-item';
    div.innerHTML = `<div class="game-player-dot"></div><span>${escapeHtml(p.name)}</span>`;
    els.gamePlayersList.appendChild(div);
  });
}

function renderBoard() {
  els.bingoBoard.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = state.board[r][c];
      const div = document.createElement('div');
      div.className = 'bingo-cell';
      if (cell.value === 'FREE') {
        div.classList.add('free', 'marked');
        div.textContent = 'FREE';
      } else {
        div.textContent = cell.value;
        if (cell.marked) div.classList.add('marked');
        if (state.calledNumbers.includes(cell.value) && !cell.marked) {
          div.classList.add('callable');
        }
        div.addEventListener('click', () => onCellClick(r, c));
      }
      els.bingoBoard.appendChild(div);
    }
  }
}

function renderCalledNumbersGrid() {
  els.calledNumbersGrid.innerHTML = '';
  for (let i = 1; i <= state.maxNum; i++) {
    const div = document.createElement('div');
    div.className = 'called-num';
    div.textContent = i;
    div.id = `called-num-${i}`;
    if (state.calledNumbers.includes(i)) div.classList.add('active');
    els.calledNumbersGrid.appendChild(div);
  }
  els.numbersTotal.textContent = state.maxNum;
}

function updateCalledNumber(number) {
  // Update grid
  const numEl = document.getElementById(`called-num-${number}`);
  if (numEl) {
    // Remove previous latest
    document.querySelectorAll('.called-num.latest-called').forEach(el => el.classList.remove('latest-called'));
    numEl.classList.add('active', 'latest-called');
  }
  
  // Update count
  els.numbersCalledCount.textContent = state.calledNumbers.length;

  // Update ticker
  const tickerNum = document.createElement('div');
  tickerNum.className = 'ticker-number';
  tickerNum.textContent = number;
  
  // Remove previous latest
  document.querySelectorAll('.ticker-number.latest').forEach(el => el.classList.remove('latest'));
  tickerNum.classList.add('latest');
  els.tickerTrack.appendChild(tickerNum);

  // Auto-scroll ticker to keep latest visible
  const container = document.getElementById('ticker-container');
  const track = els.tickerTrack;
  const overflow = track.scrollWidth - container.clientWidth;
  if (overflow > 0) {
    track.style.transform = `translateX(-${overflow}px)`;
  }

  // Update current number display
  els.currentNumber.textContent = number;
  els.currentNumber.style.transform = 'scale(1.3)';
  setTimeout(() => els.currentNumber.style.transform = 'scale(1)', 300);

  // Update board - highlight callable cells
  renderBoard();
}

function speak(text) {
  if (!state.voiceEnabled) return;
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  utterance.volume = 1;
  // Try to use a good English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
  if (preferred) utterance.voice = preferred;
  else if (voices.length > 0) {
    const english = voices.find(v => v.lang.startsWith('en'));
    if (english) utterance.voice = english;
  }
  window.speechSynthesis.speak(utterance);
}

// Preload voices
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function checkLocalWin() {
  const board = state.board;
  // Check rows
  for (let r = 0; r < 5; r++) {
    if (board[r].every(cell => cell.marked)) { els.btnBingo.disabled = false; return; }
  }
  // Check columns
  for (let c = 0; c < 5; c++) {
    if (board.every(row => row[c].marked)) { els.btnBingo.disabled = false; return; }
  }
  // Check diagonals
  if ([0,1,2,3,4].every(i => board[i][i].marked)) { els.btnBingo.disabled = false; return; }
  if ([0,1,2,3,4].every(i => board[i][4-i].marked)) { els.btnBingo.disabled = false; return; }
  // Corners
  if (board[0][0].marked && board[0][4].marked && board[4][0].marked && board[4][4].marked) {
    els.btnBingo.disabled = false; return;
  }
  els.btnBingo.disabled = true;
}

function createConfetti() {
  els.confettiContainer.innerHTML = '';
  const colors = ['#00d4ff', '#a855f7', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#ef4444', '#818cf8'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    piece.style.animationDelay = Math.random() * 1 + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = (5 + Math.random() * 10) + 'px';
    piece.style.height = piece.style.width;
    els.confettiContainer.appendChild(piece);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══════ SOCKET.IO EVENT HANDLERS ═══════

socket.on('connect', () => {
  state.myId = socket.id;
});

socket.on('room-created', ({ roomCode, players }) => {
  state.roomCode = roomCode;
  state.isHost = true;
  els.displayRoomCode.textContent = roomCode;
  els.lobbyModeBadge.textContent = `Mode: 1-${state.maxNum}`;
  const speedLabel = state.callerSpeed <= 3000 ? 'Fast' : state.callerSpeed >= 8000 ? 'Slow' : 'Normal';
  els.lobbySpeedBadge.textContent = `Speed: ${speedLabel}`;
  els.btnStart.style.display = 'inline-flex';
  els.waitingText.style.display = 'none';
  renderPlayersList(players);
  showScreen('lobby');
  showToast('Room created! Share the code with friends.', 'success');
});

socket.on('room-joined', ({ roomCode, players, maxNum }) => {
  state.roomCode = roomCode;
  state.isHost = false;
  state.maxNum = maxNum;
  els.displayRoomCode.textContent = roomCode;
  els.lobbyModeBadge.textContent = `Mode: 1-${maxNum}`;
  els.btnStart.style.display = 'none';
  els.waitingText.style.display = 'block';
  renderPlayersList(players);
  showScreen('lobby');
  showToast('Joined the room!', 'success');
});

socket.on('player-joined', ({ players, newPlayer }) => {
  renderPlayersList(players);
  showToast(`${newPlayer} joined the game!`, 'info');

});

socket.on('player-left', ({ players, leftPlayer }) => {
  renderPlayersList(players);
  renderGamePlayers(players);
  showToast(`${leftPlayer} left the game.`, 'info');
});

socket.on('game-started', ({ board, maxNum, playerCount }) => {
  state.board = board;
  state.maxNum = maxNum;
  state.calledNumbers = [];
  els.tickerTrack.innerHTML = '';
  els.tickerTrack.style.transform = 'translateX(0)';
  els.currentNumber.textContent = '—';
  els.btnBingo.disabled = true;
  
  renderBoard();
  renderCalledNumbersGrid();
  showScreen('game');
  showToast('Game started! Listen for numbers...', 'success');

});

socket.on('number-called', ({ number, calledNumbers, remaining }) => {
  state.calledNumbers = calledNumbers;
  updateCalledNumber(number);
  speak(`${number}`);
  checkLocalWin();
});

socket.on('cell-marked', ({ row, col }) => {
  state.board[row][col].marked = true;
  renderBoard();
  checkLocalWin();
});

socket.on('game-over', ({ winner, winType, winnerId }) => {
  const isMe = winnerId === socket.id;
  els.winTitle.textContent = isMe ? '🎉 YOU WON!' : 'BINGO!';
  els.winMessage.textContent = isMe ? 'Congratulations!' : `${winner} wins!`;
  
  const typeNames = {
    row: '🔲 Complete Row',
    column: '🔲 Complete Column',
    diagonal: '⬡ Diagonal',
    corners: '📐 Four Corners',
    fullhouse: '🏠 Full House'
  };
  els.winType.textContent = typeNames[winType] || winType;
  
  if (state.isHost) {
    els.btnPlayAgain.style.display = 'inline-flex';
  } else {
    els.btnPlayAgain.style.display = 'none';
  }
  
  createConfetti();
  els.winOverlay.style.display = 'flex';
  speak(isMe ? 'You won!' : `${winner} wins!`);
});

socket.on('false-bingo', ({ message }) => {
  showToast(message, 'error');

});

socket.on('back-to-lobby', ({ players }) => {
  els.winOverlay.style.display = 'none';
  state.calledNumbers = [];
  state.board = [];
  renderPlayersList(players);
  
  if (state.isHost) {
    els.btnStart.style.display = 'inline-flex';
    els.waitingText.style.display = 'none';
  } else {
    els.btnStart.style.display = 'none';
    els.waitingText.style.display = 'block';
  }
  
  showScreen('lobby');
  showToast('Back to lobby! Get ready for another round.', 'info');
});

socket.on('settings-updated', ({ maxNum, callerSpeed }) => {
  state.maxNum = maxNum;
  state.callerSpeed = callerSpeed;
  els.lobbyModeBadge.textContent = `Mode: 1-${maxNum}`;
  const speedLabel = callerSpeed <= 3000 ? 'Fast' : callerSpeed >= 8000 ? 'Slow' : 'Normal';
  els.lobbySpeedBadge.textContent = `Speed: ${speedLabel}`;
});

socket.on('all-numbers-called', ({ message }) => {
  showToast(message, 'info');

});

socket.on('error-msg', ({ message }) => {
  showToast(message, 'error');
});

socket.on('disconnect', () => {
  showToast('Disconnected from server!', 'error');
});

// ─── Initial Focus ─────────────────────────────────────
els.playerName.focus();
