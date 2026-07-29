const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// --- Optional Firestore persistence (works fine without it) ---
let db = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
    db = admin.firestore();
    console.log('Firestore connected — messages will persist.');
  } else {
    console.log('FIREBASE_SERVICE_ACCOUNT not set — running in memory-only mode.');
  }
} catch (e) {
  console.log('Firebase admin init skipped:', e.message);
}

async function saveMessage(roomId, msg) {
  if (!db) return;
  try {
    await db.collection('rooms').doc(roomId).collection('messages').add(msg);
  } catch (e) {
    console.error('Firestore save failed:', e.message);
  }
}

async function loadHistory(roomId, limit = 50) {
  if (!db) return [];
  try {
    const snap = await db
      .collection('rooms').doc(roomId).collection('messages')
      .orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map((d) => d.data()).reverse();
  } catch (e) {
    console.error('Firestore load failed:', e.message);
    return [];
  }
}

// --- App setup ---
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const rooms = {}; // roomId -> Map(socketId -> displayName)

io.on('connection', (socket) => {
  let currentRoom = null;
  let userName = 'Anonymous';

  socket.on('join_room', async ({ roomId, name }) => {
    if (!roomId) return;
    if (currentRoom) socket.leave(currentRoom);

    currentRoom = roomId;
    userName = (name || 'Anonymous').slice(0, 30);
    socket.join(roomId);

    rooms[roomId] = rooms[roomId] || new Map();
    rooms[roomId].set(socket.id, userName);

    socket.emit('history', await loadHistory(roomId));
    io.to(roomId).emit('user_list', Array.from(rooms[roomId].values()));
    socket.to(roomId).emit('system_message', `${userName} joined the room`);
  });

  socket.on('send_message', async ({ text }) => {
    if (!currentRoom || !text) return;
    const msg = { user: userName, text: String(text).slice(0, 1000), timestamp: Date.now() };
    io.to(currentRoom).emit('new_message', msg);
    await saveMessage(currentRoom, msg);
  });

  socket.on('typing', () => {
    if (currentRoom) socket.to(currentRoom).emit('user_typing', userName);
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].delete(socket.id);
      io.to(currentRoom).emit('user_list', Array.from(rooms[currentRoom].values()));
      socket.to(currentRoom).emit('system_message', `${userName} left the room`);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`LiveRoom server running on port ${PORT}`));
