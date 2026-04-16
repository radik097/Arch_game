import { useNavigate } from 'react-router-dom';
import type { Difficulty } from '../simulator/types';
import { APP_TEXT, type AppLanguage, type AppThemeId, getDifficultyCopy, getThemeLabel } from '../../shared/i18n';
import './MainGraph.css';

interface MainGraphProps {
  busy: boolean;
  compactBoot: boolean;
  hasSession: boolean;
  language: AppLanguage;
  preferredDifficulty: Difficulty;
  theme: AppThemeId;
  onCompactBootChange: (compactBoot: boolean) => void;
  onSelectLanguage: (language: AppLanguage) => void;
  onOpenSimulation: () => void;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onSelectTheme: (theme: AppThemeId) => void;
  onStartSandbox: () => void;
  onStartTraining: () => void;
}

const difficultyOptions: Difficulty[] = ['beginner', 'experienced', 'expert', 'god'];

const themeOptions: AppThemeId[] = ['emerald', 'amber', 'ice'];
const languageOptions: AppLanguage[] = ['ru', 'en'];

export function MainGraph({
  busy,
  compactBoot,
  hasSession,
  language,
  preferredDifficulty,
  theme,
  onCompactBootChange,
  onSelectLanguage,
  onOpenSimulation,
  onSelectDifficulty,
  onSelectTheme,
  onStartSandbox,
  onStartTraining,
}: MainGraphProps) {
  const navigate = useNavigate();
  const text = APP_TEXT[language];
  const selectedDifficulty = getDifficultyCopy(language, preferredDifficulty);
  const logoSrc = `${import.meta.env.BASE_URL}favicon.png`;

  return (
    <main className={`main-menu theme-${theme}`}>
      <div className="main-menu__content">
        <section className="main-menu__hero">
          <div className="main-menu__brand">
            <img alt="" className="main-menu__logo" src={logoSrc} />
            <div>
              <p className="main-menu__eyebrow">ARCH TRAINER</p>
              <h1>{text.menu.title}</h1>
            </div>
          </div>
          <p className="main-menu__lead">{text.menu.lead}</p>
          <div className="main-menu__status">
            <span className="main-menu__status-item">{text.menu.difficultyStatus}: {selectedDifficulty.label}</span>
            <span className="main-menu__status-item">{text.menu.themeStatus}: {getThemeLabel(language, theme)}</span>
            <span className="main-menu__status-item">{compactBoot ? text.menu.compactBootStatus : text.menu.fullBootStatus}</span>
          </div>
        </section>

        <section className="main-menu__panel main-menu__panel--actions">
          <h2>{text.menu.start}</h2>
          <div className="main-menu__actions">
            <button className="main-menu__button main-menu__button--primary" disabled={busy} onClick={onStartTraining} type="button">
              {text.menu.startTraining}
            </button>
            <button className="main-menu__button main-menu__button--secondary" disabled={busy} onClick={onStartSandbox} type="button">
              {text.menu.sandbox}
            </button>
            <button className="main-menu__button" onClick={onOpenSimulation} type="button">
              {hasSession ? text.menu.continueTerminal : text.menu.openTerminal}
            </button>
            <button className="main-menu__button" onClick={() => navigate('/vm')} type="button">
              {text.menu.virtualMachine}
            </button>
          </div>
        </section>

        <section className="main-menu__panel">
          <div className="main-menu__section-head">
            <h2>{text.menu.difficulty}</h2>
            <p>{selectedDifficulty.note}</p>
          </div>
          <div className="main-menu__option-grid">
            {difficultyOptions.map((option) => (
              <button
                key={option}
                className={`main-menu__chip${preferredDifficulty === option ? ' is-active' : ''}`}
                onClick={() => onSelectDifficulty(option)}
                type="button"
              >
                <span>{getDifficultyCopy(language, option).label}</span>
                <small>{getDifficultyCopy(language, option).note}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="main-menu__panel">
          <div className="main-menu__section-head">
            <h2>{text.menu.settings}</h2>
            <p>{text.menu.settingsLead}</p>
          </div>
          <label className="main-menu__toggle">
            <input checked={compactBoot} onChange={(event) => onCompactBootChange(event.target.checked)} type="checkbox" />
            <span>{text.menu.compactBoot}</span>
          </label>
          <div className="main-menu__theme-row">
            {themeOptions.map((option) => (
              <button
                key={option}
                className={`main-menu__theme-button${theme === option ? ' is-active' : ''}`}
                onClick={() => onSelectTheme(option)}
                type="button"
              >
                {getThemeLabel(language, option)}
              </button>
            ))}
          </div>
        </section>

        <section className="main-menu__panel">
          <div className="main-menu__section-head">
            <h2>{text.menu.language}</h2>
            <p>{text.menu.languageLead}</p>
          </div>
          <div className="main-menu__theme-row">
            {languageOptions.map((option) => (
              <button
                key={option}
                className={`main-menu__theme-button${language === option ? ' is-active' : ''}`}
                onClick={() => onSelectLanguage(option)}
                type="button"
              >
                {text.languages[option]}
              </button>
            ))}
          </div>
        </section>

        <section className="main-menu__panel">
          <div className="main-menu__section-head">
            <h2>{text.menu.sections}</h2>
            <p>{text.menu.sectionsLead}</p>
          </div>
          <div className="main-menu__links">
            <button className="main-menu__link" onClick={() => navigate('/about')} type="button">
              {text.menu.about}
            </button>
            <button className="main-menu__link" onClick={() => navigate('/help')} type="button">
              {text.menu.help}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
