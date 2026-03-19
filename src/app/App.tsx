import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { deriveObjectives } from '../features/simulator/objectives';
import { completeInput, createInitialState, executeCommand, getPromptLabel } from '../features/simulator/engine';
import type { Difficulty, GameState, ObjectiveId, TerminalLine } from '../features/simulator/types';
import { fetchLeaderboard, fetchVisitorStats, registerVisit, startOfficialSession, submitOfficialReplay } from '../features/session/api';
import { createVerificationBundle, getLocalForkConfig, getVerificationSummary } from '../features/session/buildIdentity';
import { XtermTerminal } from '../features/terminal/XtermTerminal';
import { VmPanel } from '../features/vm/VmPanel';
import { MainGraph } from '../features/landing/MainGraph';
import { AboutPage } from '../features/pages/AboutPage';
import { HelpPage } from '../features/pages/HelpPage';
import './App.css';
import type { LeaderboardEntry, ReplayCommand, ReplaySubmission, SessionStartResponse, VisitorStatsResponse } from '../shared/replay';

type TerminalMode = 'shell' | 'game';
type TerminalThemeId = 'emerald' | 'amber' | 'ice';

interface UiSettings {
  preferredDifficulty: Difficulty;
  compactBoot: boolean;
  theme: TerminalThemeId;
}

interface RunSummary {
  mode: 'idle' | 'local' | 'official';
  submissionState: 'idle' | 'submitting' | 'accepted' | 'rejected';
  submissionMessage: string | null;
  officialTimeMs: number | null;
}

interface LocalRun {
  mode: 'local';
  commands: ReplayCommand[];
  submitted: boolean;
}

interface OfficialRun {
  mode: 'official';
  session: SessionStartResponse;
  commands: ReplayCommand[];
  lastHash: string;
  submitted: boolean;
}

type ActiveRun = LocalRun | OfficialRun;

interface CheckpointSnapshot {
  id: ObjectiveId;
  title: string;
  snapshot: GameState;
}

interface SavedSession {
  savedAt: number;
  mode: TerminalMode;
  state: GameState;
  terminalLines: TerminalLine[];
  runSummary: RunSummary;
  activeRun: ActiveRun | null;
  checkpoints: CheckpointSnapshot[];
}

const CLIENT_VERSION = '0.1.0';
const CONTROL_USER = 'root';
const CONTROL_HOST = 'archiso';
const SETTINGS_KEY = 'arch-trainer-terminal-settings-v1';
const SESSION_KEY = 'arch-trainer-session-v1';
const TUTOR_KEY = 'arch-trainer-tutorial-complete-v1';
let lineCounter = 0;

export function App() {
  const [uiSettings, setUiSettings] = useState<UiSettings>(() => loadUiSettings());
  const [mode, setMode] = useState<TerminalMode>('shell');
  const [state, setState] = useState<GameState>(() => createInitialState('beginner'));
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>(() => createBootLines(loadUiSettings().compactBoot));
  const [now, setNow] = useState(() => Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStatsResponse | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [checkpoints, setCheckpoints] = useState<CheckpointSnapshot[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [runSummary, setRunSummary] = useState<RunSummary>({
    mode: 'idle',
    submissionState: 'idle',
    submissionMessage: null,
    officialTimeMs: null,
  });
  const activeRunRef = useRef<ActiveRun | null>(null);
  const appendedHistoryRef = useRef(0);

  const verificationBundle = createVerificationBundle();
  const verificationSummary = getVerificationSummary();
  const forkConfig = getLocalForkConfig();
  const browserProfile = useMemo(() => detectBrowserProfile(), []);
  const objectives = deriveObjectives(state);
  const currentObjective = objectives.find((objective) => objective.id === state.currentObjective) ?? objectives[0];
  const completedObjectives = objectives.filter((objective) => objective.completed).length;
  const progress = objectives.length === 0 ? 0 : (completedObjectives / objectives.length) * 100;
  const activeRun = activeRunRef.current;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(uiSettings));
  }, [uiSettings]);

  useEffect(() => {
    const restored = loadSavedSession();
    if (!restored) {
      setSessionLoaded(true);
      return;
    }

    setMode(restored.mode);
    setState(restored.state);
    setTerminalLines(restored.terminalLines);
    setRunSummary(restored.runSummary);
    setCheckpoints(restored.checkpoints);
    setWelcomeOpen(false);
    activeRunRef.current = restored.activeRun;
    appendedHistoryRef.current = restored.state.history.length;
    setSessionLoaded(true);
  }, []);

  useEffect(() => {
    if (!sessionLoaded) {
      return;
    }

    saveSession({
      savedAt: Date.now(),
      mode,
      state,
      terminalLines,
      runSummary,
      activeRun: activeRunRef.current,
      checkpoints,
    });
  }, [sessionLoaded, mode, state, terminalLines, runSummary, checkpoints]);

  useEffect(() => {
    const sessionId = getVisitorSessionId();
    const payload = {
      sessionId,
      page: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen.width}x${window.screen.height}`,
    };

    void registerVisit(payload)
      .then((stats) => {
        setVisitorStats(stats);
      })
      .catch(async () => {
        try {
          const stats = await fetchVisitorStats();
          setVisitorStats(stats);
        } catch {
          setVisitorStats(null);
        }
      });
  }, []);

  useEffect(() => {
    const nextLines = state.history.slice(appendedHistoryRef.current);
    if (nextLines.length === 0) {
      return;
    }

    setTerminalLines((current) => [...current, ...nextLines]);
    appendedHistoryRef.current = state.history.length;
  }, [state.history]);

  useEffect(() => {
    if (mode !== 'game') {
      return;
    }

    const completed = deriveObjectives(state).filter((objective) => objective.completed);
    if (completed.length === 0) {
      return;
    }

    setCheckpoints((current) => {
      const next = [...current];
      for (const objective of completed) {
        if (next.some((checkpoint) => checkpoint.id === objective.id)) {
          continue;
        }
        next.push({
          id: objective.id,
          title: objective.title,
          snapshot: cloneGameState(state),
        });
      }
      return next;
    });
  }, [mode, state]);

  useEffect(() => {
    const activeRun = activeRunRef.current;
    if (mode !== 'game' || !state.completed || !activeRun || activeRun.submitted) {
      return;
    }

    activeRun.submitted = true;
    const objectives = deriveObjectives(state);
    const currentObjective = objectives.find((objective) => objective.id === state.currentObjective) ?? objectives[0];

    if (activeRun.mode === 'local') {
      appendLines([
        createLine('success', 'installer session completed in local sandbox mode'),
        createLine('info', `last_objective=${currentObjective?.title ?? 'completed'}`),
        createLine('info', 'no official replay submission was attempted'),
      ], setTerminalLines);
      setRunSummary({
        mode: 'local',
        submissionState: 'accepted',
        submissionMessage: 'Local sandbox run completed.',
        officialTimeMs: null,
      });
      appendLines([createLine('info', `selected_mode=${state.difficulty}`)], setTerminalLines);
      setMode('shell');
      return;
    }

    setIsBusy(true);
    setRunSummary((current) => ({
      ...current,
      submissionState: 'submitting',
      submissionMessage: 'Submitting replay to official validator...',
    }));
    appendLines([createLine('info', 'official-validator: replay complete, submitting hash chain...')], setTerminalLines);

    const replay: ReplaySubmission = {
      version: CLIENT_VERSION,
      difficulty: state.difficulty,
      sessionId: activeRun.session.sessionId,
      seed: activeRun.session.seed,
      playerId: activeRun.session.playerId,
      githubRepo: activeRun.session.githubRepo,
      buildHash: activeRun.session.buildHash,
      buildId: activeRun.session.buildId,
      commands: activeRun.commands,
    };

    void submitOfficialReplay(replay)
      .then((result) => {
        setRunSummary({
          mode: 'official',
          submissionState: result.accepted ? 'accepted' : 'rejected',
          submissionMessage: result.accepted ? `install_hash=${result.installHash}` : result.issue?.message ?? 'Replay rejected.',
          officialTimeMs: result.officialTimeMs,
        });
        appendLines(
          [
            createLine(result.accepted ? 'success' : 'error', `official-validator: ${result.accepted ? 'accepted' : 'rejected'}`),
            createLine('info', `official_time=${formatDurationMs(result.officialTimeMs)}`),
            createLine('info', result.accepted ? `install_hash=${result.installHash}` : result.issue?.message ?? 'Replay rejected.'),
          ],
          setTerminalLines,
        );
        setIsBusy(false);
        setMode('shell');
      })
      .catch((error) => {
        setRunSummary({
          mode: 'official',
          submissionState: 'rejected',
          submissionMessage: error instanceof Error ? error.message : 'Replay submission failed.',
          officialTimeMs: null,
        });
        appendLines([createLine('error', error instanceof Error ? error.message : 'Replay submission failed.')], setTerminalLines);
        setIsBusy(false);
        setMode('shell');
      });
  }, [mode, state.completed, state, setTerminalLines]);

  async function startRun(difficulty: Difficulty, forceLocal = false) {
    setIsBusy(true);
    setMenuOpen(false);
    let officialSession: SessionStartResponse | null = null;

    if (!forceLocal && verificationBundle) {
      try {
        officialSession = await startOfficialSession({
          difficulty,
          version: CLIENT_VERSION,
          verification: verificationBundle,
        });
      } catch {
        officialSession = null;
      }
    }

    appendLines(
      [
        createLine('system', `sessionctl: allocating ${difficulty} installer`),
        createLine('info', officialSession ? `session=${officialSession.sessionId} verification=official` : 'verification=local-sandbox'),
      ],
      setTerminalLines,
    );

    const nextState = createInitialState(difficulty, {
      seed: officialSession?.seed ?? 'local-offline-seed',
      startedAtMs: officialSession?.startTimeMs ?? Date.now(),
      profile: officialSession?.profile ?? 'local-sandbox-profile',
    });

    nextState.runtime.browserProfile = browserProfile;
    nextState.history = [
      ...nextState.history,
      createTerminalInfo(
        officialSession
          ? `official session=${officialSession.sessionId} fork=${officialSession.forkName}`
          : 'local sandbox mode: verification unavailable or rejected',
      ),
      createTerminalInfo(`browser profile: ${browserProfile}`),
    ];

    activeRunRef.current = officialSession
      ? {
          mode: 'official',
          session: officialSession,
          commands: [],
          lastHash: await sha256Hex(`${officialSession.sessionId}:${officialSession.seed}:${officialSession.buildHash}`),
          submitted: false,
        }
      : {
          mode: 'local',
          commands: [],
          submitted: false,
        };

    appendedHistoryRef.current = 0;
    setState(nextState);
    setCheckpoints([]);
    setRunSummary({
      mode: officialSession ? 'official' : 'local',
      submissionState: 'idle',
      submissionMessage: officialSession ? 'Official replay armed.' : 'Local mode only. No leaderboard submission.',
      officialTimeMs: null,
    });
    setMode('game');
    setIsBusy(false);
  }

  async function handleShellCommand(command: string) {
    const normalized = command.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    if (normalized === 'help' || normalized === 'sessionctl help') {
      appendLines(createHelpLines(), setTerminalLines);
      return;
    }

    if (normalized === 'start') {
      await startRun(uiSettings.preferredDifficulty);
      return;
    }

    if (normalized === 'sandbox') {
      await startRun(uiSettings.preferredDifficulty, true);
      return;
    }

    if (normalized.startsWith('start ')) {
      const difficulty = parseDifficultyToken(normalized.split(/\s+/)[1]);
      if (!difficulty) {
        appendLines([createLine('error', 'usage: start <beginner|experienced|expert|god>')], setTerminalLines);
        return;
      }

      await startRun(difficulty);
      return;
    }

    if (normalized.startsWith('sandbox ')) {
      const difficulty = parseDifficultyToken(normalized.split(/\s+/)[1]);
      if (!difficulty) {
        appendLines([createLine('error', 'usage: sandbox <beginner|experienced|expert|god>')], setTerminalLines);
        return;
      }

      await startRun(difficulty, true);
      return;
    }

    if (normalized === 'clear') {
      setTerminalLines([]);
      return;
    }

    if (normalized === 'logout' || normalized === 'exit') {
      appendLines([createLine('system', 'logout')], setTerminalLines);
      return;
    }

    if (normalized === 'whoami') {
      appendLines([createLine('output', CONTROL_USER)], setTerminalLines);
      return;
    }

    if (normalized === 'pwd') {
      appendLines([createLine('output', '/root')], setTerminalLines);
      return;
    }

    if (normalized === 'ls') {
      appendLines([createLine('output', 'README.txt  sessionctl  runbook.md')], setTerminalLines);
      return;
    }

    if (normalized === 'cat /etc/motd') {
      appendLines(createMotdLines(verificationSummary, forkConfig.github_repo || 'repo=unset'), setTerminalLines);
      return;
    }

    if (normalized === 'uname -a') {
      appendLines(
        [
          createLine(
            'output',
            'Linux arch-trainer 6.8.9-arch1-1 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux',
          ),
        ],
        setTerminalLines,
      );
      return;
    }

    if (normalized === 'hostnamectl') {
      appendLines(
        [
          createLine('output', ` Static hostname: ${CONTROL_HOST}`),
          createLine('output', '       Machine ID: archiso-training-sandbox'),
          createLine('output', '          Kernel: Linux 6.8.9-arch1-1'),
          createLine('output', '    Architecture: x86-64'),
        ],
        setTerminalLines,
      );
      return;
    }

    if (normalized === 'sessionctl about') {
      appendLines(
        [
          createLine('system', 'sessionctl about'),
          createLine('output', 'seed -> hardware generator -> event engine -> replay validator'),
          createLine('output', 'multiple disks, pseudo /proc, pseudo /sys/class/net, deterministic failure events'),
          createLine('output', 'official leaderboard accepts only verified fork builds with server replay validation'),
        ],
        setTerminalLines,
      );
      return;
    }

    if (normalized === 'sessionctl status') {
      appendLines(
        [
          createLine('system', 'sessionctl status'),
          createLine('output', `verification=${verificationSummary}`),
          createLine('output', `repo=${forkConfig.github_repo || 'unset'}`),
          createLine('output', `last_run_mode=${runSummary.mode}`),
          createLine('output', `last_submission=${runSummary.submissionState}`),
          createLine('output', `last_message=${runSummary.submissionMessage ?? 'none'}`),
          createLine('output', `visits=${visitorStats?.totalVisits ?? 'unknown'}`),
          createLine('output', `visitors=${visitorStats?.uniqueVisitors ?? 'unknown'}`),
        ],
        setTerminalLines,
      );
      return;
    }

    if (normalized.startsWith('sessionctl leaderboard')) {
      const parts = normalized.split(/\s+/);
      const difficulty = parseDifficultyToken(parts[2]);
      await loadLeaderboard(difficulty);
      return;
    }

    if (normalized.startsWith('sessionctl start')) {
      const parts = normalized.split(/\s+/);
      const difficulty = parseDifficultyToken(parts[2]);
      if (!difficulty) {
        appendLines([createLine('error', 'usage: sessionctl start <beginner|experienced|expert|god>')], setTerminalLines);
        return;
      }

      await startRun(difficulty);
      return;
    }

    if (!activeRunRef.current) {
      activeRunRef.current = {
        mode: 'local',
        commands: [],
        submitted: false,
      };
      setRunSummary({
        mode: 'local',
        submissionState: 'idle',
        submissionMessage: 'Local sandbox run active.',
        officialTimeMs: null,
      });
    }

    setTerminalLines((current) => current.slice(0, -1));
    setMode('game');
    await handleGameCommand(command);
  }

  async function handleGameCommand(command: string) {
    const normalized = command.trim().toLowerCase();

    if (normalized === 'exit' || normalized === 'logout') {
      if (activeRunRef.current) {
        activeRunRef.current.submitted = true;
      }
      appendLines([createLine('system', 'installer session aborted, returning to control shell')], setTerminalLines);
      setMode('shell');
      return;
    }

    if (normalized === 'clear') {
      setTerminalLines([]);
      return;
    }

    const activeRun = activeRunRef.current;
    if (activeRun?.mode === 'official') {
      const timestamp = Date.now();
      const tGameMs = Math.max(0, timestamp - activeRun.session.startTimeMs);
      const hash = await sha256Hex(`${activeRun.lastHash}\n${command}\n${Math.round(tGameMs)}\n${timestamp}\n${activeRun.session.sessionKey}`);
      activeRun.commands.push({ cmd: command, tGameMs: Math.round(tGameMs), tUnixMs: timestamp, hash });
      activeRun.lastHash = hash;
    }

    if (activeRun?.mode === 'local') {
      activeRun.commands.push({
        cmd: command,
        tGameMs: Math.max(0, Date.now() - state.startedAt),
        tUnixMs: Date.now(),
        hash: 'local-only',
      });
    }

    setState((current) => executeCommand(current, command));
  }

  async function loadLeaderboard(difficulty?: Difficulty) {
    setIsBusy(true);
    appendLines([createLine('info', `sessionctl: requesting leaderboard${difficulty ? ` difficulty=${difficulty}` : ''}`)], setTerminalLines);
    try {
      const rows = await fetchLeaderboard(difficulty);
      appendLines(createLeaderboardLines(rows, difficulty), setTerminalLines);
    } catch {
      appendLines([createLine('error', 'leaderboard unavailable')], setTerminalLines);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTerminalSubmit(command: string) {
    if (isBusy) {
      return;
    }

    if (mode === 'game') {
      await handleGameCommand(command);
      return;
    }

    if (tutorialOpen && tutorialStep === 3 && command.trim().toLowerCase() === 'lsblk') {
      setTutorialStep(4);
    }

    appendLines([createLine('command', `${getPromptLabel(state)} ${command}`)], setTerminalLines);
    await handleShellCommand(command);
  }

  const prompt = `${getPromptLabel(state)} `;
  const elapsedMs = mode === 'game' ? Math.max(0, now - state.startedAt) : runSummary.officialTimeMs;
  const timerLabel = mode === 'game' ? 'RUN' : runSummary.officialTimeMs !== null ? 'LAST' : 'IDLE';
  const hintText = currentObjective
    ? `${currentObjective.title}: ${state.lastTeachingNote?.ru ?? state.lastTeachingNote?.en ?? currentObjective.detail}`
    : null;
  const replayHashPreview = activeRun?.mode === 'official' ? activeRun.lastHash.slice(0, 8) : activeRun?.commands[activeRun.commands.length - 1]?.hash.slice(0, 8) ?? 'local';
  const themeOptions: Array<{ id: TerminalThemeId; label: string }> = [
    { id: 'emerald', label: 'Emerald CRT' },
    { id: 'amber', label: 'Amber Phosphor' },
    { id: 'ice', label: 'Ice Console' },
  ];

  async function handlePluginSubmit(url: string) {
    console.log(`Loading plugin from: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        appendLines([
          createLine('system', `[PLUGIN_LOADED] ${data.name || 'Custom Mod'}`),
          createLine('info', `Source: ${url}`),
          ...(data.description ? [createLine('info', data.description)] : [])
        ], setTerminalLines);
      }
    } catch (e) {
      console.error('Failed to load plugin', e);
      appendLines([createLine('error', `Failed to load plugin from ${url}`)], setTerminalLines);
    }
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainGraph onAddPlugin={handlePluginSubmit} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route 
          path="/vm" 
          element={<VmPanel onExit={() => window.location.href = '/'} terminalMode="vm" />} 
        />
        <Route 
          path="/simulations" 
          element={
            <div className="layout-horizontal">
              <main className="app-shell">
                <header className="app-header">
                  <div className="header-left">
                    <div className="logo-section" onClick={() => window.location.href = '/'}>
                      <span className="logo-icon">▲</span>
                      <h1 className="logo-text">ARCH_TRAINER // SIM</h1>
                    </div>
                  </div>
                </header>

                <div className="terminal-container">
                  <XtermTerminal
                    lines={terminalLines}
                    prompt={prompt}
                    showPrompt={!isBusy}
                    inputMode="text"
                    theme={uiSettings.theme}
                    onTabComplete={(buffer) => completeInput(state, buffer)}
                    onSubmit={handleTerminalSubmit}
                  />
                </div>
              </main>

              <aside className="terminal-sidebar">
                <div className="sidebar-header">
                  <h3>SYSTEM_STATUS</h3>
                  <div className="status-badge">ONLINE</div>
                </div>
                
                <div className="sidebar-section">
                  <h4>CURRENT_TASK</h4>
                  <p>{state.currentObjective || 'INITIALIZING...'}</p>
                </div>

                <div className="sidebar-section">
                  <h4>INSTALL_STATUS</h4>
                  <div className="status-grid">
                    <div className={`status-item ${state.install.rootMounted ? 'complete' : ''}`}>ROOT_MNT</div>
                    <div className={`status-item ${state.install.packagesInstalled ? 'complete' : ''}`}>PKGS_INST</div>
                    <div className={`status-item ${state.install.grubInstalled ? 'complete' : ''}`}>BOOTLOADER</div>
                    <div className={`status-item ${state.install.inChroot ? 'complete' : ''}`}>CHROOT</div>
                  </div>
                </div>

                <div className="sidebar-footer">
                  <button className="exit-btn" onClick={() => window.location.href = '/'}>
                    EXIT TO MAP
                  </button>
                </div>
              </aside>
            </div>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function detectBrowserProfile(): string {
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 'n/a';
  const memory = 'deviceMemory' in navigator ? String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'n/a') : 'n/a';
  return `cpu=${cores} mem=${memory}GiB ua=${navigator.userAgent.slice(0, 36)}`;
}

function createTerminalInfo(text: string) {
  lineCounter += 1;
  return {
    id: `info-${lineCounter}`,
    kind: 'info' as const,
    text,
  };
}

function createBootLines(compactBoot: boolean): TerminalLine[] {
  if (compactBoot) {
    return [
      createLine('output', 'Arch Linux 6.8.9-arch1 (tty1)'),
      createLine('info', 'Live ISO loaded. Root shell is available.'),
    ];
  }

  return [
    createLine('output', 'Arch Linux 6.8.9-arch1 (tty1)'),
    createLine('system', '[  OK  ] Reached target Multi-User System.'),
    createLine('system', '[  OK  ] Started arch-trainer-control.service.'),
    createLine('info', 'This is the Arch Linux installation medium.'),
    createLine('info', `Arch Trainer ${CLIENT_VERSION} overlay initialized.`),
    createLine('info', 'Type help for trainer commands, or start typing real Arch install commands.'),
  ];
}

function createMotdLines(verificationSummary: string, repo: string): TerminalLine[] {
  return [
    createLine('system', 'Welcome to Arch Trainer control shell.'),
    createLine('output', `verification: ${verificationSummary}`),
    createLine('output', `repo: ${repo}`),
    createLine('output', 'Use sessionctl start <difficulty> to boot the installer environment.'),
    createLine('output', 'Use sessionctl help for pseudo-system commands.'),
  ];
}

function createHelpLines(): TerminalLine[] {
  return [
    createLine('system', 'sessionctl help'),
    createLine('output', 'start [difficulty]'),
    createLine('output', 'sandbox [difficulty]'),
    createLine('output', 'sessionctl start <beginner|experienced|expert|god>'),
    createLine('output', 'sessionctl leaderboard [difficulty]'),
    createLine('output', 'sessionctl status'),
    createLine('output', 'sessionctl about'),
    createLine('output', 'logout | clear | whoami | pwd | ls | uname -a | hostnamectl | cat /etc/motd'),
    createLine('output', 'During install: use real Arch-style commands, or exit to abort the current session.'),
  ];
}

function createLeaderboardLines(rows: LeaderboardEntry[], difficulty?: Difficulty): TerminalLine[] {
  if (rows.length === 0) {
    return [
      createLine('system', `official leaderboard${difficulty ? ` difficulty=${difficulty}` : ''}`),
      createLine('output', 'no verified runs yet'),
    ];
  }

  return [
    createLine('system', `official leaderboard${difficulty ? ` difficulty=${difficulty}` : ''}`),
    ...rows.slice(0, 10).map((row, index) =>
      createLine('output', `${String(index + 1).padStart(2, '0')} ${row.forkName} ${formatDurationMs(row.timeMs)} ${row.difficulty}`),
    ),
  ];
}

function appendLines(lines: TerminalLine[], setTerminalLines: React.Dispatch<React.SetStateAction<TerminalLine[]>>) {
  setTerminalLines((current) => [...current, ...lines]);
}

function createLine(kind: TerminalLine['kind'], text: string): TerminalLine {
  lineCounter += 1;
  return {
    id: `tty-${lineCounter}`,
    kind,
    text,
  };
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'beginner' || value === 'experienced' || value === 'expert' || value === 'god';
}

function parseDifficultyToken(value: string | undefined): Difficulty | undefined {
  if (!value) {
    return undefined;
  }

  if (isDifficulty(value)) {
    return value;
  }

  if (value === 'beginer' || value === 'beg') {
    return 'beginner';
  }

  if (value === 'exp') {
    return 'experienced';
  }

  return undefined;
}

function buildStateRows(state: GameState): Array<{ label: string; value: string; status: 'status-good' | 'status-bad' | 'status-active' | 'status-idle' }> {
  const networkUp = state.networkInterfaces.some((networkInterface) => networkInterface.connected);
  const selectedDisk = state.install.selectedDisk ?? state.installTargetDisk;
  const targetDisk = state.disks.find((disk) => disk.device === state.installTargetDisk);
  return [
    { label: 'NET', value: networkUp ? 'UP' : 'DOWN', status: networkUp ? 'status-good' : 'status-bad' },
    { label: 'DISK', value: selectedDisk.replace('/dev/', ''), status: 'status-active' },
    { label: 'PARTS', value: String(targetDisk?.partitions.length ?? 0), status: (targetDisk?.partitions.length ?? 0) > 0 ? 'status-good' : 'status-idle' },
    { label: '/mnt', value: state.install.rootMounted ? 'MOUNTED' : 'NO', status: state.install.rootMounted ? 'status-good' : 'status-idle' },
    { label: 'BASE', value: state.install.packagesInstalled ? 'OK' : '--', status: state.install.packagesInstalled ? 'status-good' : 'status-idle' },
    { label: 'CHRT', value: state.install.inChroot ? 'YES' : 'NO', status: state.install.inChroot ? 'status-good' : 'status-idle' },
    { label: 'GRUB', value: state.install.grubInstalled && state.install.grubConfigGenerated ? 'OK' : '--', status: state.install.grubInstalled && state.install.grubConfigGenerated ? 'status-good' : 'status-idle' },
  ];
}

function loadUiSettings(): UiSettings {
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return {
      preferredDifficulty: 'beginner',
      compactBoot: false,
      theme: 'emerald',
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      preferredDifficulty: parseDifficultyToken(parsed.preferredDifficulty) ?? 'beginner',
      compactBoot: Boolean(parsed.compactBoot),
      theme: parsed.theme === 'amber' || parsed.theme === 'ice' ? parsed.theme : 'emerald',
    };
  } catch {
    return {
      preferredDifficulty: 'beginner',
      compactBoot: false,
      theme: 'emerald',
    };
  }
}

function formatDurationMs(totalMs: number | null): string {
  if (totalMs === null) {
    return 'pending';
  }

  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function getVisitorSessionId(): string {
  const key = 'arch-trainer-visitor-session';
  const existing = window.sessionStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const next = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

function formatVisitTimestamp(value: string | null): string {
  if (!value) {
    return 'offline';
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  return new Date(timestamp).toLocaleString();
}

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function saveSession(payload: SavedSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function loadSavedSession(): SavedSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SavedSession;
  } catch {
    return null;
  }
}

function restoreCheckpoint(
  checkpoint: CheckpointSnapshot,
  setState: React.Dispatch<React.SetStateAction<GameState>>,
  setTerminalLines: React.Dispatch<React.SetStateAction<TerminalLine[]>>,
  setMode: React.Dispatch<React.SetStateAction<TerminalMode>>,
  setRunSummary: React.Dispatch<React.SetStateAction<RunSummary>>,
  activeRunRef: React.MutableRefObject<ActiveRun | null>,
  appendedHistoryRef: React.MutableRefObject<number>,
): void {
  const restored = cloneGameState(checkpoint.snapshot);
  activeRunRef.current = {
    mode: 'local',
    commands: [],
    submitted: false,
  };
  appendedHistoryRef.current = restored.history.length;
  setState(restored);
  setTerminalLines(restored.history);
  setMode('game');
  setRunSummary({
    mode: 'local',
    submissionState: 'idle',
    submissionMessage: `Restored checkpoint: ${checkpoint.title}`,
    officialTimeMs: null,
  });
}