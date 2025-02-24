import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";
import './css/HomePage.css';

function HomePage() {
  const [newUserName, setNewUserName] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [activeSession, setActiveSession] = useState('');
  const navigate = useNavigate();

  const handleSessionCreation = (userName) => {
    if (!userName) {
      alert('User name is required');
      return;
    }

    axios.post('http://localhost:8080/sessions', { userName: userName })
      .then((response) => {
        console.log('Session created:', response.data);
      
        const newSessionID = response.data.session._id;

        navigate(`/session/${newSessionID}`);
      })
      .catch((error) => {
        console.error('There was an error creating the session!', error);
      });
  };

  const handleSessionJoin = (userName, sessionID) => {
    if (!userName || !sessionID) {
      alert('Both user name and session ID are required');
      return;
    }

    axios.put(`http://localhost:8080/sessions/${sessionID}`, { userName: userName })
      .then((response) => {
        console.log('Session joined:', response.data);

        navigate(`/session/${sessionID}`);
      })
      .catch((error) => {
        console.error('There was an error joining the session!', error);
      });
  };

  const handleSessionChange = (e, field) => {
    if (field === 'newUserName') {
      setNewUserName(e.target.value);
    } else if (field === 'joinUserName') {
      setJoinUserName(e.target.value);
    } else if (field === 'activeSession') {
      setActiveSession(e.target.value);
    }
  };

  return (
    <div className="home-page">
      <h1>Welcome to the Home Page</h1>

      <div className="input-container">
        <input
          type="text"
          value={newUserName}
          onChange={(e) => handleSessionChange(e, 'newUserName')}
          placeholder="Enter a name"
          className="text-input"
        />
        <button onClick={() => handleSessionCreation(newUserName)} className="submit-button">
          Create Session
        </button>
      </div>

      <div className="input-container">
        <input
          type="text"
          value={joinUserName}
          onChange={(e) => handleSessionChange(e, 'joinUserName')}
          placeholder="Enter your name"
          className="text-input"
        />
        <input
          type="text"
          value={activeSession}
          onChange={(e) => handleSessionChange(e, 'activeSession')}
          placeholder="Enter a session ID"
          className="text-input"
        />
        <button onClick={() => handleSessionJoin(joinUserName, activeSession)} className="submit-button">
          Join Session
        </button>
      </div>
    </div>
  );
}

export default HomePage;
