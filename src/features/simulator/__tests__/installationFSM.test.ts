import { describe, it, expect, beforeEach } from 'vitest';
import { InstallationFSM, TRANSITIONS } from '../installationFSM';
import { DEFAULT_SYSTEM_STATE, SystemState, InstallStage } from '../../../shared/types';

describe('InstallationFSM', () => {
  let state: SystemState;
  let fsm: InstallationFSM;

  beforeEach(() => {
    state = { ...DEFAULT_SYSTEM_STATE };
    fsm = new InstallationFSM(state);
  });

  it('allows transition BOOT_LIVE → PARTITIONING', () => {
    expect(fsm.canTransition('PARTITIONING')).toBe(true);
    const res = fsm.transition('PARTITIONING');
    expect(res.success).toBe(true);
  });

  it('blocks PARTITIONING → FORMATTING if no partitions', () => {
    fsm.transition('PARTITIONING');
    expect(fsm.canTransition('FORMATTING')).toBe(false);
    const res = fsm.transition('FORMATTING');
    expect(res.success).toBe(false);
  });

  it('allows PARTITIONING → FORMATTING if partition exists', () => {
    fsm.transition('PARTITIONING');
    state.partitions.push({ device: 'sda1', size: 10240, type: 'primary', fsType: null });
    fsm = new InstallationFSM(state);
    fsm.transition('PARTITIONING');
    expect(fsm.canTransition('FORMATTING')).toBe(true);
  });

  it('blocks FORMATTING → MOUNTING if not all partitions formatted', () => {
    fsm.transition('PARTITIONING');
    state.partitions.push({ device: 'sda1', size: 10240, type: 'primary', fsType: null });
    fsm = new InstallationFSM(state);
    fsm.transition('PARTITIONING');
    fsm.transition('FORMATTING');
    expect(fsm.canTransition('MOUNTING')).toBe(false);
  });

  it('allows FORMATTING → MOUNTING if all partitions formatted', () => {
    fsm.transition('PARTITIONING');
    state.partitions.push({ device: 'sda1', size: 10240, type: 'primary', fsType: 'ext4' });
    fsm = new InstallationFSM(state);
    fsm.transition('PARTITIONING');
    fsm.transition('FORMATTING');
    expect(fsm.canTransition('MOUNTING')).toBe(true);
  });

  it('getAvailableTransitions returns only allowed', () => {
    expect(fsm.getAvailableTransitions()).toContain('PARTITIONING');
  });

  it('getBlockedTransitions returns correct reason', () => {
    fsm.transition('PARTITIONING');
    const blocked = fsm.getBlockedTransitions();
    expect(blocked.some((b) => b.stage === 'FORMATTING')).toBe(true);
    expect(blocked[0].reason).toMatch(/раздел/);
  });

  it('subscribe notifies on transition', () => {
    let called = false;
    fsm.subscribe((stage) => {
      if (stage === 'PARTITIONING') called = true;
    });
    fsm.transition('PARTITIONING');
    expect(called).toBe(true);
  });
});
