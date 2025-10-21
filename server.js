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
    // Crear las 20 fichas totales (0–9, con sus colores)
    let fichas = [];
    for (let n = 0; n <= 9; n++) {
      if (n === 5) {
        fichas.push({ numero: 5, color: 'verde' });
      } else {
        fichas.push({ numero: n, color: 'negro' });
        fichas.push({ numero: n, color: 'blanco' });
      }
    }

    // Barajar fichas
    fichas.sort(() => Math.random() - 0.5);

    const jugadoresSala = rooms[roomId] || [];
    const totalJugadores = jugadoresSala.length;

    // Repartir 5 fichas por jugador
    const jugadoresEstado = jugadoresSala.map(j => {
      const mano = fichas.splice(0, 5);
      mano.sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
      return { id: j.id, name: j.name, codigo: mano };
    });

    // Calcular las fichas restantes como código central
    let codigoCentral = null;
    // Si hay 3 jugadores, deberían quedar exactamente 5 fichas sin repartir
    if (totalJugadores === 3 && fichas.length === 5) {
      codigoCentral = fichas.sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
    }

    // Debug para confirmar en consola
    console.log('Fichas restantes:', fichas);
    console.log('Código central generado:', codigoCentral?.map(f => f.numero));

    // Enviar el estado al cliente
    io.to(roomId).emit('partidaEmpezada', { jugadoresEstado, codigoCentral });
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', rooms[roomId]);
    }
    console.log('Jugador desconectado:', socket.id);
  });
});

socket.on('joinRoom', ({ roomId, playerName, bot }) => {
  if (!rooms[roomId]) rooms[roomId] = [];
  rooms[roomId].push({ id: socket.id, name: playerName, bot: bot || false });
  socket.join(roomId);
  io.to(roomId).emit('playerList', rooms[roomId]);
});

server.listen(3000, () =>
  console.log('Servidor iniciado en http://localhost:3000')
);
