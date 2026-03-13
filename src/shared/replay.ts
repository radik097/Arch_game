import type { Difficulty } from '../features/simulator/types';

export interface ReplayCommand {
  cmd: string;
  tGameMs: number;
  tUnixMs: number;
  hash: string;
}

export interface ReplaySubmission {
  version: string;
  difficulty: Difficulty;
  sessionId: string;
  seed: string;
  playerId: string;
  githubRepo: string;
  buildHash: string;
  buildId: string;
  commands: ReplayCommand[];
  replayHash?: string;
}

export interface ForkConfig {
  config_version: number;
  fork_name: string;
  github_repo: string;
  player_id: string;
  build_hash: string;
  fork_signature: string;
  required_proof_file: string;
}

export interface BuildProof {
  version: number;
  build_hash: string;
  config_hash: string;
  generated_at: string;
  build_id: string;
  files_hashed: string[];
  signature: string;
}

export interface SessionVerificationBundle {
  playerId: string;
  githubRepo: string;
  forkName: string;
  config: ForkConfig;
  buildProof: BuildProof;
}

export interface SessionStartRequest {
  difficulty: Difficulty;
  version: string;
  verification: SessionVerificationBundle;
}

export interface SessionStartResponse {
  sessionId: string;
  sessionKey: string;
  startTimeMs: number;
  seed: string;
  profile: string;
  playerId: string;
  githubRepo: string;
  buildHash: string;
  buildId: string;
  forkName: string;
  expiresInSec: number;
  verificationMode: 'official';
}

export interface PlayerRegistrationRequest {
  githubRepo: string;
}

export interface PlayerRegistrationResponse {
  playerId: string;
  playerSecret: string;
  githubRepo: string;
  configUrl: string;
  proofFile: string;
  forkVerified: boolean;
}

export interface ReplayValidationIssue {
  code:
    | 'SESSION_NOT_FOUND'
    | 'SESSION_EXPIRED'
    | 'SESSION_USED'
    | 'DIFFICULTY_MISMATCH'
    | 'SEED_MISMATCH'
    | 'EMPTY_REPLAY'
    | 'TIME_REGRESSION'
    | 'TIME_WARP'
    | 'UNIX_DRIFT'
    | 'HASH_CHAIN_BROKEN'
    | 'COMMAND_INJECTION'
    | 'SIMULATION_REJECTED'
    | 'FINISH_NOT_REACHED';
  message: string;
  commandIndex?: number;
  command?: string;
}

export interface ReplayValidationResult {
  accepted: boolean;
  officialTimeMs: number | null;
  commandsAccepted: number;
  issue: ReplayValidationIssue | null;
  replayHash: string;
  installHash: string | null;
  completed: boolean;
}

export interface SessionRecord {
  sessionId: string;
  difficulty: Difficulty;
  playerId: string;
  forkName: string;
  githubRepo: string;
  version: string;
  startTimeMs: number;
  createdAtMs: number;
  expiresAtMs: number;
  usedAtMs: number | null;
  seed: string;
  profile: string;
  sessionKey: string;
  buildHash: string;
  buildId: string;
  verificationMode: 'official';
}

export interface PlayerRecord {
  playerId: string;
  githubRepo: string;
  playerSecret: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  id: string;
  playerId: string;
  forkName: string;
  githubRepo: string;
  difficulty: Difficulty;
  timeMs: number;
  commandsCount: number;
  replayHash: string;
  buildHash: string;
  installHash: string;
  verified: boolean;
  createdAt: string;
  sessionId: string;
}