import React from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_TEXT, type AppLanguage, type AppThemeId } from '../../shared/i18n';
import './Pages.css';

interface HelpPageProps {
  locale: AppLanguage;
  theme: AppThemeId;
}

export const HelpPage: React.FC<HelpPageProps> = ({ locale, theme }) => {
  const navigate = useNavigate();
  const text = APP_TEXT[locale].pages;

  return (
    <div className={`page-container help-page theme-${theme}`}>
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>{text.backToMenu}</button>
        <h1>{text.helpTitle}</h1>
      </header>
      
      <main className="page-content">
        <section className="info-card">
          <h2>{text.helpSections.introTitle}</h2>
          <p>{text.helpSections.introBody}</p>
        </section>

        <section className="info-card">
          <h2>{text.helpSections.stepsTitle}</h2>
          <ol className="help-steps">
            {text.helpSections.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="info-card git-link">
          <h2>{text.helpSections.repoTitle}</h2>
          <a 
            href="https://github.com/radik097/Arch_game" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-button"
          >
            {text.helpSections.repoButton}
          </a>
        </section>
      </main>
    </div>
  );
};
