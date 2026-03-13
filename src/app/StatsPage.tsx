import { useEffect, useState } from 'react';
import { fetchStats } from '../features/session/api';
import type { StatsResponse } from '../shared/replay';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load stats.');
      });
  }, []);

  return (
    <main className="app-shell theme-emerald">
      <section className="terminal-stage bash-stage">
        <div className="terminal-frame">
          <header className="terminal-topbar">
            <div className="topbar-brand">
              <span className="topbar-title">ARCH TRAINER</span>
              <span className="topbar-divider">|</span>
              <span className="topbar-difficulty">STATS</span>
            </div>
          </header>

          <div className="terminal-workspace" style={{ padding: '24px 32px' }}>
            {error ? (
              <p style={{ color: 'var(--text-error, #ff9f9f)', fontFamily: 'monospace' }}>{error}</p>
            ) : !stats ? (
              <p style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading…</p>
            ) : (
              <div style={{ fontFamily: 'monospace', lineHeight: '1.7', color: 'var(--text-main)' }}>
                <p style={{ color: 'var(--text-dim, #888)', marginBottom: '16px' }}>
                  Generated: {new Date(stats.generatedAt).toUTCString()}
                </p>

                <section style={{ marginBottom: '24px' }}>
                  <p style={{ color: 'var(--text-accent, #4ade80)', marginBottom: '8px' }}>── Visitors ──</p>
                  <div className="sidebar-stats">
                    <div className="sidebar-stat-row">
                      <span>Total visits</span>
                      <strong className="status-active">{stats.visitors.totalVisits}</strong>
                    </div>
                    <div className="sidebar-stat-row">
                      <span>Unique visitors</span>
                      <strong className="status-good">{stats.visitors.uniqueVisitors}</strong>
                    </div>
                    <div className="sidebar-stat-row">
                      <span>Last visit</span>
                      <strong className="status-idle">
                        {stats.visitors.lastVisitAt ? new Date(stats.visitors.lastVisitAt).toUTCString() : 'never'}
                      </strong>
                    </div>
                  </div>
                </section>

                <section style={{ marginBottom: '24px' }}>
                  <p style={{ color: 'var(--text-accent, #4ade80)', marginBottom: '8px' }}>── Sessions ──</p>
                  <div className="sidebar-stats">
                    <div className="sidebar-stat-row">
                      <span>Total</span>
                      <strong className="status-active">{stats.sessions.total}</strong>
                    </div>
                    <div className="sidebar-stat-row">
                      <span>Open</span>
                      <strong className="status-idle">{stats.sessions.open}</strong>
                    </div>
                    <div className="sidebar-stat-row">
                      <span>Used</span>
                      <strong className="status-active">{stats.sessions.used}</strong>
                    </div>
                  </div>
                </section>

                <section style={{ marginBottom: '24px' }}>
                  <p style={{ color: 'var(--text-accent, #4ade80)', marginBottom: '8px' }}>── Players & Replays ──</p>
                  <div className="sidebar-stats">
                    <div className="sidebar-stat-row">
                      <span>Players</span>
                      <strong className="status-active">{stats.players.total}</strong>
                    </div>
                    <div className="sidebar-stat-row">
                      <span>Replays</span>
                      <strong className="status-active">{stats.replays.total}</strong>
                    </div>
                    <div className="sidebar-stat-row">
                      <span>Leaderboard entries</span>
                      <strong className="status-good">{stats.leaderboard.total}</strong>
                    </div>
                  </div>
                </section>

                {stats.leaderboard.top.length > 0 ? (
                  <section style={{ marginBottom: '24px' }}>
                    <p style={{ color: 'var(--text-accent, #4ade80)', marginBottom: '8px' }}>── Top Runs ──</p>
                    <div className="sidebar-stats">
                      {stats.leaderboard.top.map((entry, index) => (
                        <div className="sidebar-stat-row" key={`${entry.forkName}-${index}`}>
                          <span>{entry.forkName} [{entry.difficulty}]</span>
                          <strong className="status-good">{formatDuration(entry.timeMs)}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
