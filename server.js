const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_ROOM = 4;

const BASE_QUESTIONS = [
  "¿Cuánto suman tus fichas?",
  "¿Cuántas fichas impares tienes?",
  "¿Cuántas fichas pares tienes? (El 0 es par)",
  "¿Cuánto suman tus números blancos?",
  "¿Cuánto suman tus números negros?",
  "¿Qué fichas adyacentes tienen el mismo color?",
  "¿Qué fichas adyacentes tienen el mismo número?",
  "¿Dónde están tus fichas con el número 5? (posiciones 1-5)",
  "¿Cuántas fichas son blancas?",
  "¿Cuántas fichas son negras?",
  "¿Cuánto suman tus fichas centrales? (2-3 jugadores: B y C / 4 jugadores: B y C)",
  "¿Cuánto suman tus 3 fichas de más a la derecha?",
  "¿Cuánto suman tus 3 fichas de más a la izquierda?",
  "¿Cuántas fichas pares tienes? (Se considera que el 0 es un número par)",
  "¿Dónde están tus fichas con el n.º 5?",
  "¿Dónde están tus fichas con el n.º 6 o el n.º 7? (Debes elegir un número antes de hacer esta pregunta)",
  "¿Dónde están tus fichas con el n.º 0?",
  "¿Dónde están tus fichas con el n.º 3 o el n.º 4? (Debes elegir un número antes de hacer esta pregunta)",
  "¿Dónde están tus fichas con el n.º 8 o el n.º 9? (Debes elegir un número antes de hacer esta pregunta)",
  "¿Cuántas de tus fichas tienen el mismo número?",
  "¿Cuántos de tus fichas tienen un número negro?",
  "¿Qué fichas adyacentes tienen números consecutivos?",
  "¿Cuál es la diferencia entre tu número más alto y tu número más bajo?"
];

function generateTiles() {
  const tiles = [];
  for (let n = 0; n <= 9; n++) {
    tiles.push({ numero: n, color: 'negro' });
    tiles.push({ numero: n, color: 'blanco' });
  }
  return tiles.sort(() => Math.random() - 0.5);
}

function getQuestionAnswer(q, hand) {
  switch (q) {
    case BASE_QUESTIONS[0]: // ¿Cuánto suman tus fichas?
      return hand.reduce((s, t) => s + t.numero, 0).toString();

    case BASE_QUESTIONS[1]: // ¿Cuántas fichas impares tienes?
      return hand.filter(t => t.numero % 2 !== 0).length.toString();

    case BASE_QUESTIONS[2]: // ¿Cuántas fichas pares tienes? (El 0 es par)
    case BASE_QUESTIONS[13]: // Repetida
      return hand.filter(t => t.numero % 2 === 0).length.toString();

    case BASE_QUESTIONS[3]: // ¿Cuánto suman tus números blancos?
      return hand.filter(t => t.color === 'blanco').reduce((s, t) => s + t.numero, 0).toString();

    case BASE_QUESTIONS[4]: // ¿Cuánto suman tus números negros?
      return hand.filter(t => t.color === 'negro').reduce((s, t) => s + t.numero, 0).toString();

    case BASE_QUESTIONS[5]: // ¿Qué fichas adyacentes tienen el mismo color?
      {
        const r = [];
        for (let i = 0; i < hand.length - 1; i++)
          if (hand[i].color === hand[i + 1].color)
            r.push(`${i + 1} y ${i + 2}`);
        return r.length ? r.join(', ') : "Ninguna";
      }

    case BASE_QUESTIONS[6]: // ¿Qué fichas adyacentes tienen el mismo número?
      {
        const r = [];
        for (let i = 0; i < hand.length - 1; i++)
          if (hand[i].numero === hand[i + 1].numero)
            r.push(`${i + 1} y ${i + 2}`);
        return r.length ? r.join(', ') : "Ninguna";
      }

    case BASE_QUESTIONS[7]: // ¿Dónde están tus fichas con el número 5? (posiciones 1-5)
    case BASE_QUESTIONS[14]: // ¿Dónde están tus fichas con el n.º 5?
      {
        const p = [];
        hand.forEach((t, i) => { if (t.numero === 5) p.push(i + 1); });
        return p.length ? p.join(', ') : "No tienes";
      }

    case BASE_QUESTIONS[8]: // ¿Cuántas fichas son blancas?
      return hand.filter(t => t.color === 'blanco').length.toString();

    case BASE_QUESTIONS[9]: // ¿Cuántas fichas son negras?
      return hand.filter(t => t.color === 'negro').length.toString();

    case BASE_QUESTIONS[10]: // ¿Cuánto suman tus fichas centrales?
      if(hand.length >= 3)
        return (hand[1].numero + hand[2].numero).toString();
      else if(hand.length === 2)
        return hand[1].numero.toString();
      else
        return "Pregunta no aplicable";

    case BASE_QUESTIONS[11]: // ¿Cuánto suman tus 3 fichas de más a la derecha?
      if(hand.length >= 3)
        return hand.slice(-3).reduce((s, t) => s + t.numero, 0).toString();
      else
        return "Pregunta no aplicable";

    case BASE_QUESTIONS[12]: // ¿Cuánto suman tus 3 fichas de más a la izquierda?
      if(hand.length >= 3)
        return hand.slice(0,3).reduce((s, t) => s + t.numero, 0).toString();
      else
        return "Pregunta no aplicable";

    case BASE_QUESTIONS[15]: // ¿Dónde están tus fichas con el n.º 6 o el n.º 7?
      {
        const p = [];
        hand.forEach((t, i) => { if (t.numero === 6 || t.numero === 7) p.push(`${t.numero} en pos ${i + 1}`); });
        return p.length ? p.join(', ') : "No tienes";
      }

    case BASE_QUESTIONS[16]: // ¿Dónde están tus fichas con el n.º 0?
      {
        const p = [];
        hand.forEach((t, i) => { if (t.numero === 0) p.push(i + 1); });
        return p.length ? p.join(', ') : "No tienes";
      }

    case BASE_QUESTIONS[17]: // ¿Dónde están tus fichas con el n.º 3 o el n.º 4?
      {
        const p = [];
        hand.forEach((t, i) => { if (t.numero === 3 || t.numero === 4) p.push(`${t.numero} en pos ${i + 1}`); });
        return p.length ? p.join(', ') : "No tienes";
      }

    case BASE_QUESTIONS[18]: // ¿Dónde están tus fichas con el n.º 8 o el n.º 9?
      {
        const p = [];
        hand.forEach((t, i) => { if (t.numero === 8 || t.numero === 9) p.push(`${t.numero} en pos ${i + 1}`); });
        return p.length ? p.join(', ') : "No tienes";
      }

    case BASE_QUESTIONS[19]: // ¿Cuántas de tus fichas tienen el mismo número?
      {
        const counts = {};
        hand.forEach(t => counts[t.numero] = (counts[t.numero] || 0) + 1);
        const repetidas = Object.values(counts).filter(c => c > 1).reduce((a,b) => a + b, 0);
        return repetidas.toString();
      }

    case BASE_QUESTIONS[20]: // ¿Cuántos de tus fichas tienen un número negro?
      return hand.filter(t => t.color === 'negro').length.toString();

    case BASE_QUESTIONS[21]: // ¿Qué fichas adyacentes tienen números consecutivos?
      {
        const r = [];
        for (let i = 0; i < hand.length - 1; i++)
          if (Math.abs(hand[i].numero - hand[i+1].numero) === 1)
            r.push(`${i + 1} y ${i + 2}`);
        return r.length ? r.join(', ') : "Ninguna";
      }

    case BASE_QUESTIONS[22]: // ¿Cuál es la diferencia entre tu número más alto y tu número más bajo?
      {
        const nums = hand.map(t=>t.numero);
        if(!nums.length) return "No tienes fichas";
        return (Math.max(...nums)-Math.min(...nums)).toString();
      }

    default:
      return "Pregunta no reconocida.";
  }
}

const rooms = {};

// ---- SOCKET Y RESTO DEL SERVIDOR ----

io.on('connection', (socket) => {
  // Unirse a sala
  socket.on('joinRoom', ({ playerName, roomId }) => {
    if (!playerName || !roomId) {
      socket.emit('error', 'Nombre y sala requeridos.');
      return;
    }

    if (!rooms[roomId]) rooms[roomId] = { players: [], gameState: null };
    const room = rooms[roomId];
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('roomFull');
      return;
    }
    if (room.gameState) {
      socket.emit('error', 'No puedes unirte a una partida en curso.');
      return;
    }

    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({ id: socket.id, name: playerName });
      socket.join(roomId);
      console.log(`${playerName} se unió a la sala ${roomId}`);
    }
    io.to(roomId).emit('updateRoom', room.players);
  });

  // Iniciar partida
  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.gameState) return;
    if (room.players.length < 2 || room.players.length > MAX_PLAYERS_PER_ROOM) {
      socket.emit('error', 'Número de jugadores inválido.');
      return;
    }

    const numPlayers = room.players.length;
    const allTiles = generateTiles();
    const perPlayer = 5;
    const hands = [];

    for (let i = 0; i < numPlayers; i++) {
      hands.push(allTiles.splice(0, perPlayer).sort((a, b) => a.numero - b.numero));
    }

    let missingTiles = null;
    let missingCode = null;
    if (numPlayers === 3) {
      missingTiles = allTiles.splice(0, perPlayer).sort((a, b) => a.numero - b.numero);
      missingCode = missingTiles.map(t => t.numero).join('');
    }

    const mode = numPlayers === 2 ? "versus" : numPlayers === 3 ? "missing" : "chaos";

    // determine starter: the player who requested startGame (usually room creator)
    const starterIndex = room.players.findIndex(p => p.id === socket.id);
    room.gameState = {
      mode,
      missing: missingTiles ? { hand: missingTiles, code: missingCode } : null,
      players: room.players.map((p, i) => ({
        id: p.id, name: p.name, hand: hands[i], code: hands[i].map(t => t.numero).join(''), solved: false
      })),
      questions: [...BASE_QUESTIONS].sort(() => Math.random() -0.5),
      usedQuestions: new Array(BASE_QUESTIONS.length).fill(false),
      // Start with the player who requested the start (usually the creator)
      currentPlayerTurn: (starterIndex >=0) ? starterIndex :0
    };

    console.log(`Partida iniciada en sala ${roomId}. Modo: ${room.gameState.mode}`);
    io.to(roomId).emit('gameStarted', room.gameState);
  });

  // Seleccionar pregunta
  socket.on('selectQuestion', ({ roomId, questionIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const g = room.gameState;
    const jugador = g.players[g.currentPlayerTurn];
    if (!jugador || jugador.id !== socket.id || g.usedQuestions[questionIndex]) return;

    const pregunta = g.questions[questionIndex];
    g.usedQuestions[questionIndex] = true;

    const respuestas = [];
    if (g.mode === "missing") {
      g.players.forEach(p => respuestas.push({ nombre: p.name, respuesta: getQuestionAnswer(pregunta, p.hand) }));
      respuestas.push({ nombre: "Código Oculto", respuesta: getQuestionAnswer(pregunta, g.missing.hand) });
    } else {
      g.players.forEach(p => { if (p.id !== socket.id) respuestas.push({ nombre: p.name, respuesta: getQuestionAnswer(pregunta, p.hand) }); });
    }

    io.to(roomId).emit('questionResult', {
      title: `Pregunta de ${jugador.name}: "${pregunta}"`,
      body: respuestas.map(r => `${r.nombre}: ${r.respuesta}`).join('\n'),
      usedQuestions: g.usedQuestions,
      autor: socket.id
    });
  });

  // Cerrar pregunta y pasar turno
  socket.on('closeQuestion', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const g = room.gameState;
    const current = g.players[g.currentPlayerTurn];
    if (!current || current.id !== socket.id) return;

    g.currentPlayerTurn = (g.currentPlayerTurn + 1) % g.players.length;
    io.to(roomId).emit('turnChanged', g.currentPlayerTurn);
  });

  // Adivinar código
  socket.on('guessCode', ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const g = room.gameState;
    const jugador = g.players[g.currentPlayerTurn];
    if (!guess || guess.length !== 5 || !/^\d+$/.test(guess)) {
      socket.emit('error', 'El código debe tener 5 dígitos numéricos.');
      return;
    }

    let success = false;
    let winner = null;

    if (g.mode === "versus") {
      const target = g.players.find(p => p.id !== socket.id);
      if (target && target.code === guess) { success = true; winner = jugador; }
    } else if (g.mode === "missing") {
      if (g.missing && guess === g.missing.code) { success = true; winner = jugador; }
    } else if (g.mode === "chaos") {
      const target = g.players.find(p => p.id !== socket.id && p.code === guess);
      if (target) {
        target.solved = true;
        io.to(roomId).emit('playerSolved', { playerName: target.name });
        const allSolved = g.players.filter(p => p.id !== socket.id).every(p => p.solved);
        if (allSolved) { success = true; winner = jugador; }
      }
    }

    if (success) {
      io.to(roomId).emit('gameOver', { winner, players: g.players });
      delete rooms[roomId];
    } else {
      g.currentPlayerTurn = (g.currentPlayerTurn + 1) % g.players.length;
      io.to(roomId).emit('turnChanged', g.currentPlayerTurn);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    for (const r in rooms) {
      const room = rooms[r];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const playerName = room.players[idx].name;
        room.players.splice(idx, 1);
        if (room.players.length === 0) delete rooms[r];
        else {
          io.to(r).emit('updateRoom', room.players);
          if (room.gameState) {
            if (room.players.length < 2) {
              io.to(r).emit('gameOver', { winner: { name: "Partida terminada" }, players: room.gameState.players });
              delete rooms[r];
              return;
            }
            if (room.gameState.players[room.gameState.currentPlayerTurn]?.id === socket.id) {
              room.gameState.currentPlayerTurn = room.gameState.currentPlayerTurn % room.players.length;
              io.to(r).emit('turnChanged', room.gameState.currentPlayerTurn);
            }
            room.gameState.players = room.gameState.players.filter(p => p.id !== socket.id);
            if (room.gameState.currentPlayerTurn >= room.gameState.players.length) room.gameState.currentPlayerTurn = 0;
            io.to(r).emit('playerLeft', { playerName, newTurn: room.gameState.currentPlayerTurn });
          }
        }
      }
    }
  });

  // Leave room (client requests to leave before disconnect)
  socket.on('leaveRoom', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx !== -1) {
      const playerName = room.players[idx].name;
      room.players.splice(idx,1);
      socket.leave(roomId);
      if (room.players.length ===0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('updateRoom', room.players);
      }
      console.log(`${playerName} left room ${roomId}`);
    }
  });
});

// servir static asegurando charset en .html
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// fallback (ruta única)
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
