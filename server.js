const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

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

function generateTiles(){
  const tiles=[];
  for(let n=0;n<=9;n++){
    tiles.push({numero:n,color:'negro'});
    tiles.push({numero:n,color:'blanco'});
  }
  return tiles.sort(()=>Math.random()-0.5);
}

function getQuestionAnswer(q,hand){
  switch(q){
    case BASE_QUESTIONS[0]:return hand.reduce((s,t)=>s+t.numero,0).toString();
    case BASE_QUESTIONS[1]:return hand.filter(t=>t.numero%2!==0).length.toString();
    case BASE_QUESTIONS[2]:return hand.filter(t=>t.numero%2===0).length.toString();
    case BASE_QUESTIONS[3]:return hand.filter(t=>t.color==='blanco').reduce((s,t)=>s+t.numero,0).toString();
    case BASE_QUESTIONS[4]:return hand.filter(t=>t.color==='negro').reduce((s,t)=>s+t.numero,0).toString();
    case BASE_QUESTIONS[5]:{
      const r=[];for(let i=0;i<hand.length-1;i++)if(hand[i].color===hand[i+1].color)r.push(`${i+1} y ${i+2}`);
      return r.length?r.join(', '):"Ninguna";
    }
    case BASE_QUESTIONS[6]:{
      const r=[];for(let i=0;i<hand.length-1;i++)if(hand[i].numero===hand[i+1].numero)r.push(`${i+1} y ${i+2}`);
      return r.length?r.join(', '):"Ninguna";
    }
    case BASE_QUESTIONS[7]:{
      const p=[];hand.forEach((t,i)=>{if(t.numero===5)p.push(i+1)});return p.length?p.join(', '):"No tienes";
    }
    case BASE_QUESTIONS[8]:return hand.filter(t=>t.color==='blanco').length.toString();
    case BASE_QUESTIONS[9]:return hand.filter(t=>t.color==='negro').length.toString();
    default:return"Pregunta no reconocida.";
  }
}

const rooms={};

io.on('connection',(socket)=>{
  console.log('Jugador conectado:',socket.id);

  socket.on('joinRoom',({playerName,roomId})=>{
    socket.join(roomId);
    if(!rooms[roomId])rooms[roomId]={players:[],gameState:null};
    if(!rooms[roomId].players.find(p=>p.id===socket.id)){
      rooms[roomId].players.push({id:socket.id,name:playerName});
    }
    io.to(roomId).emit('updateRoom',rooms[roomId].players);
  });

  socket.on('startGame',({roomId})=>{
    const room=rooms[roomId];
    if(!room||room.players.length<2)return;
    const all=generateTiles();
    const hand1=all.splice(0,5).sort((a,b)=>a.numero-b.numero);
    const hand2=all.splice(0,5).sort((a,b)=>a.numero-b.numero);
    const[p1,p2]=room.players;
    room.gameState={
      players:[
        {id:p1.id,name:p1.name,hand:hand1,code:hand1.map(t=>t.numero).join('')},
        {id:p2.id,name:p2.name,hand:hand2,code:hand2.map(t=>t.numero).join('')}
      ],
      questions:[...BASE_QUESTIONS].sort(()=>Math.random()-0.5),
      usedQuestions:new Array(BASE_QUESTIONS.length).fill(false),
      currentPlayerTurn:Math.floor(Math.random()*2)
    };
    io.to(roomId).emit('gameStarted',room.gameState);
  });

  socket.on('selectQuestion',({roomId,questionIndex})=>{
    const room=rooms[roomId];
    if(!room||!room.gameState)return;
    const g=room.gameState;
    const jugador=g.players[g.currentPlayerTurn];
    if(socket.id!==jugador.id)return;

    const q=g.questions[questionIndex];
    const a=getQuestionAnswer(q,jugador.hand);
    g.usedQuestions[questionIndex]=true;

    io.to(roomId).emit('questionResult',{
      title:`Pregunta para ${jugador.name}`,
      body:`"${q}"\n\nRespuesta: ${a}`,
      usedQuestions:g.usedQuestions
    });

    // ⇄ Cambiar turno automáticamente
    g.currentPlayerTurn=(g.currentPlayerTurn+1)%g.players.length;
    io.to(roomId).emit('turnChanged',g.currentPlayerTurn);
  });

  socket.on('guessCode',({roomId,guess})=>{
    const room=rooms[roomId];
    if(!room||!room.gameState)return;
    const g=room.gameState;
    const current=g.players[g.currentPlayerTurn];
    const target=g.players[(g.currentPlayerTurn+1)%2];
    if(socket.id!==current.id)return;
    if(target.code===guess){
      io.to(roomId).emit('gameOver',{winner:current,players:g.players});
    }else{
      socket.emit('guessResult',{correct:false});
      g.currentPlayerTurn=(g.currentPlayerTurn+1)%2;
      io.to(roomId).emit('turnChanged',g.currentPlayerTurn);
    }
  });

  socket.on('disconnect',()=>{
    for(const r in rooms){
      const room=rooms[r];
      const idx=room.players.findIndex(p=>p.id===socket.id);
      if(idx!==-1){
        room.players.splice(idx,1);
        if(room.players.length===0)delete rooms[r];
        else{
          if(room.gameState)io.to(r).emit('playerLeft');
          io.to(r).emit('updateRoom',room.players);
        }
      }
    }
    console.log('Jugador desconectado:',socket.id);
  });
});

app.use(express.static(path.join(__dirname,'public')));
app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
server.listen(PORT,()=>console.log(`Servidor corriendo en http://localhost:${PORT}`));
