const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_ROOM = 4; // Definir el número máximo de jugadores por sala

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
  "¿Cuántas fichas son negras?"
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
    case BASE_QUESTIONS[0]: return hand.reduce((s, t) => s + t.numero, 0).toString();
    case BASE_QUESTIONS[1]: return hand.filter(t => t.numero % 2 !== 0).length.toString();
    case BASE_QUESTIONS[2]: return hand.filter(t => t.numero % 2 === 0).length.toString();
    case BASE_QUESTIONS[3]: return hand.filter(t => t.color === 'blanco').reduce((s, t) => s + t.numero, 0).toString();
    case BASE_QUESTIONS[4]: return hand.filter(t => t.color === 'negro').reduce((s, t) => s + t.numero, 0).toString();
    case BASE_QUESTIONS[5]: {
      const r = []; for (let i = 0; i < hand.length - 1; i++) if (hand[i].color === hand[i + 1].color) r.push(`${i + 1} y ${i + 2}`);
      return r.length ? r.join(', ') : "Ninguna";
    }
    case BASE_QUESTIONS[6]: {
      const r = []; for (let i = 0; i < hand.length - 1; i++) if (hand[i].numero === hand[i + 1].numero) r.push(`${i + 1} y ${i + 2}`);
      return r.length ? r.join(', ') : "Ninguna";
    }
    case BASE_QUESTIONS[7]: {
      const p = []; hand.forEach((t, i) => { if (t.numero === 5) p.push(i + 1); });
      return p.length ? p.join(', ') : "No tienes";
    }
    case BASE_QUESTIONS[8]: return hand.filter(t => t.color === 'blanco').length.toString();
    case BASE_QUESTIONS[9]: return hand.filter(t => t.color === 'negro').length.toString();
    default: return "Pregunta no reconocida.";
  }
}

const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ playerName, roomId }) => {
    // Validar datos de entrada
    if (!playerName || !roomId) {
      socket.emit('error', 'Nombre y ID de sala son requeridos.');
      return;
    }

    // Crear sala si no existe
    if (!rooms[roomId]) rooms[roomId] = { players: [], gameState: null };
    const room = rooms[roomId];

    // No permitir unirse si la sala está llena O si ya hay una partida en curso
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('roomFull');
      return;
    }
    if (room.gameState) {
      socket.emit('error', 'No puedes unirte a una partida en curso.'); // O un evento específico como 'gameAlreadyStarted'
      return;
    }

    // Unirse a la sala si el jugador no está ya en ella
    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({ id: socket.id, name: playerName });
      socket.join(roomId);
      console.log(`${playerName} (${socket.id}) se unió a la sala ${roomId}`);
    } else {
      console.log(`${playerName} (${socket.id}) ya estaba en la sala ${roomId}`);
    }
    
    io.to(roomId).emit('updateRoom', room.players);
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    // Validaciones: sala existe, no hay partida en curso, y jugadores suficientes
    if (!room || room.gameState) return;
    if (room.players.length < 2 || room.players.length > MAX_PLAYERS_PER_ROOM) {
        socket.emit('error', 'Número de jugadores inválido para empezar la partida.');
        return;
    }

    const numPlayers = room.players.length;
    const allTiles = generateTiles();
    const perPlayer = 5; // Cada jugador recibe 5 fichas
    const hands = [];

    // Repartir fichas a los jugadores
    for (let i = 0; i < numPlayers; i++) {
      hands.push(allTiles.splice(0, perPlayer).sort((a, b) => a.numero - b.numero));
    }

    // Lógica para el modo "missing" (para 3 jugadores)
    let missingTiles = null;
    let missingCode = null;
    if (numPlayers === 3) {
        missingTiles = allTiles.splice(0, perPlayer).sort((a, b) => a.numero - b.numero);
        missingCode = missingTiles.map(t => t.numero).join('');
    }

    const mode = numPlayers === 2 ? "versus" : numPlayers === 3 ? "missing" : "chaos"; // Revisar el modo "chaos" para 4 jugadores, ¿es igual a "versus" para todos contra todos?

    room.gameState = {
      mode,
      missing: missingTiles ? { hand: missingTiles, code: missingCode } : null,
      players: room.players.map((p, i) => ({
        id: p.id,
        name: p.name,
        hand: hands[i],
        code: hands[i].map(t => t.numero).join(''),
        solved: false // Para el modo "chaos" si se implementa un target
      })),
      questions: [...BASE_QUESTIONS].sort(() => Math.random() - 0.5), // Copia para no mutar el original
      usedQuestions: new Array(BASE_QUESTIONS.length).fill(false),
      currentPlayerTurn: Math.floor(Math.random() * numPlayers)
    };

    console.log(`Partida iniciada en sala ${roomId}. Modo: ${room.gameState.mode}`);
    io.to(roomId).emit('gameStarted', room.gameState);
  });

  socket.on('selectQuestion', ({ roomId, questionIndex }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const g = room.gameState;
    const jugador = g.players.find(p => p.id === socket.id); // Asegurar que es el jugador que hizo la pregunta
    if (!jugador || socket.id !== g.players[g.currentPlayerTurn].id || g.usedQuestions[questionIndex]) return;

    const pregunta = g.questions[questionIndex];
    g.usedQuestions[questionIndex] = true;

    const respuestas = [];
    g.players.forEach(p => {
      // En modo versus y chaos, no dar la respuesta del jugador actual.
      // En modo missing, se da la respuesta del "missing hand".
      if (g.mode === "missing") {
          respuestas.push({ nombre: p.name, respuesta: getQuestionAnswer(pregunta, p.hand) });
          respuestas.push({ nombre: "Código Oculto", respuesta: getQuestionAnswer(pregunta, g.missing.hand) });
      } else { // Versus o Chaos
          if (p.id !== socket.id)
            respuestas.push({ nombre: p.name, respuesta: getQuestionAnswer(pregunta, p.hand) });
      }
    });
    
    // Eliminar duplicados si los hubiera por el modo missing.
    const uniqueResponses = Array.from(new Set(respuestas.map(JSON.stringify))).map(JSON.parse);


    console.log(`Jugador ${jugador.name} preguntó "${pregunta}" en sala ${roomId}`);
    io.to(roomId).emit('questionResult', {
      title: `Pregunta de ${jugador.name}: "${pregunta}"`,
      body: uniqueResponses.map(r => `${r.nombre}: ${r.respuesta}`).join('\n'),
      usedQuestions: g.usedQuestions,
      autor: socket.id // Quien hizo la pregunta, para que solo él pueda cerrarla
    });
  });

  socket.on('closeQuestion', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const g = room.gameState;
    const current = g.players[g.currentPlayerTurn];
    if (current.id !== socket.id) return; // Solo el jugador actual puede cerrar su pregunta y pasar turno

    g.currentPlayerTurn = (g.currentPlayerTurn + 1) % g.players.length;
    // Saltar a jugadores que hayan sido "resueltos" en modo chaos si se implementa
    while (g.players[g.currentPlayerTurn].solved && g.mode === "chaos") {
        g.currentPlayerTurn = (g.currentPlayerTurn + 1) % g.players.length;
        if (g.currentPlayerTurn === current) break; // Evitar loop infinito si todos están solved
    }

    console.log(`Turno cambiado en sala ${roomId} a ${g.players[g.currentPlayerTurn].name}`);
    io.to(roomId).emit('turnChanged', g.currentPlayerTurn);
  });

  socket.on('guessCode', ({ roomId, guess }) => {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const g = room.gameState;
    const jugadorQueAdivina = g.players[g.currentPlayerTurn];

    // Validar el guess
    if (!guess || guess.length !== 5 || !/^\d+$/.test(guess)) {
        socket.emit('error', 'El código debe ser de 5 dígitos numéricos.');
        // No pasamos el turno si el intento es inválido en formato
        return;
    }

    let success = false;
    let winner = null;

    console.log(`${jugadorQueAdivina.name} intenta adivinar ${guess} en sala ${roomId}.`);

    if (g.mode === "versus") {
      const target = g.players.find(p => p.id !== socket.id); // Asume 2 jugadores
      if (target && target.code === guess) {
        success = true;
        winner = jugadorQueAdivina;
      }
    } else if (g.mode === "missing") {
      if (g.missing && guess === g.missing.code) {
        success = true;
        winner = jugadorQueAdivina;
      }
    } else if (g.mode === "chaos") {
      // En modo chaos, un jugador adivina el código de otro jugador (no el suyo).
      // El primer jugador en adivinar el código de otro, lo "resuelve".
      // Gana el último jugador cuyo código no haya sido adivinado, o el primero en adivinar todos los demás (variantes)
      // Por simplicidad, implementamos: si adivina correctamente el de OTRO, lo marca como resuelto.
      // Cuando todos los demás han sido resueltos por el jugador actual, este gana.
      
      const targetPlayer = g.players.find(p => p.id !== socket.id && p.code === guess);
      if (targetPlayer) {
          // Si adivina su propio código por error, no pasa nada, falla el guess.
          // Si adivina el de otro, lo marca como "solved" por el adivinador.
          // Para esta lógica, si el adivinador adivina el de alguien, ese 'alguien' está solved.
          const solvedPlayer = g.players.find(p => p.id === targetPlayer.id);
          if (solvedPlayer) {
              solvedPlayer.solved = true;
              io.to(roomId).emit('playerSolved', { playerName: solvedPlayer.name }); // Notificar a los demás
              console.log(`${jugadorQueAdivina.name} adivinó el código de ${solvedPlayer.name}.`);
          }

          // ¿Ha adivinado el último código restante (todos los demás)?
          const remainingPlayers = g.players.filter(p => p.id !== socket.id && !p.solved);
          if (remainingPlayers.length === 0) {
            success = true;
            winner = jugadorQueAdivina;
          }
      }
    }

    if (success) {
      console.log(`${winner.name} ganó la partida en sala ${roomId}.`);
      io.to(roomId).emit('gameOver', { winner: winner, players: g.players });
      delete rooms[roomId]; // Limpiar la sala después de que termine la partida
    } else {
      // Si el intento fue incorrecto o no hubo un objetivo válido
      // El turno pasa al siguiente jugador, a menos que el guess haya sido inválido por formato.
      g.currentPlayerTurn = (g.currentPlayerTurn + 1) % g.players.length;
      io.to(roomId).emit('turnChanged', g.currentPlayerTurn);
      console.log(`Intento incorrecto en sala ${roomId}. Turno pasado a ${g.players[g.currentPlayerTurn].name}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
    for (const r in rooms) {
      const room = rooms[r];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        const playerName = room.players[playerIndex].name;
        room.players.splice(playerIndex, 1); // Eliminar al jugador

        if (room.players.length === 0) {
          // Si la sala se queda vacía, eliminarla
          delete rooms[r];
          console.log(`Sala ${r} eliminada porque todos los jugadores se desconectaron.`);
        } else {
          // Notificar a los jugadores restantes
          io.to(r).emit('updateRoom', room.players);

          // Lógica específica si el jugador se fue durante una partida
          if (room.gameState) {
            console.log(`Jugador ${playerName} (${socket.id}) abandonó la partida en sala ${r}.`);
            
            // Si la partida ya no puede continuar (ej. menos de 2 jugadores)
            if (room.players.length < 2) {
              io.to(r).emit('gameOver', { winner: { name: "La partida terminó" }, players: room.gameState.players });
              delete rooms[r];
              console.log(`Partida en sala ${r} terminada por falta de jugadores.`);
              return;
            }

            // Si era el turno del jugador que se fue, pasar el turno
            if (room.gameState.players[room.gameState.currentPlayerTurn].id === socket.id) {
              room.gameState.currentPlayerTurn = room.gameState.currentPlayerTurn % room.players.length; // Ajustar el índice
              io.to(r).emit('turnChanged', room.gameState.currentPlayerTurn);
            }
            // Eliminar al jugador del gameState también
            room.gameState.players = room.gameState.players.filter(p => p.id !== socket.id);
            // Reajustar currentPlayerTurn si el índice actual era mayor que el nuevo tamaño del array
            if (room.gameState.currentPlayerTurn >= room.gameState.players.length) {
              room.gameState.currentPlayerTurn = 0; // O el último jugador
            }

            io.to(r).emit('playerLeft', { playerName: playerName, newTurn: room.gameState.currentPlayerTurn });
          }
        }
        break; // Jugador encontrado y procesado
      }
    }
  });
});

app.use(express.static(path.join(__dirname, 'public')));
// Si 'public' no existe o si index.html está en la raíz, ajusta la ruta.
// Asumo que 'index.html' está en la carpeta raíz del proyecto, o en 'public'.
// Si está en la raíz, debería ser `res.sendFile(path.join(__dirname, 'index.html'));`
// Si hay una carpeta 'public', entonces `app.use(express.static(path.join(__dirname, 'public')));`
// y `res.sendFile(path.join(__dirname, 'public', 'index.html'));` son correctos si el frontend está ahí.
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));


server.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));