import type { BuildProof, ForkConfig, SessionVerificationBundle } from '../../shared/replay';
import buildProofJson from '../../../build_proof.json';
import forkConfigJson from '../../../archtrainer.config.json';

const forkConfig = forkConfigJson as ForkConfig;
const buildProof = buildProofJson as BuildProof;

export function getLocalForkConfig(): ForkConfig {
  return forkConfig;
}

export function getLocalBuildProof(): BuildProof {
  return buildProof;
}

export function createVerificationBundle(): SessionVerificationBundle | null {
  if (!isProofReady()) {
    return null;
  }

  return {
    playerId: forkConfig.player_id,
    githubRepo: forkConfig.github_repo,
    forkName: forkConfig.fork_name,
    config: forkConfig,
    buildProof,
  };
}

export function isProofReady(): boolean {
  return [
    forkConfig.fork_name,
    forkConfig.github_repo,
    forkConfig.player_id,
    forkConfig.build_hash,
    buildProof.build_hash,
    buildProof.config_hash,
    buildProof.generated_at,
    buildProof.build_id,
    buildProof.signature,
  ].every((value) => typeof value === 'string' && value.trim().length > 0) && forkConfig.build_hash === buildProof.build_hash;
}

export function getVerificationSummary(): string {
  if (!forkConfig.github_repo || !forkConfig.player_id) {
    return 'fork_config=missing';
  }

  if (!isProofReady()) {
    return 'fork_config=unverified';
  }

  return `fork_config=verified build=${buildProof.build_id}`;
}