const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Allow all origins (Vercel frontend will connect cross-origin)
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Health check for Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms ? rooms.size : 0 });
});

// Serve static files (for local dev / self-hosted)
app.use(express.static('public'));

// ─── Game State ─────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateBoard(maxNum) {
  const numbers = [];
  for (let i = 1; i <= maxNum; i++) numbers.push(i);
  // Shuffle
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  // Pick 24 numbers (center is FREE)
  const picked = numbers.slice(0, 24);
  const board = [];
  let idx = 0;
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      if (r === 2 && c === 2) {
        row.push({ value: 'FREE', marked: true });
      } else {
        row.push({ value: picked[idx++], marked: false });
      }
    }
    board.push(row);
  }
  return board;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkWin(board) {
  // Check rows
  for (let r = 0; r < 5; r++) {
    if (board[r].every(cell => cell.marked)) return { win: true, type: 'row', index: r };
  }
  // Check columns
  for (let c = 0; c < 5; c++) {
    if (board.every(row => row[c].marked)) return { win: true, type: 'column', index: c };
  }
  // Check diagonals
  if ([0,1,2,3,4].every(i => board[i][i].marked)) return { win: true, type: 'diagonal', index: 0 };
  if ([0,1,2,3,4].every(i => board[i][4-i].marked)) return { win: true, type: 'diagonal', index: 1 };
  // Check corners
  if (board[0][0].marked && board[0][4].marked && board[4][0].marked && board[4][4].marked) {
    return { win: true, type: 'corners' };
  }
  // Check full house
  if (board.every(row => row.every(cell => cell.marked))) return { win: true, type: 'fullhouse' };
  return { win: false };
}

// ─── Socket.IO Events ──────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // CREATE ROOM
  socket.on('create-room', ({ playerName, maxNum, callerSpeed, turnBased, manualSetup }) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      maxNum: maxNum || 25,
      callerSpeed: callerSpeed || 5000,
      turnBased: !!turnBased,
      manualSetup: !!manualSetup,
      players: new Map(),
      calledNumbers: [],
      numberPool: [],
      gameStarted: false,
      gameOver: false,
      callerInterval: null,
      winners: [],
      turnOrder: [],
      currentTurnIndex: 0
    };
    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      board: null,
      isHost: true
    });
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit('room-created', {
      roomCode,
      players: Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
    });
    console.log(`Room ${roomCode} created by ${playerName}`);
  });

  // JOIN ROOM
  socket.on('join-room', ({ playerName, roomCode }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error-msg', { message: 'Room not found! Check the code and try again.' });
      return;
    }
    if (room.gameStarted) {
      socket.emit('error-msg', { message: 'Game already in progress!' });
      return;
    }
    if (room.players.size >= 20) {
      socket.emit('error-msg', { message: 'Room is full! (Max 20 players)' });
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      board: null,
      isHost: false
    });
    socket.join(code);
    socket.roomCode = code;

    const playerList = Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
    io.to(code).emit('player-joined', { players: playerList, newPlayer: playerName });
    socket.emit('room-joined', { 
      roomCode: code, 
      players: playerList, 
      maxNum: room.maxNum,
      turnBased: room.turnBased,
      manualSetup: room.manualSetup
    });
    console.log(`${playerName} joined room ${code}`);
  });

  // START GAME
  socket.on('start-game', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;
    if (room.players.size < 1) return;

    if (room.manualSetup) {
      room.gameStarted = "setup"; // Special state
      io.to(room.code).emit('go-to-setup', { maxNum: room.maxNum });
      console.log(`Room ${room.code} entering manual setup`);
    } else {
      beginMatch(room);
    }
  });

  // SUBMIT BOARD (For Manual Setup)
  socket.on('submit-board', ({ board }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.gameStarted !== "setup") return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Basic validation
    if (!Array.isArray(board) || board.length !== 5) return;
    
    // Convert to server cell format
    player.board = board.map((row, r) => row.map((val, c) => {
      if (r === 2 && c === 2) return { value: 'FREE', marked: true };
      return { value: parseInt(val), marked: false };
    }));

    player.ready = true;
    console.log(`Player ${player.name} submitted board in room ${room.code}`);

    // Check if all players are ready
    const allReady = Array.from(room.players.values()).every(p => p.ready);
    if (allReady) {
      beginMatch(room);
    } else {
      io.to(room.code).emit('player-ready', { 
        readyPlayers: Array.from(room.players.values()).filter(p => p.ready).map(p => p.id) 
      });
    }
  });

  function beginMatch(room) {
    room.gameStarted = true;
    
    // Generate boards for those who don't have one (if not manual)
    if (!room.manualSetup) {
      room.players.forEach((player) => {
        player.board = generateBoard(room.maxNum);
      });
    }

    // Set turn order for turn-based mode (Join sequence)
    if (room.turnBased) {
      room.turnOrder = Array.from(room.players.keys()); // Insertion order
      room.currentTurnIndex = 0;
    } else {
      // Create number pool only for bot mode
      const pool = [];
      for (let i = 1; i <= room.maxNum; i++) pool.push(i);
      room.numberPool = shuffleArray(pool);
    }

    // Send each player their board and game info
    room.players.forEach((player) => {
      io.to(player.id).emit('game-started', {
        board: player.board,
        maxNum: room.maxNum,
        playerCount: room.players.size,
        turnBased: room.turnBased,
        currentPlayerTurn: room.turnBased ? room.turnOrder[0] : null
      });
    });

    // Start auto-caller ONLY if NOT turn-based
    if (!room.turnBased) {
      setTimeout(() => {
        callNextNumber(room);
        room.callerInterval = setInterval(() => {
          callNextNumber(room);
        }, room.callerSpeed);
      }, 3000);
    } else {
      // In turn-based, notify the first player specifically
      const firstPlayerId = room.turnOrder[0];
      io.to(firstPlayerId).emit('your-turn');
    }

    console.log(`Match began in room ${room.code} (Turn-based: ${room.turnBased})`);
  }

  // CALL NUMBER (For Turn-Based Mode)
  socket.on('call-number', ({ number }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.turnBased || room.gameOver) return;

    // Check if it's this player's turn
    const currentPlayerId = room.turnOrder[room.currentTurnIndex];
    if (socket.id !== currentPlayerId) return;

    const num = parseInt(number);
    if (isNaN(num) || num < 1 || num > room.maxNum) return;
    if (room.calledNumbers.includes(num)) return;

    room.calledNumbers.push(num);
    const callerName = room.players.get(socket.id).name;

    io.to(room.code).emit('number-called', {
      number: num,
      calledNumbers: room.calledNumbers,
      callerName: callerName,
      callerId: socket.id
    });

    // Move to next turn
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
    const nextPlayerId = room.turnOrder[room.currentTurnIndex];

    io.to(room.code).emit('next-turn', {
      currentTurnId: nextPlayerId,
      currentTurnIndex: room.currentTurnIndex
    });

    io.to(nextPlayerId).emit('your-turn');
  });

  // MARK NUMBER
  socket.on('mark-number', ({ row, col }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted || room.gameOver) return;

    const player = room.players.get(socket.id);
    if (!player || !player.board) return;

    const cell = player.board[row][col];
    if (cell.value === 'FREE') return;

    // Only mark if the number has been called
    if (room.calledNumbers.includes(cell.value)) {
      cell.marked = true;
      socket.emit('cell-marked', { row, col });
    }
  });

  // CLAIM BINGO
  socket.on('claim-bingo', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.gameStarted || room.gameOver) return;

    const player = room.players.get(socket.id);
    if (!player || !player.board) return;

    const result = checkWin(player.board);
    if (result.win) {
      room.gameOver = true;
      if (room.callerInterval) {
        clearInterval(room.callerInterval);
        room.callerInterval = null;
      }
      room.winners.push(player.name);
      io.to(room.code).emit('game-over', {
        winner: player.name,
        winType: result.type,
        winnerId: socket.id
      });
      console.log(`${player.name} won in room ${room.code} with ${result.type}!`);
    } else {
      socket.emit('false-bingo', { message: 'Not a valid BINGO yet! Keep playing.' });
    }
  });

  // PLAY AGAIN
  socket.on('play-again', () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id) return;

    room.gameStarted = false;
    room.gameOver = false;
    room.calledNumbers = [];
    room.numberPool = [];
    room.winners = [];
    if (room.callerInterval) {
      clearInterval(room.callerInterval);
      room.callerInterval = null;
    }

    const playerList = Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
    io.to(room.code).emit('back-to-lobby', { players: playerList });
  });

  // CHANGE SETTINGS
  socket.on('change-settings', ({ maxNum, callerSpeed }) => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.host !== socket.id || room.gameStarted) return;
    if (maxNum) room.maxNum = maxNum;
    if (callerSpeed) room.callerSpeed = callerSpeed;
    io.to(room.code).emit('settings-updated', { maxNum: room.maxNum, callerSpeed: room.callerSpeed });
  });

  // DISCONNECT
  socket.on('disconnect', () => {
    const roomCode = socket.roomCode;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.id);
    room.players.delete(socket.id);

    if (room.players.size === 0) {
      if (room.callerInterval) clearInterval(room.callerInterval);
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted (empty)`);
    } else {
      // If host left, assign new host
      if (room.host === socket.id) {
        const newHost = room.players.values().next().value;
        newHost.isHost = true;
        room.host = newHost.id;
      }
      const playerList = Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
      io.to(roomCode).emit('player-left', {
        players: playerList,
        leftPlayer: player ? player.name : 'Unknown'
      });
    }
    console.log(`Player disconnected: ${socket.id}`);
  });
});

function callNextNumber(room) {
  if (room.gameOver || room.numberPool.length === 0) {
    if (room.callerInterval) {
      clearInterval(room.callerInterval);
      room.callerInterval = null;
    }
    if (room.numberPool.length === 0 && !room.gameOver) {
      room.gameOver = true;
      io.to(room.code).emit('all-numbers-called', { message: 'All numbers have been called!' });
    }
    return;
  }

  const number = room.numberPool.pop();
  room.calledNumbers.push(number);

  io.to(room.code).emit('number-called', {
    number,
    calledNumbers: room.calledNumbers,
    remaining: room.numberPool.length
  });
}

// ─── Start Server ───────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎱 Bingo server running on http://localhost:${PORT}`);
});
