import { describe, expect, it } from 'vitest';
import { computeBuildProofSignature, computeConfigHash } from '../verification.js';
import type { BuildProof, ForkConfig } from '../../src/shared/replay.js';

describe('verification helpers', () => {
  it('computes deterministic config and proof signatures', () => {
    const config: ForkConfig = {
      config_version: 1,
      fork_name: 'tester-fork',
      github_repo: 'tester/arch-trainer-fork',
      player_id: 'player-001',
      build_hash: 'build-hash-001',
      fork_signature: 'I installed Arch the hard way.',
      required_proof_file: 'build_proof.json',
    };
    const configHash = computeConfigHash(config);
    const proof: BuildProof = {
      version: 1,
      build_hash: 'build-hash-001',
      config_hash: configHash,
      generated_at: '2026-03-13T00:00:00.000Z',
      build_id: 'build-001',
      files_hashed: ['package.json', 'src/app/App.tsx'],
      signature: '',
    };

    expect(configHash).toHaveLength(64);
    expect(computeBuildProofSignature('secret-001', proof)).toHaveLength(64);
  });
});