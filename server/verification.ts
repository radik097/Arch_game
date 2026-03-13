import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  BuildProof,
  ForkConfig,
  PlayerRecord,
  PlayerRegistrationRequest,
  PlayerRegistrationResponse,
  SessionStartRequest,
} from '../src/shared/replay.js';
import { createPlayer, getPlayerById, getPlayerByRepo } from './storage/fileStore.js';

interface GitHubRepoMetadata {
  fullName: string;
  defaultBranch: string;
  fork: boolean;
}

interface VerifiedForkBundle {
  player: PlayerRecord;
  githubRepo: string;
  forkName: string;
  buildHash: string;
  buildId: string;
}

export async function registerPlayer(request: PlayerRegistrationRequest): Promise<PlayerRegistrationResponse> {
  const githubRepo = normalizeGitHubRepo(request.githubRepo);
  const metadata = await fetchRepoMetadata(githubRepo);
  if (!metadata.fork) {
    throw new Error('GitHub repository must be an actual fork of Arch Trainer before registration.');
  }

  const existing = await getPlayerByRepo(githubRepo);
  if (existing) {
    return {
      playerId: existing.playerId,
      playerSecret: existing.playerSecret,
      githubRepo: existing.githubRepo,
      configUrl: buildRawGitHubUrl(githubRepo, metadata.defaultBranch, 'archtrainer.config.json'),
      proofFile: 'build_proof.json',
      forkVerified: true,
    };
  }

  const player: PlayerRecord = {
    playerId: randomUUID(),
    githubRepo,
    playerSecret: randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
  };

  await createPlayer(player);

  return {
    playerId: player.playerId,
    playerSecret: player.playerSecret,
    githubRepo,
    configUrl: buildRawGitHubUrl(githubRepo, metadata.defaultBranch, 'archtrainer.config.json'),
    proofFile: 'build_proof.json',
    forkVerified: true,
  };
}

export async function verifyForkSessionRequest(request: SessionStartRequest): Promise<VerifiedForkBundle> {
  const bundle = request.verification;
  const githubRepo = normalizeGitHubRepo(bundle.githubRepo);
  const player = await getPlayerById(bundle.playerId);
  if (!player) {
    throw new Error('Player is not registered on the official session server.');
  }

  if (player.githubRepo !== githubRepo) {
    throw new Error('Registered player repo does not match the requested fork.');
  }

  const metadata = await fetchRepoMetadata(githubRepo);
  if (!metadata.fork) {
    throw new Error('Official leaderboard accepts only verified GitHub forks.');
  }

  const remoteConfig = await fetchRepoJson<ForkConfig>(githubRepo, metadata.defaultBranch, 'archtrainer.config.json');
  const remoteBuildProof = await fetchRepoJson<BuildProof>(githubRepo, metadata.defaultBranch, 'build_proof.json');

  validateForkConfig(remoteConfig, githubRepo, player.playerId);
  validateBuildProof(remoteBuildProof, remoteConfig, player.playerSecret);

  if (JSON.stringify(normalizeForkConfig(remoteConfig)) !== JSON.stringify(normalizeForkConfig(bundle.config))) {
    throw new Error('Client fork config does not match the repo version checked by the server.');
  }

  if (JSON.stringify(normalizeBuildProof(remoteBuildProof)) !== JSON.stringify(normalizeBuildProof(bundle.buildProof))) {
    throw new Error('Client build proof does not match the repo version checked by the server.');
  }

  return {
    player,
    githubRepo,
    forkName: remoteConfig.fork_name.trim(),
    buildHash: remoteBuildProof.build_hash,
    buildId: remoteBuildProof.build_id,
  };
}

export function computeConfigHash(config: ForkConfig): string {
  return sha256(JSON.stringify(normalizeForkConfig(config)));
}

export function computeBuildProofSignature(playerSecret: string, buildProof: BuildProof): string {
  return sha256(
    `${playerSecret}:${buildProof.build_hash}:${buildProof.config_hash}:${buildProof.generated_at}:${buildProof.build_id}`,
  );
}

function validateForkConfig(config: ForkConfig, githubRepo: string, playerId: string): void {
  if (config.config_version !== 1) {
    throw new Error('Unsupported fork config version.');
  }

  if (normalizeGitHubRepo(config.github_repo) !== githubRepo) {
    throw new Error('Fork config github_repo does not match the verified repo URL.');
  }

  if (config.player_id.trim() !== playerId) {
    throw new Error('Fork config player_id does not match the registered player.');
  }

  if (config.fork_signature.trim() !== 'I installed Arch the hard way.') {
    throw new Error('Fork config does not contain the required fork signature.');
  }

  if (!config.fork_name.trim()) {
    throw new Error('Fork config fork_name must be populated for official sessions.');
  }

  if (!config.build_hash.trim()) {
    throw new Error('Fork config build_hash must be populated by the build proof step.');
  }
}

function validateBuildProof(buildProof: BuildProof, config: ForkConfig, playerSecret: string): void {
  if (buildProof.version !== 1) {
    throw new Error('Unsupported build proof version.');
  }

  if (buildProof.build_hash !== config.build_hash) {
    throw new Error('Build proof hash does not match archtrainer.config.json.');
  }

  if (buildProof.config_hash !== computeConfigHash(config)) {
    throw new Error('Build proof config hash is invalid.');
  }

  const expectedSignature = computeBuildProofSignature(playerSecret, buildProof);
  if (buildProof.signature !== expectedSignature) {
    throw new Error('Build proof signature is invalid. Rebuild with the registered player secret.');
  }
}

async function fetchRepoMetadata(githubRepo: string): Promise<GitHubRepoMetadata> {
  const response = await fetch(`https://api.github.com/repos/${githubRepo}`, {
    headers: githubHeaders(),
  });

  if (!response.ok) {
    throw new Error(`GitHub repo verification failed for ${githubRepo}.`);
  }

  const payload = (await response.json()) as { full_name: string; default_branch: string; fork: boolean };

  return {
    fullName: payload.full_name,
    defaultBranch: payload.default_branch,
    fork: payload.fork,
  };
}

async function fetchRepoJson<T>(githubRepo: string, branch: string, filePath: string): Promise<T> {
  const response = await fetch(buildRawGitHubUrl(githubRepo, branch, filePath), {
    headers: githubHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Official server could not fetch ${filePath} from ${githubRepo}.`);
  }

  return (await response.json()) as T;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'arch-trainer-session-server',
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function buildRawGitHubUrl(githubRepo: string, branch: string, filePath: string): string {
  return `https://raw.githubusercontent.com/${githubRepo}/${branch}/${filePath}`;
}

function normalizeForkConfig(config: ForkConfig): ForkConfig {
  return {
    config_version: 1,
    fork_name: config.fork_name.trim(),
    github_repo: normalizeGitHubRepo(config.github_repo),
    player_id: config.player_id.trim(),
    build_hash: config.build_hash.trim(),
    fork_signature: config.fork_signature.trim(),
    required_proof_file: config.required_proof_file.trim(),
  };
}

function normalizeBuildProof(buildProof: BuildProof): BuildProof {
  return {
    version: 1,
    build_hash: buildProof.build_hash.trim(),
    config_hash: buildProof.config_hash.trim(),
    generated_at: buildProof.generated_at.trim(),
    build_id: buildProof.build_id.trim(),
    files_hashed: [...buildProof.files_hashed].sort(),
    signature: buildProof.signature.trim(),
  };
}

function normalizeGitHubRepo(value: string): string {
  const trimmed = value.trim().replace(/\.git$/, '');
  if (trimmed.startsWith('https://github.com/')) {
    return trimmed.replace('https://github.com/', '');
  }

  return trimmed.replace(/^github\.com\//, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}