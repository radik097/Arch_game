// Arch Trainer — IExecutionEngine and types

export type InstallStage =
  | 'BOOT_LIVE'
  | 'PARTITIONING'
  | 'FORMATTING'
  | 'MOUNTING'
  | 'PACSTRAP'
  | 'CHROOT'
  | 'BOOTLOADER'
  | 'COMPLETE';

export interface Partition {
  device: string;
  size: number;
  type: 'primary' | 'extended' | 'logical' | 'efi' | 'swap';
  fsType: string | null;
}

export interface SystemState {
  bootDevice: string | null;
  partitions: Partition[];
  mounts: Record<string, string>;
  installedPackages: string[];
  networkAvailable: boolean;
  currentStage: InstallStage;
  hostname: string | null;
  locale: string | null;
  timezone: string | null;
  rootPassword: boolean;
  users: string[];
  bootloader: 'grub' | 'systemd-boot' | null;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  stateChanges: Partial<SystemState>;
  durationMs: number;
}

export interface IExecutionEngine {
  execute(command: string): Promise<ExecutionResult>;
  getState(): SystemState;
  setState(state: Partial<SystemState>): void;
  reset(): void;
  supportsCommand(command: string): boolean;
  readonly mode: 'simulator' | 'vm';
}

export const DEFAULT_SYSTEM_STATE: SystemState = {
  bootDevice: null,
  partitions: [],
  mounts: {},
  installedPackages: [],
  networkAvailable: false,
  currentStage: 'BOOT_LIVE',
  hostname: null,
  locale: null,
  timezone: null,
  rootPassword: false,
  users: [],
  bootloader: null,
};
