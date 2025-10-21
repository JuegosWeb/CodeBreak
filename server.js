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
socket.on('empezarPartida', ({ roomId }) => {
  // Aquí repartes las fichas y envías el estado inicial a TODOS
  io.to(roomId).emit('partidaEmpezada', { iniciado: true });
});

  socket.on('joinRoom', ({ roomId, playerName }) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: playerName });
    socket.join(roomId);
    io.to(roomId).emit('playerList', rooms[roomId]);
  });

  socket.on('playAction', ({ roomId, action }) => {
    io.to(roomId).emit('actionUpdate', action);
  });

  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(roomId => {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      io.to(roomId).emit('playerList', rooms[roomId]);
    });
    console.log('Jugador desconectado:', socket.id);
  });
});

function empezarPartida() {
  socket.emit('empezarPartida', { roomId });
}

socket.on('partidaEmpezada', ({ iniciado }) => {
  if (iniciado) {
    // Oculta botones y muestra la interfaz de la partida
    document.getElementById("btnEmpezar").style.display = "none";
    // Aquí puedes llamar a tu función de inicializar el juego, dibujar tablero, etc.
  }
});

socket.on('playerList', players => {
  document.getElementById('status').innerHTML = 'Jugadores conectados:<br>' + players.map(p=>p.name).join('<br>');
  if (players.length >= 2) { // Puedes cambiar el número mínimo
    document.getElementById("btnEmpezar").style.display = "";
  } else {
    document.getElementById("btnEmpezar").style.display = "none";
  }
});

server.listen(3000, () => console.log('Servidor iniciado en http://localhost:3000'));
