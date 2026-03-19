import { deriveCurrentObjective, isNetworkReady } from './objectives';
import { generateSystem } from './systemGenerator';
import type {
  Difficulty,
  DiskState,
  GameState,
  PartitionState,
  TeachingNote,
  TerminalLine,
} from './types';
import { parseCommandLine } from './parser';
import { dispatchCommand } from './commandRegistry';
import { 
  createLine, 
  createWelcomeLines,
  finalizeState, 
  advanceState, 
  withCommandProgress, 
  failState, 
  resolvePath, 
  buildVirtualFs, 
  basename, 
  listDirectoryEntries,
  findEntries,
  renderLsblk,
  renderIpLink,
  getInstallDisk,
  getPartitionByRole,
  partitionName,
  findPartition,
  updatePartitionFilesystem,
  updateInstallFlag,
  markEventResolved,
  describeActiveEvents,
  beginnerExplanation,
  getLastLineByKind,
  getCommandSuggestions,
  completePathToken,
  longestSharedPrefix,
  resolvePingTarget,
  handleFdiskSessionCommand
} from './simulatorUtils';

export interface SimulatedCommandResult {
  nextState: GameState;
  accepted: boolean;
  emittedLines: TerminalLine[];
  errorText: string | null;
}

export interface CompletionResult {
  buffer: string;
  suggestions: string[];
}

const REQUIRED_PACSTRAP_PACKAGES = ['base', 'linux', 'linux-firmware', 'networkmanager', 'grub', 'efibootmgr'];
const DEFAULT_SEED = 'local-offline-seed';

interface CreateInitialStateOptions {
  seed?: string;
  startedAtMs?: number;
  profile?: string;
}

export function createInitialState(difficulty: Difficulty, options: CreateInitialStateOptions = {}): GameState {
  const seed = options.seed ?? DEFAULT_SEED;
  const profile = options.profile ?? 'uefi-single-root-grub';
  const generated = generateSystem(seed, difficulty);

  const state: GameState = {
    difficulty,
    seed,
    profile,
    history: createWelcomeLines(difficulty, generated.installTargetDisk, generated.disks),
    hardware: generated.hardware,
    disks: generated.disks,
    installTargetDisk: generated.installTargetDisk,
    networkInterfaces: generated.networkInterfaces,
    events: generated.events,
    pseudoFs: generated.pseudoFs,
    install: {
      selectedDisk: null,
      rootMounted: false,
      bootMounted: false,
      packagesUpdated: false,
      packagesInstalled: false,
      fstabGenerated: false,
      inChroot: false,
      timezoneSet: false,
      clockSynced: false,
      localeGenerated: false,
      hostnameSet: false,
      passwdSet: false,
      networkManagerEnabled: false,
      grubInstalled: false,
      grubConfigGenerated: false,
      unmounted: false,
      rebooted: false,
      mounted: {},
      installedPackages: [],
    },
    startedAt: options.startedAtMs ?? Date.now(),
    attempt: 1,
    currentObjective: 'inspect',
    completed: false,
    lastTeachingNote: null,
    lastEvent: generated.events.length > 0 ? describeActiveEvents(generated.events) : 'Hardware probe complete.',
    runtime: {
      commandCount: 0,
      eventLog: [],
      mode: 'browser',
      browserProfile: null,
      currentDirectory: '/root',
      fdiskSession: {
        active: false,
        device: null,
        hasGpt: false,
        draftPartitions: [],
      },
    },
  };

  state.currentObjective = deriveCurrentObjective(state);
  return state;
}

export function executeCommand(state: GameState, rawInput: string): GameState {
  const input = rawInput.trim();
  if (input.length === 0) {
    return state;
  }

  const commandPrompt = getPromptLabel(state);
  const commandLine = createLine('command', `${commandPrompt} ${input}`);

  // Special UI/Simulator control commands
  if (input === 'clear') {
    return { ...state, history: [] };
  }

  if (input === 'reset') {
    const resetState = createInitialState(state.difficulty, { seed: state.seed, profile: state.profile });
    resetState.history = [createLine('system', 'Simulation reset.'), ...resetState.history];
    return resetState;
  }

  // Handle interactive sub-sessions (like fdisk)
  if (state.runtime.fdiskSession.active) {
    return withCommandProgress(handleFdiskSessionCommand(state, commandLine, input));
  }

  const parsed = parseCommandLine(input);
  if (!parsed) {
    // This case should ideally not be reached if parseCommandLine handles all inputs,
    // but as a safeguard, we can treat it as an unknown command.
    return failState(state, commandLine, `-bash: ${input.split(' ')[0]}: command not found`);
  }

  const result = dispatchCommand(parsed, state, commandLine);
  if (result) {
    return result;
  }

  // Fallback for unknown commands
  return failState(state, commandLine, `-bash: ${parsed.command}: command not found`);
}

export function simulateCommand(state: GameState, rawInput: string): SimulatedCommandResult {
  const nextState = executeCommand(state, rawInput);
  const emittedLines = nextState.history.slice(state.history.length);
  const errorText = getLastLineByKind(emittedLines, 'error')?.text ?? null;

  return {
    nextState,
    accepted: errorText === null,
    emittedLines,
    errorText,
  };
}

export function getPromptLabel(state: GameState): string {
  const displayPath = state.runtime.currentDirectory === '/root'
    ? '~'
    : state.runtime.currentDirectory.startsWith('/root/')
      ? `~${state.runtime.currentDirectory.slice('/root'.length)}`
      : state.runtime.currentDirectory;
  return `[root@archiso ${displayPath}]#`;
}

export function completeInput(state: GameState, rawInput: string): CompletionResult {
  const tokenMatch = /(^|\s)([^\s]*)$/.exec(rawInput);
  const token = tokenMatch?.[2] ?? '';
  const tokenStart = tokenMatch ? rawInput.length - token.length : rawInput.length;
  const firstToken = rawInput.trim().split(/\s+/)[0] ?? '';
  const shouldCompletePath = token.startsWith('/') || ['cd', 'ls', 'cat', 'find', 'fdisk', 'mount', 'umount', 'mkfs.ext4', 'mkfs.fat'].includes(firstToken);

  const suggestions = shouldCompletePath
    ? completePathToken(state, token)
    : getCommandSuggestions().filter((command) => command.startsWith(token)).sort();

  if (suggestions.length === 0) {
    return { buffer: rawInput, suggestions: [] };
  }

  const nextToken = longestSharedPrefix(suggestions);
  return {
    buffer: nextToken.length > token.length ? `${rawInput.slice(0, tokenStart)}${nextToken}` : rawInput,
    suggestions,
  };
}