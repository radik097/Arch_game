import React from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_TEXT, type AppLanguage, type AppThemeId } from '../../shared/i18n';
import './Pages.css';

interface AboutPageProps {
  locale: AppLanguage;
  theme: AppThemeId;
}

export const AboutPage: React.FC<AboutPageProps> = ({ locale, theme }) => {
  const navigate = useNavigate();
  const text = APP_TEXT[locale].pages;

  return (
    <div className={`page-container about-page theme-${theme}`}>
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>{text.backToMenu}</button>
        <h1>{text.aboutTitle}</h1>
      </header>
      
      <main className="page-content">
        <section className="info-card">
          <h2>{text.aboutSections.simulatorTitle}</h2>
          <p>{text.aboutSections.simulatorBody}</p>
        </section>

        <section className="info-card">
          <h2>{text.aboutSections.vmTitle}</h2>
          <p>{text.aboutSections.vmBody}</p>
        </section>

        <section className="info-card tech-specs">
          <h2>{text.aboutSections.stackTitle}</h2>
          <ul>
            <li>React + Vite</li>
            <li>XTerm.js for Terminal Emulation</li>
            <li>Custom Game Engine for System Logic</li>
            <li>V86 for x86 Virtualization</li>
          </ul>
        </section>
      </main>
    </div>
  );
};
