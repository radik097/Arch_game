import { deriveObjectives } from '../simulator/objectives';
import type { GameState } from '../simulator/types';

interface ObjectivePanelProps {
  state: GameState;
}

export function ObjectivePanel({ state }: ObjectivePanelProps) {
  const objectives = deriveObjectives(state);
  const current = objectives.find((objective) => objective.id === state.currentObjective);
  const showDetails = state.difficulty !== 'god';
  const showTeaching = state.difficulty === 'beginner' && state.lastTeachingNote;

  return (
    <section className="side-panel objective-panel">
      <header className="panel-header compact">
        <div>
          <p className="eyebrow">Mission</p>
          <h2>{current?.title ?? 'Installation complete'}</h2>
        </div>
      </header>

      {showDetails ? <p className="objective-detail">{current?.detail}</p> : null}

      <ol className="objective-list">
        {objectives.map((objective) => (
          <li key={objective.id} className={objective.completed ? 'done' : objective.id === state.currentObjective ? 'active' : ''}>
            <span className="objective-bullet">{objective.completed ? 'OK' : objective.id === state.currentObjective ? 'NOW' : '...'}</span>
            <div>
              <strong>{objective.title}</strong>
              {showDetails ? <p>{objective.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {showTeaching ? (
        <article className="teaching-card">
          <p className="eyebrow">Beginner explanation</p>
          <h3>{state.lastTeachingNote?.title}</h3>
          <p>{state.lastTeachingNote?.ru}</p>
          <p>{state.lastTeachingNote?.en}</p>
        </article>
      ) : null}
    </section>
  );
}
