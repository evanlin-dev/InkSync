import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { decode } from '@msgpack/msgpack';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import LandingPage from './pages/LandingPage';

function App() {
  // const [message, setMessage] = useState('');
  // const [receivedMessages, setReceivedMessages] = useState([]);
  // const [ws, setWs] = useState(null);

  // const [userName, setUserName] = useState('');
  // const [sessionID, setSessionID] = useState('')
  // const [sessions, setSessions] = useState([]);
  // const [activeSession, setActiveSession] = useState('');

  // useEffect(() => {
  //   axios.get('http://localhost:8080/sessions')
  //     .then(response => {
  //       setSessions(response.data);
  //     })
  //     .catch(error => {
  //       console.error('Error fetching sessions:', error);
  //     });
  // }, []); // Empty dependency array, only fetch when the component is first mounted

  // useEffect(() => {
  //   const websocket = new WebSocket('ws://localhost:8080');

  //   websocket.onopen = () => {
  //     console.log('Connected to WebSocket server');
  //     setWs(websocket);
  //   };

  //   websocket.onmessage = event => {
  //     setReceivedMessages(prevMessages => [...prevMessages, event.data]);
  //   };

  //   websocket.onclose = () => {
  //     console.log('Disconnected from WebSocket server');
  //   };

  //   websocket.onerror = error => {
  //     console.error('WebSocket error:', error);
  //   }

  //   return () => {
  //     websocket.close();
  //   };
  // }, []);

  // const sendMessage = () => {
  //   if (ws) {
  //     ws.send(message);
  //     setMessage('');
  //   }
  // };

  // const createSession = () => {
  //   if (!userName) {
  //     alert('User name is required');
  //     return;
  //   }

  //   axios.post('http://localhost:8080/sessions', { userName: userName })
  //     .then((response) => {
  //       console.log('Session created:', response.data);
  //       axios.get('http://localhost:8080/sessions')
  //         .then(response => {
  //           setSessions(response.data);
  //         })
  //         .catch(error => {
  //           console.error('Error fetching sessions:', error);
  //         });
  //     })
  //     .catch((error) => {
  //       console.error('There was an error creating the session!', error);
  //     });
  // };

  // const joinSession = () => {
  //   if (!sessionID) {
  //     alert('Session ID is required');
  //     return;
  //   }


  //   axios.get(`http://localhost:8080/sessions/${sessionID}`)
  //     .then(response => {
  //       setActiveSession(response.data);
  //     })
  //     .catch(error => {
  //       console.error('Error fetching sessions:', error);
  //     });
  // };

  return (
    <div>
      {/* <h1>WebSocket Example</h1>
      <input
        type="text"
        value={message}
        onChange={e => setMessage(e.target.value)}
      />
      <button onClick={sendMessage}>Send</button>
      <div>
        <h2>Received Messages:</h2>
        <ul>
          {receivedMessages.map((msg, index) => (
            <li key={index}>{msg}</li>
          ))}
        </ul>
      </div>

      <h2>POST Session</h2>
      <input
        type="text"
        value={userName}
        onChange={e => setUserName(e.target.value)}
        placeholder="Enter user name"
      />
      <button onClick={createSession}>Create Session</button>

      <h2>GET Session</h2>
      <input
        type="text"
        value={sessionID}
        onChange={e => setSessionID(e.target.value)}
        placeholder="Enter session ID"
      />
      <button onClick={joinSession}>Join Session</button>

      <h4>Active Sessions (Users): {activeSession.users}</h4>

      <h2>All Sessions</h2>
      <ul>
        {sessions.map(session => (
          <li key={session._id}>
            <strong>Session ID:</strong> {session._id} <br />
            <strong>Users:</strong> {session.users.join(', ')}
          </li>
        ))}
      </ul> */}
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/session/:id" element={<SessionPage />} />
      </Routes>
    </Router>
    </div>
  );
}

export default App;
