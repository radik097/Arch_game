import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Pages.css';

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container help-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← BACK_TO_MAP</button>
        <h1>CONTRIBUTE_TO_PROJECT</h1>
      </header>
      
      <main className="page-content">
        <section className="info-card">
          <h2>HOW_TO_HELP</h2>
          <p>
            Arch Trainer is an open-source project. We welcome contributions 
            ranging from bug fixes and documentation improvements to new 
            features and mods.
          </p>
        </section>

        <section className="info-card">
          <h2>STEP_BY_STEP</h2>
          <ol className="help-steps">
            <li>Fork the repository on GitHub.</li>
            <li>Clone your fork locally.</li>
            <li>Create a new branch for your feature.</li>
            <li>Commit your changes with clear messages.</li>
            <li>Submit a Pull Request.</li>
          </ol>
        </section>

        <section className="info-card git-link">
          <h2>GITHUB_REPOSITORY</h2>
          <a 
            href="https://github.com/radik097/Arch_game" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-button"
          >
            OPEN_GITHUB_REPO
          </a>
        </section>
      </main>
    </div>
  );
};
