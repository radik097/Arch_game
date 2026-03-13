import type { GameState } from '../simulator/types';

interface StatusPanelProps {
  state: GameState;
  elapsedSeconds: number;
  onRestart: () => void;
  onBackToMenu: () => void;
  terminalThemeLabel: string;
}

export function StatusPanel({ state, elapsedSeconds, onRestart, onBackToMenu, terminalThemeLabel }: StatusPanelProps) {
  const connectedInterface = state.networkInterfaces.find((networkInterface) => networkInterface.connected);

  return (
    <section className="side-panel status-panel">
      <header className="panel-header compact">
        <div>
          <p className="eyebrow">Run status</p>
          <h2>{state.completed ? 'Boot successful' : 'Live install in progress'}</h2>
        </div>
      </header>

      <div className="status-grid">
        <div>
          <span>Timer</span>
          <strong>{formatElapsed(elapsedSeconds)}</strong>
        </div>
        <div>
          <span>Attempt</span>
          <strong>{state.attempt}</strong>
        </div>
        <div>
          <span>Network</span>
          <strong>{connectedInterface ? `online via ${connectedInterface.name}` : 'offline'}</strong>
        </div>
        <div>
          <span>Filesystem</span>
          <strong>{state.install.rootMounted ? 'mounted' : state.install.unmounted ? 'unmounted' : 'not mounted'}</strong>
        </div>
        <div>
          <span>Packages</span>
          <strong>{state.install.packagesInstalled ? 'installed' : 'pending'}</strong>
        </div>
        <div>
          <span>Bootloader</span>
          <strong>{state.install.grubConfigGenerated ? 'configured' : 'pending'}</strong>
        </div>
        <div>
          <span>Difficulty</span>
          <strong>{state.difficulty}</strong>
        </div>
        <div>
          <span>Terminal pack</span>
          <strong>{terminalThemeLabel}</strong>
        </div>
      </div>

      <div className="control-block">
        <p className="eyebrow">Run controls</p>
        <div className="difficulty-list">
          <button className="difficulty-chip active" onClick={onRestart} type="button">
            Restart run
          </button>
          <button className="difficulty-chip" onClick={onBackToMenu} type="button">
            Main menu
          </button>
        </div>
      </div>

      <div className="event-card">
        <p className="eyebrow">Latest event</p>
        <p>{state.lastEvent ?? 'No active faults.'}</p>
      </div>
    </section>
  );
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
