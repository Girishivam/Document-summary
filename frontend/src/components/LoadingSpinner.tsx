import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="spinner-wrapper">
          <div className="spinner"></div>
          <div className="spinner-inner"></div>
          <div className="gemini-sparkle">✨</div>
        </div>

        <h2>Processing Your Document</h2>
        <p>Please wait while we extract text and generate your summary...</p>

        <div className="loading-steps">
          <div className="step step-1">
            <span className="step-icon">📤</span>
            <span className="step-text">Uploading file</span>
            <div className="step-progress"></div>
          </div>

          <div className="step step-2">
            <span className="step-icon">🔍</span>
            <span className="step-text">Extracting text</span>
            <div className="step-progress"></div>
          </div>

          <div className="step step-3">
            <span className="step-icon">🧠</span>
            <span className="step-text">Cosmic Intelligence analysis</span>
            <div className="step-progress"></div>
          </div>
        </div>

        <div className="progress-bar">
          <div className="progress-fill"></div>
        </div>

        <div className="gemini-badge">
          <span className="badge-text">Powered by Cosmic Intelligence</span>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;