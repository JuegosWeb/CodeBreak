const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static('public'));

let rooms = {};

io.on('connection', (socket) => {
  console.log('Jugador conectado:', socket.id);

  // Maneja la entrada de un jugador (incluye bots)
  socket.on('joinRoom', ({ roomId, playerName, bot }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: playerName, bot: bot || false });
    socket.join(roomId);
    io.to(roomId).emit('playerList', rooms[roomId]);
  });

  // Inicia la partida y reparte fichas
  socket.on('empezarPartida', ({ roomId }) => {
    // Genera las 20 fichas únicas del juego
    let fichas = [];
    for (let n = 0; n <= 9; n++) {
      if (n === 5) {
        fichas.push({ numero: 5, color: 'verde' });
      } else {
        fichas.push({ numero: n, color: 'negro' });
        fichas.push({ numero: n, color: 'blanco' });
      }
    }
    // Mezcla las fichas
    fichas.sort(() => Math.random() - 0.5);

    const jugadoresSala = rooms[roomId] || [];
    const totalJugadores = jugadoresSala.length;

    // Reparte 5 fichas por jugador
    const jugadoresEstado = jugadoresSala.map(j => {
      const mano = fichas.splice(0, 5);
      mano.sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
      return { id: j.id, name: j.name, bot: j.bot, codigo: mano };
    });

    // Calcula las fichas restantes como código central (para 3 jugadores)
    let codigoCentral = null;
    if (totalJugadores === 3 && fichas.length === 5) {
      codigoCentral = fichas.sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
    }

    io.to(roomId).emit('partidaEmpezada', { jugadoresEstado, codigoCentral });
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', rooms[roomId]);
    });
    console.log('Jugador desconectado:', socket.id);
  });
});

server.listen(3000, () =>
  console.log('Servidor iniciado en http://localhost:3000')
);
