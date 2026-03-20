// ═══════════════════════════════════════════════════════
// BINGO — CLIENT LOGIC
// ═══════════════════════════════════════════════════════

const socket = io(window.BACKEND_URL || '');

// ═══════ STATE ═══════
const state = {
  playerName: '',
  roomCode: '',
  isHost: false,
  players: [],
  board: [],
  maxNum: 25,
  calledNumbers: [],
  isGameActive: false,
  isVoiceEnabled: true,
  turnBased: false,
  manualSetup: false,
  isMyTurn: false,
  currentTurnId: null,
};

// ═══════ ELEMENTS ═══════
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
  
  // New Setup screen
  setupBoard: document.getElementById('setup-board'),
  setupMaxNum: document.getElementById('setup-max-num'),
  btnSubmitBoard: document.getElementById('btn-submit-board'),
  btnRandomizeSetup: document.getElementById('btn-randomize-setup'),
  checkTurnBased: document.getElementById('check-turn-based'),
  checkManualSetup: document.getElementById('check-manual-setup'),
  
  // Turn UI
  turnIndicator: document.getElementById('turn-indicator'),
  turnPlayerName: document.getElementById('turn-player-name'),
};

// ═══════ EVENT LISTENERS ═══════

// Home Screen
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.maxNum = parseInt(btn.dataset.max);
  });
});

els.btnCreate.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  if (!name) {
    showToast('Please enter your name!', 'error');
    els.playerName.focus();
    return;
  }
  state.playerName = name;
  const turnBased = els.checkTurnBased.checked;
  const manualSetup = els.checkManualSetup.checked;
  
  socket.emit('create-room', { 
    playerName: state.playerName, 
    maxNum: state.maxNum,
    turnBased,
    manualSetup
  });
});

els.btnJoin.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const code = els.roomCodeInput.value.trim().toUpperCase();
  if (!name) {
    showToast('Please enter your name!', 'error');
    els.playerName.focus();
    return;
  }
  if (code.length !== 6) {
    showToast('Enter a 6-digit room code!', 'error');
    els.roomCodeInput.focus();
    return;
  }
  state.playerName = name;
  socket.emit('join-room', { playerName: name, roomCode: code });
});

// Lobby Screen
els.btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode);
  showToast('Room code copied!', 'success');
});

els.btnStart.addEventListener('click', () => {
  socket.emit('start-game');
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
  window.location.reload();
});

// Setup Screen
els.btnRandomizeSetup.addEventListener('click', () => {
  const cells = els.setupBoard.querySelectorAll('.setup-grid-cell:not(.free)');
  const bankNums = document.querySelectorAll('.bank-num');
  const nums = [];
  for (let i = 1; i <= state.maxNum; i++) nums.push(i);
  
  // Shuffle
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  
  cells.forEach((cell, i) => {
    const val = nums[i];
    cell.textContent = val;
    cell.dataset.value = val;
    cell.classList.add('filled');
  });

  bankNums.forEach(bankNum => {
    const val = parseInt(bankNum.dataset.value);
    if (nums.slice(0, 24).includes(val)) {
      bankNum.classList.add('used');
    } else {
      bankNum.classList.remove('used');
    }
  });
});

els.btnSubmitBoard.addEventListener('click', () => {
  const boardData = [];
  const cells = els.setupBoard.querySelectorAll('.bingo-cell');
  
  let isValid = true;
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      const val = cells[idx].dataset.value;
      if (!val) isValid = false;
      row.push(val === 'FREE' ? 'FREE' : parseInt(val));
    }
    boardData.push(row);
  }
  
  if (!isValid) {
    showToast('Please fill all 25 cells!', 'error');
    return;
  }
  
  socket.emit('submit-board', { board: boardData });
  els.btnSubmitBoard.disabled = true;
  showToast('Ready! Waiting for others...', 'success');
});

// Game Screen
els.btnVoiceToggle.addEventListener('click', () => {
  state.isVoiceEnabled = !state.isVoiceEnabled;
  els.btnVoiceToggle.textContent = state.isVoiceEnabled ? '🔊' : '🔇';
  els.btnVoiceToggle.classList.toggle('off', !state.isVoiceEnabled);
});

els.btnBingo.addEventListener('click', () => {
  socket.emit('claim-bingo');
  // Simple anti-spam
  els.btnBingo.disabled = true;
  setTimeout(() => checkLocalWin(), 2000); 
});

els.btnPlayAgain.addEventListener('click', () => {
  socket.emit('play-again');
  els.winOverlay.style.display = 'none';
});

els.btnBackHome.addEventListener('click', () => {
  window.location.reload();
});

// Turn Based Calling
document.getElementById('btn-call-number').addEventListener('click', () => {
  if (!state.isMyTurn) return;
  const selected = els.bingoBoard.querySelector('.selected');
  if (!selected) {
    showToast('Select a number on your board first!', 'info');
    return;
  }
  const val = parseInt(selected.textContent);
  socket.emit('call-number', { number: val });
  selected.classList.remove('selected');
});

// ═══════ RENDERING FUNCTIONS ═══════

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screenId}`).classList.add('active');
}

function renderSetupBoard(maxNum) {
  els.setupBoard.innerHTML = '';
  const bank = document.getElementById('setup-number-bank');
  bank.innerHTML = '';

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const div = document.createElement('div');
      div.className = 'bingo-cell setup-grid-cell';
      if (r === 2 && c === 2) {
        div.classList.add('free');
        div.textContent = 'FREE';
        div.dataset.value = 'FREE';
      } else {
        div.dataset.row = r;
        div.dataset.col = c;
        div.addEventListener('click', onSetupCellClick);
      }
      els.setupBoard.appendChild(div);
    }
  }

  for (let i = 1; i <= maxNum; i++) {
    const num = document.createElement('div');
    num.className = 'bank-num';
    num.textContent = i;
    num.dataset.value = i;
    num.addEventListener('click', onBankNumClick);
    bank.appendChild(num);
  }
  
  els.btnSubmitBoard.disabled = false;
  els.setupMaxNum.textContent = maxNum;
}

function onBankNumClick(e) {
  const val = e.currentTarget.dataset.value;
  if (e.currentTarget.classList.contains('used')) return;
  const emptyCell = Array.from(els.setupBoard.querySelectorAll('.setup-grid-cell:not(.free)'))
    .find(cell => !cell.dataset.value);

  if (emptyCell) {
    emptyCell.textContent = val;
    emptyCell.dataset.value = val;
    emptyCell.classList.add('filled');
    e.currentTarget.classList.add('used');
  }
}

function onSetupCellClick(e) {
  const cell = e.currentTarget;
  const val = cell.dataset.value;
  if (!val || val === 'FREE') return;
  cell.textContent = '';
  delete cell.dataset.value;
  cell.classList.remove('filled');
  const bankNum = document.querySelector(`.bank-num[data-value="${val}"]`);
  if (bankNum) bankNum.classList.remove('used');
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
        div.addEventListener('click', () => onCellClick(r, c, div));
      }
      els.bingoBoard.appendChild(div);
    }
  }
}

function onCellClick(r, c, div) {
  if (state.turnBased) {
    if (state.isMyTurn) {
      if (div.classList.contains('marked')) return;
      els.bingoBoard.querySelectorAll('.bingo-cell').forEach(c => c.classList.remove('selected'));
      div.classList.add('selected');
    } else {
      showToast("Wait for your turn!", "info");
    }
    return;
  }

  // Normal Auto-bot mode
  const cell = state.board[r][c];
  if (cell.value === 'FREE' || cell.marked) return;
  if (state.calledNumbers.includes(cell.value)) {
    cell.marked = true;
    div.classList.add('marked');
    socket.emit('mark-number', { row: r, col: c });
    checkLocalWin();
  }
}

function renderCalledNumbersGrid() {
  els.calledNumbersGrid.innerHTML = '';
  for (let i = 1; i <= state.maxNum; i++) {
    const div = document.createElement('div');
    div.className = 'called-num';
    div.textContent = i;
    if (state.calledNumbers.includes(i)) div.classList.add('active');
    els.calledNumbersGrid.appendChild(div);
  }
  els.numbersTotal.textContent = state.maxNum;
}

function updateCalledNumber(number, calledNumbers, callerName) {
  state.calledNumbers = calledNumbers;
  els.currentNumber.textContent = number;
  
  if (state.isVoiceEnabled) {
    if (callerName) speak(`${callerName} called ${number}`);
    else speak(number.toString());
  }

  const numElem = document.createElement('div');
  numElem.className = 'ticker-number latest';
  numElem.textContent = number;
  
  const prevLatest = els.tickerTrack.querySelector('.latest');
  if (prevLatest) prevLatest.classList.remove('latest');
  els.tickerTrack.prepend(numElem);
  
  els.numbersCalledCount.textContent = state.calledNumbers.length;
  renderCalledNumbersGrid();
  checkLocalWin();
}

function checkLocalWin() {
  let lines = 0;
  const board = state.board;

  // Rows
  for (let r = 0; r < 5; r++) {
    if (board[r].every(c => c.marked || c.value === 'FREE')) lines++;
  }
  // Cols
  for (let c = 0; c < 5; c++) {
    let complete = true;
    for (let r = 0; r < 5; r++) {
      if (!board[r][c].marked && board[r][c].value !== 'FREE') complete = false;
    }
    if (complete) lines++;
  }
  // Diagonals
  let d1 = true, d2 = true;
  for (let i = 0; i < 5; i++) {
    if (!board[i][i].marked && board[i][i].value !== 'FREE') d1 = false;
    if (!board[i][4 - i].marked && board[i][4 - i].value !== 'FREE') d2 = false;
  }
  if (d1) lines++;
  if (d2) lines++;

  if (lines >= 5) {
    els.btnBingo.disabled = false;
    els.btnBingo.classList.add('btn-glow');
  } else {
    els.btnBingo.disabled = true;
    els.btnBingo.classList.remove('btn-glow');
  }
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ═══════ SOCKETS ═══════

socket.on('room-created', (roomCode) => {
  state.roomCode = roomCode;
  state.isHost = true;
  els.displayRoomCode.textContent = roomCode;
  els.btnStart.style.display = 'block';
  els.waitingText.style.display = 'none';
  showScreen('lobby');
});

socket.on('room-joined', ({ roomCode, players, maxNum, turnBased, manualSetup }) => {
  state.roomCode = roomCode;
  state.players = players;
  state.maxNum = maxNum;
  state.turnBased = turnBased;
  state.manualSetup = manualSetup;
  els.displayRoomCode.textContent = roomCode;
  els.lobbyModeBadge.textContent = `Mode: 1-${maxNum}`;
  showScreen('lobby');
});

socket.on('player-list-update', (players) => {
  state.players = players;
  els.playerCount.textContent = `(${players.length})`;
  els.playersList.innerHTML = players.map(p => `
    <div class="player-item">
      <span>${p.name} ${p.id === socket.id ? '(You)' : ''}</span>
      ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
    </div>
  `).join('');
});

socket.on('go-to-setup', ({ maxNum }) => {
  renderSetupBoard(maxNum);
  showScreen('setup');
});

socket.on('game-started', ({ board, maxNum, turnBased, currentPlayerTurn }) => {
  state.board = board;
  state.maxNum = maxNum;
  state.turnBased = turnBased;
  state.currentTurnId = currentPlayerTurn;
  state.isMyTurn = (currentPlayerTurn === socket.id);
  state.calledNumbers = [];
  
  if (turnBased) {
    els.turnIndicator.style.display = 'flex';
    document.getElementById('btn-call-container').style.display = 'block';
    updateTurnUI();
  } else {
    els.turnIndicator.style.display = 'none';
    document.getElementById('btn-call-container').style.display = 'none';
  }

  renderBoard();
  renderCalledNumbersGrid();
  showScreen('game');
  showToast('Game Started!', 'success');
});

socket.on('number-called', ({ number, calledNumbers, callerName, nextTurnId }) => {
  updateCalledNumber(number, calledNumbers, callerName);
  
  // Mark locally if I have it
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (state.board[r][c].value === number) {
        state.board[r][c].marked = true;
      }
    }
  }
  
  if (state.turnBased && nextTurnId) {
    state.currentTurnId = nextTurnId;
    state.isMyTurn = (nextTurnId === socket.id);
    updateTurnUI();
  }
  
  renderBoard();
  checkLocalWin();
});

function updateTurnUI() {
  const currentPlayer = state.players.find(p => p.id === state.currentTurnId);
  els.turnPlayerName.textContent = state.isMyTurn ? "YOUR TURN!" : `${currentPlayer?.name}'s Turn`;
  els.turnIndicator.classList.toggle('active', state.isMyTurn);
  document.getElementById('btn-call-number').style.display = state.isMyTurn ? 'inline-block' : 'none';
}

socket.on('game-over', ({ winnerName, winType }) => {
  els.winTitle.textContent = winnerName === state.playerName ? "YOU WON!" : "BINGO!";
  els.winMessage.textContent = `${winnerName} claims victory!`;
  els.winType.textContent = winType.toUpperCase();
  els.winOverlay.style.display = 'flex';
});

socket.on('error', (msg) => {
  showToast(msg, 'error');
});
