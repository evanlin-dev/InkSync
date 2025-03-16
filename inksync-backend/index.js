require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const cors = require('cors');
const Session = require('./models/Session');
const msgpack = require("msgpack-lite");

// Middleware 
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(express.raw({ type: 'application/x-msgpack' }));  // Expect raw binary data (MessagePack) 

const mongoURI = process.env.MONGO_URI;

const activeConnections = {};         // Maps session ID to active connections count
const deleteTimeouts = {};            // Maps session ID to deletion timeout IDs
const userIndexMap = {};              // Maps session ID to { userIndex: [commandIndices] }

// This doesn't scale well for long-running sessions or server restarts.
const commandStack = {};              // Maps session ID to an array of all drawing commands

const userCommandPointerMap = {};     // Maps session ID to { userIndex: current pointer } 

wss.on('connection', (ws, req) => {
  const sessionId = req.url.slice(1);
  console.log(`Client connected to session ${sessionId}`);

  function broadcastToSession(data) {
    wss.clients.forEach(client => {
      // Send data to all clients
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }

  // Initialize session data if not present
  if (!commandStack[sessionId]) commandStack[sessionId] = [];
  if (!userIndexMap[sessionId]) userIndexMap[sessionId] = {};
  if (!userCommandPointerMap[sessionId]) userCommandPointerMap[sessionId] = {};

  // Send initial sync to the newly connected client
  if (commandStack[sessionId].length > 0) {
    ws.send(JSON.stringify({
      action: 'sync',
      stack: commandStack[sessionId],
      pointerMap: userCommandPointerMap[sessionId]
    }));
  }

  // Increment active connection count
  activeConnections[sessionId] = (activeConnections[sessionId] || 0) + 1;
  console.log(`Active connections for ${sessionId}: ${activeConnections[sessionId]}`);

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from session ${sessionId}:`, data);

      if (data.action === 'draw') {
        // Tag the drawing command with user info and active status
        data.command.active = true;
        data.command.userIndex = data.userIndex;

        // Save to the global command stack
        commandStack[sessionId].push(data.command);

        // Initialize the user's command list if needed
        if (!userIndexMap[sessionId][data.userIndex]) {
          userIndexMap[sessionId][data.userIndex] = [];
        }
        // Save the index of this command for the user
        userIndexMap[sessionId][data.userIndex].push(commandStack[sessionId].length - 1);

        // Update the pointer: all commands are active after a draw
        userCommandPointerMap[sessionId][data.userIndex] =
          userIndexMap[sessionId][data.userIndex].length;

        // Broadcast a sync update with the new command stack and pointer map
        broadcastToSession({
          action: 'sync',
          stack: commandStack[sessionId],
          pointerMap: userCommandPointerMap[sessionId]
        });
      }
      else if (data.action === 'undo') {
        const userIdx = data.userIndex;
        const userCommands = userIndexMap[sessionId][userIdx];
        if (!userCommands || userCommands.length === 0) {
          console.log(`User ${userIdx} has no commands to undo`);
          return;
        }

        // Get the current pointer for this user
        let pointer = (typeof userCommandPointerMap[sessionId][userIdx] === 'number'
          ? userCommandPointerMap[sessionId][userIdx]
          : userCommands.length);

        if (pointer > 0) {
          const cmdIndex = userCommands[pointer - 1];
          if (commandStack[sessionId][cmdIndex].active) {
            commandStack[sessionId][cmdIndex].active = false;
            userCommandPointerMap[sessionId][userIdx] = pointer - 1;
            console.log(`User ${userIdx} undid command at global index ${cmdIndex}`);

            // Broadcast the specific undo operation to all clients
            broadcastToSession({
              action: 'undoOperation',
              userIndex: userIdx,
              cmdIndex: cmdIndex
            });
          }
        }

        // Sync updated state with all clients
        // This works well for small to medium sessions but could become problematic with:
        // Large numbers of drawing operations
        // Many concurrent users
        // Complex drawings
        broadcastToSession({
          action: 'sync',
          stack: commandStack[sessionId],
          pointerMap: userCommandPointerMap[sessionId]
        });
      }

      // For redo:
      else if (data.action === 'redo') {
        const userIdx = data.userIndex;
        const userCommands = userIndexMap[sessionId][userIdx];
        if (!userCommands || userCommands.length === 0) {
          console.log(`User ${userIdx} has no commands to redo`);
          return;
        }

        let pointer = (typeof userCommandPointerMap[sessionId][userIdx] === 'number'
          ? userCommandPointerMap[sessionId][userIdx]
          : userCommands.length);

        if (pointer < userCommands.length) {
          const cmdIndex = userCommands[pointer];
          if (!commandStack[sessionId][cmdIndex].active) {
            commandStack[sessionId][cmdIndex].active = true;
            userCommandPointerMap[sessionId][userIdx] = pointer + 1;
            console.log(`User ${userIdx} redid command at global index ${cmdIndex}`);

            // Broadcast the specific redo operation to all clients
            broadcastToSession({
              action: 'redoOperation',
              userIndex: userIdx,
              cmdIndex: cmdIndex
            });
          }
        }

        // Sync updated state with all clients
        broadcastToSession({
          action: 'sync',
          stack: commandStack[sessionId],
          pointerMap: userCommandPointerMap[sessionId]
        });
      }
      else {
        // For any other action, just broadcast it.
        broadcastToSession(data);
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    activeConnections[sessionId]--;
    console.log(`Connection closed for session ${sessionId}. Active connections: ${activeConnections[sessionId]}`);
    if (activeConnections[sessionId] <= 0) {
      deleteTimeouts[sessionId] = setTimeout(async () => {
        console.log(`No active connections remain for session ${sessionId}. Deleting session.`);
        await Session.findByIdAndDelete(sessionId);
        delete activeConnections[sessionId];
        delete deleteTimeouts[sessionId];
      }, 3000);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});


mongoose.connect(mongoURI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.log('Error connecting to MongoDB:', err);
  });

// Define routes

// GET all sessions
app.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find();

    // Decode each session's data from MessagePack format
    const decodedSessions = sessions.map(session => {
      const decodedData = msgpack.decode(session.data);
      return {
        _id: session._id,
        users: decodedData.users,
        image: decodedData.image,
        decodedData  // Optionally include the entire decoded data for debugging
      };
    });

    res.json(decodedSessions);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).send('Server Error');
  }
});

// GET session by id
app.get('/sessions/:id', async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).send('Session not found');
    }

    const decodedSession = msgpack.decode(session.data);
    const decodedData = {
      _id: session._id,
      users: decodedSession.users,
      image: decodedSession.image,
    };
    res.json(decodedData);
  } catch (err) {
    console.error('Error fetching session:', err);
    res.status(500).send('Server Error');
  }
});

// POST create a new session
app.post('/sessions', async (req, res) => {
  try {
    if (!req.body.userName) {
      return res.status(400).json({ error: 'User name is required' });
    }

    const image = [];
    for (let r = 0; r < 1000; r++) {
      const row = [];
      for (let c = 0; c < 1000; c++) {
        row.push(`#ffffff`);
      }
      image.push(row);
    }

    const sessionData = {
      users: [req.body.userName],
      image: image
    };

    const session = new Session({
      data: msgpack.encode(sessionData)
    });

    await session.save();

    userIndexMap[session._id] = {};
    userIndexMap[session._id][0] = [];
    commandStack[session._id] = []

    // Get session ID and create the dynamic route for the WebSocket
    if (process.env.NODE_ENV !== 'production') {
      const dynamicRoute = `/${session._id}`;
      const backendWsUrl = `ws://localhost:8080${dynamicRoute}`;
      console.log(`WebSocket dynamic route (dev): ${backendWsUrl}`);
      const socket = new WebSocket(backendWsUrl);
      socket.on('open', () => console.log('WebSocket connection opened'));
    } else {
      console.log('Skipping WebSocket connection in production');
    }

    socket.on('open', () => {
      console.log('WebSocket connection opened to dynamic route');
    });

    // socket.on('message', (msg) => {
    //   console.log('Received from WebSocket server:', msg);
    // });

    socket.on('close', () => {
      console.log('WebSocket connection closed');
    });

    res.json({ message: 'Session created', session, userIndex: 0 });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// PUT modify a session by id
// PUT modify a session by id
app.put('/sessions/:id', async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    const session = await Session.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const decodedData = msgpack.decode(session.data);

    if (!userIndexMap[session._id]) {
      userIndexMap[session._id] = {};
    }

    // Add new user if available
    let newUserIndex;
    if (req.body.userName) {
      decodedData.users.push(req.body.userName);

      // Update the userIndexMap with the new user at the next available position
      newUserIndex = decodedData.users.length - 1;  // The index of the new user
      userIndexMap[session._id][newUserIndex] = [];  // Initialize the new user's action history as an empty array
    }

    const encodedSession = msgpack.encode(decodedData);

    // Save the updated session
    session.data = encodedSession;
    await session.save();

    // Get session ID and create the dynamic route for the WebSocket
    if (process.env.NODE_ENV !== 'production') {
      const dynamicRoute = `/${session._id}`;
      const backendWsUrl = `ws://localhost:8080${dynamicRoute}`;
      console.log(`WebSocket dynamic route (dev): ${backendWsUrl}`);
      const socket = new WebSocket(backendWsUrl);
      socket.on('open', () => console.log('WebSocket connection opened'));
    } else {
      console.log('Skipping WebSocket connection in production');
    }

    res.json({ message: 'Session modified', userIndex: newUserIndex });  // Return the user index of the newly added user
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

const port = 8080;
// server.listen(port, () => {
//   console.log(`Server started on port ${port}`);
// });
module.exports = app;