import React from 'react';
import { Link } from 'react-router-dom';
import './css/LandingPage.css';

function LandingPage() {
  return (
    <div className="hero-container">
      <div className="hero-content">
        <h1 className="hero-title">Draw. Collaborate. Create.</h1>
        <p className="hero-subtitle">
          A real-time collaborative drawing platform for teams, friends,
          and fellow creators.
        </p>
        <Link to="/home" className="hero-button">
          Get Started
        </Link>
      </div>
    </div>
  );
}

export default LandingPage;
