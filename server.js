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

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: playerName });
    socket.join(roomId);
    io.to(roomId).emit('playerList', rooms[roomId]);
  });

  socket.on('empezarPartida', ({ roomId }) => {
    // Crear las 20 fichas totales (0–9, negras y blancas, 5 verde especial)
    let fichas = [];
    for (let n = 0; n <= 9; n++) {
      if (n === 5) {
        fichas.push({ numero: 5, color: 'verde' });
      } else {
        fichas.push({ numero: n, color: 'negro' });
        fichas.push({ numero: n, color: 'blanco' });
      }
    }

    // Mezclar fichas
    fichas.sort(() => Math.random() - 0.5);

    // Obtener lista de jugadores
    let jugadoresSala = rooms[roomId];
    const totalJugadores = jugadoresSala.length;

    // Repartir 5 fichas por jugador
    let jugadoresEstado = jugadoresSala.map(j => {
      let mano = fichas.splice(0, 5);
      mano.sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
      return { id: j.id, name: j.name, codigo: mano };
    });

    // Las fichas restantes forman el código central
    let codigoCentral = null;
    if (totalJugadores === 3) {
      codigoCentral = [...fichas].sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
    }

    // Enviar estado completo a todos los jugadores
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
