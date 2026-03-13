import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../src/features/simulator/engine.js';
import { computeCommandHash, computeReplayHash, createCommandChainRoot, validateReplay } from '../replayValidator.js';
import type { ReplaySubmission, SessionRecord } from '../../src/shared/replay.js';

function createSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: 'session-001',
    difficulty: 'beginner',
    playerId: 'player-001',
    forkName: 'tester-fork',
    githubRepo: 'tester/arch-trainer-fork',
    version: '0.1.0',
    startTimeMs: 1_710_000_000_000,
    createdAtMs: 1_710_000_000_000,
    expiresAtMs: 1_710_000_900_000,
    usedAtMs: null,
    seed: 'seed-001',
    profile: 'uefi-single-root-grub',
    sessionKey: 'server-secret',
    buildHash: 'build-hash-001',
    buildId: 'build-001',
    verificationMode: 'official',
    ...overrides,
  };
}

function createReplay(commands: ReplaySubmission['commands'], difficulty: ReplaySubmission['difficulty'] = 'beginner'): ReplaySubmission {
  return {
    version: '1.0',
    difficulty,
    sessionId: 'session-001',
    seed: 'seed-001',
    playerId: 'player-001',
    githubRepo: 'tester/arch-trainer-fork',
    buildHash: 'build-hash-001',
    buildId: 'build-001',
    commands,
  };
}

function buildReplayInstallSequence(session: SessionRecord) {
  const state = createInitialState(session.difficulty, { seed: session.seed, startedAtMs: session.startTimeMs, profile: session.profile });
  const efiPartition = state.installTargetDisk.includes('nvme') ? `${state.installTargetDisk}p1` : `${state.installTargetDisk}1`;
  const rootPartition = state.installTargetDisk.includes('nvme') ? `${state.installTargetDisk}p2` : `${state.installTargetDisk}2`;

  return [
    { cmd: `fdisk ${state.installTargetDisk}`, tGameMs: 500, tUnixMs: 500 },
    { cmd: `mkfs.fat -F32 ${efiPartition}`, tGameMs: 1300, tUnixMs: 1260 },
    { cmd: `mkfs.ext4 ${rootPartition}`, tGameMs: 2200, tUnixMs: 2140 },
    { cmd: `mount ${rootPartition} /mnt`, tGameMs: 3050, tUnixMs: 3000 },
    { cmd: `mount --mkdir ${efiPartition} /mnt/boot`, tGameMs: 4050, tUnixMs: 3950 },
    { cmd: 'pacstrap /mnt base linux linux-firmware networkmanager grub efibootmgr', tGameMs: 6100, tUnixMs: 6000 },
    { cmd: 'genfstab -U /mnt >> /mnt/etc/fstab', tGameMs: 7100, tUnixMs: 7000 },
    { cmd: 'arch-chroot /mnt', tGameMs: 7900, tUnixMs: 7800 },
    { cmd: 'ln -sf /usr/share/zoneinfo/UTC /etc/localtime', tGameMs: 9000, tUnixMs: 8900 },
    { cmd: 'hwclock --systohc', tGameMs: 9800, tUnixMs: 9700 },
    { cmd: 'locale-gen', tGameMs: 10600, tUnixMs: 10500 },
    { cmd: 'echo archbox > /etc/hostname', tGameMs: 11250, tUnixMs: 11180 },
    { cmd: 'passwd', tGameMs: 12000, tUnixMs: 11900 },
    { cmd: 'systemctl enable NetworkManager', tGameMs: 13100, tUnixMs: 13000 },
    { cmd: 'grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB', tGameMs: 15400, tUnixMs: 15300 },
    { cmd: 'grub-mkconfig -o /boot/grub/grub.cfg', tGameMs: 16700, tUnixMs: 16600 },
    { cmd: 'exit', tGameMs: 17300, tUnixMs: 17200 },
    { cmd: 'umount -R /mnt', tGameMs: 18200, tUnixMs: 18100 },
    { cmd: 'reboot', tGameMs: 19000, tUnixMs: 18900 },
  ];
}

function signCommands(session: SessionRecord, commands: Array<Omit<ReplaySubmission['commands'][number], 'hash'>>) {
  let previousHash = createCommandChainRoot(session);

  return commands.map((command) => {
    const signed = {
      ...command,
      hash: computeCommandHash(previousHash, { ...command, hash: '' }, session.sessionKey),
    };

    previousHash = signed.hash;
    return signed;
  });
}

describe('replay validator', () => {
  it('accepts a valid replay and computes a replay hash', () => {
    const session = createSessionRecord();
    const replay = createReplay(signCommands(session, buildReplayInstallSequence(session)));

    const result = validateReplay(session, replay, session.startTimeMs + 19_000);

    expect(result.accepted).toBe(true);
    expect(result.officialTimeMs).toBe(19000);
    expect(result.replayHash).toBe(computeReplayHash(session, replay.commands));
  });

  it('rejects impossible command cadence', () => {
    const session = createSessionRecord();
    const baseSequence = buildReplayInstallSequence(session);
    const replay = createReplay(signCommands(session, [baseSequence[0], { ...baseSequence[1], tGameMs: 520, tUnixMs: 520 }]));

    const result = validateReplay(session, replay, session.startTimeMs + 520);

    expect(result.accepted).toBe(false);
    expect(result.issue?.code).toBe('TIME_WARP');
  });

  it('rejects replays that violate the simulator state machine', () => {
    const session = createSessionRecord();
    const replay = createReplay(signCommands(session, [
      { cmd: 'pacstrap /mnt base linux linux-firmware networkmanager grub efibootmgr', tGameMs: 2000, tUnixMs: 2000 },
    ]));

    const result = validateReplay(session, replay, session.startTimeMs + 2000);

    expect(result.accepted).toBe(false);
    expect(result.issue?.code).toBe('SIMULATION_REJECTED');
  });

  it('rejects a broken hash chain', () => {
    const session = createSessionRecord();
    const replay = createReplay([
      { cmd: 'fdisk /dev/nvme0n1', tGameMs: 500, tUnixMs: 500, hash: 'forged' },
    ]);

    const result = validateReplay(session, replay, session.startTimeMs + 500);

    expect(result.accepted).toBe(false);
    expect(result.issue?.code).toBe('HASH_CHAIN_BROKEN');
  });
});