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

  socket.on('joinRoom', ({ roomId, playerName, bot }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: playerName, bot: bot || false });
    socket.join(roomId);
    io.to(roomId).emit('playerList', rooms[roomId]);
  });

  socket.on('empezarPartida', ({ roomId }) => {
    let fichas = [];
    for (let n = 0; n <= 9; n++) {
      if (n === 5) {
        fichas.push({ numero: 5, color: 'verde' });
      } else {
        fichas.push({ numero: n, color: 'negro' });
        fichas.push({ numero: n, color: 'blanco' });
      }
    }
    fichas.sort(() => Math.random() - 0.5);

    let jugadoresSala = rooms[roomId] || [];

    // Añade un bot automáticamente cuando hay exactamente 3 humanos
    const jugadoresHumanos = jugadoresSala.filter(j => !j.bot);
    if (jugadoresHumanos.length === 3 && jugadoresSala.length === 3) {
      jugadoresSala.push({
        id: 'bot-auto-' + Math.floor(Math.random() * 10000),
        name: 'BOT-MAESTRO',
        bot: true
      });
      rooms[roomId] = jugadoresSala;
      io.to(roomId).emit('playerList', rooms[roomId]);
    }

    const totalJugadores = jugadoresSala.length;

    const jugadoresEstado = jugadoresSala.map(j => {
      const mano = fichas.splice(0, 5);
      mano.sort((a, b) => {
        if (a.numero === b.numero) return a.color === 'negro' ? -1 : 1;
        return a.numero - b.numero;
      });
      return { id: j.id, name: j.name, bot: j.bot, codigo: mano };
    });

    // Cuando hay bot, no hay código central. El objetivo es adivinar el código del bot.
    let codigoCentral = null;
    let objetivoBot = false;
    if (jugadoresEstado.some(j => j.bot) && totalJugadores === 4) {
      objetivoBot = true;
    }

    io.to(roomId).emit('partidaEmpezada', { jugadoresEstado, codigoCentral, objetivoBot });
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
