const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;

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
      const r = []; for (let i = 0; i < hand.length - 1; i++) if (hand[i].color === hand[i+1].color) r.push(`${i+1} y ${i+2}`);
      return r.length ? r.join(', ') : "Ninguna";
    }
    case BASE_QUESTIONS[6]: {
      const r = []; for (let i = 0; i < hand.length - 1; i++) if (hand[i].numero === hand[i+1].numero) r.push(`${i+1} y ${i+2}`);
      return r.length ? r.join(', ') : "Ninguna";
    }
    case BASE_QUESTIONS[7]: {
      const p = []; hand.forEach((t,i)=>{if(t.numero===5)p.push(i+1)}); return p.length?p.join(', '):"No tienes";
    }
    case BASE_QUESTIONS[8]: return hand.filter(t=>t.color==='blanco').length.toString();
    case BASE_QUESTIONS[9]: return hand.filter(t=>t.color==='negro').length.toString();
    default: return "Pregunta no reconocida.";
  }
}

const rooms = {};

io.on('connection', socket => {
  socket.on('joinRoom', ({ playerName, roomId }) => {
    socket.join(roomId);
    if (!rooms[roomId]) rooms[roomId] = { players: [], gameState: null };
    const room = rooms[roomId];
    if (room.players.length >= 4) { socket.emit('roomFull'); return; }
    if (!room.players.find(p=>p.id===socket.id)) room.players.push({ id: socket.id, name: playerName });
    io.to(roomId).emit('updateRoom', room.players);
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;
    const numPlayers = room.players.length;
    const all = generateTiles();
    const hands=[], perPlayer=5;
    for(let i=0;i<numPlayers;i++)hands.push(all.splice(0,perPlayer).sort((a,b)=>a.numero-b.numero));
    const missing=all.splice(0,perPlayer).sort((a,b)=>a.numero-b.numero);
    const missingCode=missing.map(t=>t.numero).join('');
    const mode = numPlayers===2?"versus":numPlayers===3?"missing":"chaos";

    room.gameState={
      mode,
      missing: mode==="missing"?{hand:missing,code:missingCode}:null,
      players: room.players.map((p,i)=>({
        id:p.id,name:p.name,hand:hands[i],code:hands[i].map(t=>t.numero).join(''),
        solved:false
      })),
      questions:[...BASE_QUESTIONS].sort(()=>Math.random()-0.5),
      usedQuestions:new Array(BASE_QUESTIONS.length).fill(false),
      currentPlayerTurn:Math.floor(Math.random()*numPlayers)
    };

    io.to(roomId).emit('gameStarted', room.gameState);
  });

  socket.on('selectQuestion',({roomId,questionIndex})=>{
    const room=rooms[roomId]; if(!room?.gameState)return;
    const g=room.gameState; const pj=g.players[g.currentPlayerTurn];
    if(socket.id!==pj.id)return;
    const q=g.questions[questionIndex];
    g.usedQuestions[questionIndex]=true;
    const ans=[];
    g.players.forEach(p=>{ if(p.id!==socket.id) ans.push({name:p.name,answer:getQuestionAnswer(q,p.hand)}); });
    io.to(roomId).emit('questionResult',{
      title:`Pregunta de ${pj.name}: "${q}"`,
      body:ans.map(a=>`${a.name}: ${a.answer}`).join("\n"),
      usedQuestions:g.usedQuestions
    });
    g.currentPlayerTurn=(g.currentPlayerTurn+1)%g.players.length;
    io.to(roomId).emit('turnChanged', g.currentPlayerTurn);
  });

  socket.on('guessCode',({roomId,guess})=>{
    const room=rooms[roomId]; if(!room?.gameState)return;
    const g=room.gameState;
    const pj=g.players[g.currentPlayerTurn];
    let success=false;

    if(g.mode==="versus"){
      const target=g.players.find(p=>p.id!==socket.id);
      if(guess===target.code){success=true;io.to(roomId).emit('gameOver',{winner:pj,players:g.players});}
    } else if(g.mode==="missing"){
      if(guess===g.missing.code){success=true;io.to(roomId).emit('gameOver',{winner:pj,players:g.players});}
    } else {
      const others=g.players.filter(p=>p.id!==socket.id);
      const hit=others.find(p=>p.code===guess);
      if(hit){pj.solved=true;}
      if(g.players.every(p=>p.solved||p.id===pj.id)){success=true;io.to(roomId).emit('gameOver',{winner:pj,players:g.players});}
    }
    if(!success){ g.currentPlayerTurn=(g.currentPlayerTurn+1)%g.players.length; io.to(roomId).emit('turnChanged',g.currentPlayerTurn);}
  });

  socket.on('disconnect',()=>{
    for(const r in rooms){
      const room=rooms[r];
      const idx=room.players.findIndex(p=>p.id===socket.id);
      if(idx!==-1){room.players.splice(idx,1);
        if(room.players.length===0)delete rooms[r];
        else{io.to(r).emit('updateRoom',room.players);}
      }
    }
  });
});

app.use(express.static(path.join(__dirname,'public')));
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(PORT,()=>console.log(`Servidor listo en http://localhost:${PORT}`));
