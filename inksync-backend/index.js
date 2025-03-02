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

const activeConnections = {}; // Maps session ID to active connections count
const deleteTimeouts = {};    // Maps session ID to deletion timeout IDs

wss.on('connection', (ws, req) => {
  const sessionId = req.url.slice(1); // Extract session ID from URL
  console.log(`Client connected to session ${sessionId}`);

  // If there's a pending deletion timer for this session, cancel it.
  if (deleteTimeouts[sessionId]) {
    clearTimeout(deleteTimeouts[sessionId]);
    delete deleteTimeouts[sessionId];
    console.log(`Cancelled deletion timeout for session ${sessionId}`);
  }

  // Increment the connection count for the session
  activeConnections[sessionId] = (activeConnections[sessionId] || 0) + 1;
  console.log(`Active connections for ${sessionId}: ${activeConnections[sessionId]}`);

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      console.log(`Ping sent to session ${sessionId}`);
    }
  }, 30000);

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log("Received change:", data);
    // Process the change and broadcast it to other users
  });


  ws.on('close', () => {
    clearInterval(pingInterval);
    activeConnections[sessionId]--;
    console.log(`Connection closed for session ${sessionId}. Active connections: ${activeConnections[sessionId]}`);

    // If no active connections remain, delay deletion
    if (activeConnections[sessionId] <= 0) {
      deleteTimeouts[sessionId] = setTimeout(async () => {
        console.log(`No active connections remain for session ${sessionId}. Deleting session.`);
        await Session.findByIdAndDelete(sessionId);
        delete activeConnections[sessionId];
        delete deleteTimeouts[sessionId];
      }, 3000); // Delay in milliseconds (adjust as needed)
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

    // Get session ID and create the dynamic route for the WebSocket
    const dynamicRoute = `/${session._id}`;
    console.log(`WebSocket dynamic route: ws://localhost:8080${dynamicRoute}`);

    // Optionally: You can establish a WebSocket connection here if needed
    const socket = new WebSocket(`ws://localhost:8080${dynamicRoute}`);

    socket.on('open', () => {
      console.log('WebSocket connection opened to dynamic route');
    });

    socket.on('message', (msg) => {
      console.log('Received from WebSocket server:', msg);
    });

    socket.on('close', () => {
      console.log('WebSocket connection closed');
    });

    res.json({ message: 'Session created', session });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

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

    // Add new user if available
    if (req.body.userName) {
      decodedData.users.push(req.body.userName);
    }

    // Update the color of the image at (r, c)
    if (req.body.r !== undefined && req.body.c !== undefined && req.body.color) {
      decodedData.image[req.body.r][req.body.c] = req.body.color;
    }

    const encodedSession = msgpack.encode(decodedData);

    // Save the updated session
    session.data = encodedSession;
    await session.save();

    // Get session ID and create the dynamic route for the WebSocket
    const dynamicRoute = `/${session._id}`;
    console.log(`WebSocket dynamic route: ws://localhost:8080${dynamicRoute}`);

    // Optionally: You can establish a WebSocket connection here if needed
    const socket = new WebSocket(`ws://localhost:8080${dynamicRoute}`);

    socket.on('open', () => {
      console.log('WebSocket connection opened to dynamic route');
    });

    socket.on('message', (msg) => {
      console.log('Received from WebSocket server:', msg);
    });

    socket.on('close', () => {
      console.log('WebSocket connection closed');
    });

    res.json({ message: 'Session modified', session: { _id: session._id, users: decodedData.users, image: decodedData.image } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

const port = 8080;
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});