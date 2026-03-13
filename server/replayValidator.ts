import { createHash } from 'node:crypto';
import { createInitialState, simulateCommand } from '../src/features/simulator/engine.js';
import type { ReplayCommand, ReplaySubmission, ReplayValidationIssue, ReplayValidationResult, SessionRecord } from '../src/shared/replay.js';

export function validateReplay(session: SessionRecord, replay: ReplaySubmission, receivedAtMs: number): ReplayValidationResult {
  if (session.usedAtMs !== null) {
    return rejected('SESSION_USED', 'This session has already been submitted once and is now closed.');
  }

  if (receivedAtMs > session.expiresAtMs) {
    return rejected('SESSION_EXPIRED', 'This session expired before the replay reached the server.');
  }

  if (session.difficulty !== replay.difficulty) {
    return rejected('DIFFICULTY_MISMATCH', 'Replay difficulty does not match the server-issued session.');
  }

  if (session.seed !== replay.seed) {
    return rejected('SEED_MISMATCH', 'Replay seed does not match the server-issued scenario seed.');
  }

  if (replay.commands.length === 0) {
    return rejected('EMPTY_REPLAY', 'Replay contains no commands.');
  }

  const replayHash = computeReplayHash(session, replay.commands);
  let state = createInitialState(session.difficulty, {
    seed: session.seed,
    startedAtMs: session.startTimeMs,
    profile: session.profile,
  });
  let previousCommand: ReplayCommand | null = null;
  let previousHash = createCommandChainRoot(session);

  for (let index = 0; index < replay.commands.length; index += 1) {
    const command = replay.commands[index];

     const expectedHash = computeCommandHash(previousHash, command, session.sessionKey);
     if (command.hash !== expectedHash) {
      return {
        accepted: false,
        officialTimeMs: null,
        commandsAccepted: index,
        issue: {
          code: 'HASH_CHAIN_BROKEN',
          message: 'Replay command hash chain does not match the server-issued session key.',
          commandIndex: index,
          command: command.cmd,
        },
        replayHash,
        installHash: null,
        completed: false,
      };
    }

    const timeIssue = validateReplayTiming(previousCommand, command);
    if (timeIssue) {
      return {
        accepted: false,
        officialTimeMs: null,
        commandsAccepted: index,
        issue: {
          ...timeIssue,
          commandIndex: index,
          command: command.cmd,
        },
        replayHash,
        installHash: null,
        completed: false,
      };
    }

    const injectionIssue = validateCommandShape(command.cmd);
    if (injectionIssue) {
      return {
        accepted: false,
        officialTimeMs: null,
        commandsAccepted: index,
        issue: {
          ...injectionIssue,
          commandIndex: index,
          command: command.cmd,
        },
        replayHash,
        installHash: null,
        completed: false,
      };
    }

    const result = simulateCommand(state, command.cmd);
    if (!result.accepted) {
      return {
        accepted: false,
        officialTimeMs: null,
        commandsAccepted: index,
        issue: {
          code: 'SIMULATION_REJECTED',
          message: result.errorText ?? 'Server-side simulator rejected the replay command.',
          commandIndex: index,
          command: command.cmd,
        },
        replayHash,
        installHash: null,
        completed: false,
      };
    }

    state = result.nextState;
    previousCommand = command;
    previousHash = command.hash;
  }

  if (!state.completed) {
    return {
      accepted: false,
      officialTimeMs: null,
      commandsAccepted: replay.commands.length,
      issue: {
        code: 'FINISH_NOT_REACHED',
        message: 'Replay ended before the system reached a successful boot state.',
      },
      replayHash,
      installHash: null,
      completed: false,
    };
  }
  const installHash = computeInstallHash(state);

  return {
    accepted: true,
    officialTimeMs: Math.max(0, receivedAtMs - session.startTimeMs),
    commandsAccepted: replay.commands.length,
    issue: null,
    replayHash,
    installHash,
    completed: true,
  };
}

export function computeReplayHash(session: SessionRecord, commands: ReplayCommand[]): string {
  const hash = createHash('sha256');
  hash.update(session.sessionKey);
  hash.update(session.sessionId);
  hash.update(JSON.stringify(commands));
  return hash.digest('hex');
}

export function createCommandChainRoot(session: SessionRecord): string {
  return createHash('sha256').update(`${session.sessionId}:${session.seed}:${session.buildHash}`).digest('hex');
}

export function computeCommandHash(previousHash: string, command: ReplayCommand, sessionKey: string): string {
  return createHash('sha256')
    .update(`${previousHash}\n${command.cmd}\n${command.tGameMs}\n${command.tUnixMs}\n${sessionKey}`)
    .digest('hex');
}

export function computeInstallHash(state: ReturnType<typeof createInitialState>): string {
  const stableState = {
    seed: state.seed,
    profile: state.profile,
    difficulty: state.difficulty,
    hardware: state.hardware,
    disks: state.disks,
    installTargetDisk: state.installTargetDisk,
    networkInterfaces: state.networkInterfaces,
    events: state.events,
    install: state.install,
    completed: state.completed,
  };

  return createHash('sha256').update(JSON.stringify(stableState)).digest('hex');
}

function validateReplayTiming(previous: ReplayCommand | null, current: ReplayCommand) {
  if (previous === null) {
    if (current.tGameMs < 0 || current.tUnixMs < 0) {
      return {
        code: 'TIME_REGRESSION' as const,
        message: 'Replay timestamps must start at non-negative values.',
      };
    }

    return null;
  }

  const deltaGame = current.tGameMs - previous.tGameMs;
  const deltaUnix = current.tUnixMs - previous.tUnixMs;

  if (deltaGame < 0 || deltaUnix < 0) {
    return {
      code: 'TIME_REGRESSION' as const,
      message: 'Replay timestamps must be monotonically increasing.',
    };
  }

  const minimumHumanDelay = estimateMinimumHumanDelayMs(current.cmd);
  if (deltaGame < minimumHumanDelay) {
    return {
      code: 'TIME_WARP' as const,
      message: `Command cadence is too fast to be plausible: expected at least ${minimumHumanDelay}ms between commands.`,
    };
  }

  const drift = Math.abs(deltaUnix - deltaGame);
  const allowedDrift = Math.max(250, deltaGame * 0.35);
  if (drift > allowedDrift) {
    return {
      code: 'UNIX_DRIFT' as const,
      message: 'Game clock and UNIX timestamps drift beyond the accepted tolerance.',
    };
  }

  return null;
}

function validateCommandShape(command: string) {
  if (/[;`]/.test(command) || command.includes('&&') || command.includes('||') || command.includes('$(')) {
    return {
      code: 'COMMAND_INJECTION' as const,
      message: 'Replay command contains shell control operators that are not allowed in the simulator.',
    };
  }

  return null;
}

function estimateMinimumHumanDelayMs(command: string): number {
  const trimmed = command.trim();
  const base = 180;
  const perCharacter = trimmed.length * 14;
  return Math.min(2200, base + perCharacter);
}

function rejected(code: ReplayValidationIssue['code'], message: string): ReplayValidationResult {
  return {
    accepted: false,
    officialTimeMs: null,
    commandsAccepted: 0,
    issue: {
      code,
      message,
    },
    replayHash: '',
    installHash: null,
    completed: false,
  };
}