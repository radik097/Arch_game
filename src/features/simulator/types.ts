export type Difficulty = 'beginner' | 'experienced' | 'expert' | 'god';

export type ObjectiveId =
  | 'inspect'
  | 'network'
  | 'partition'
  | 'format'
  | 'mount'
  | 'install'
  | 'fstab'
  | 'configure'
  | 'bootloader'
  | 'reboot';

export interface TeachingNote {
  title: string;
  ru: string;
  en: string;
}

export interface TerminalLine {
  id: string;
  kind: 'system' | 'command' | 'output' | 'success' | 'error' | 'info';
  text: string;
}

export interface Objective {
  id: ObjectiveId;
  title: string;
  detail: string;
  completed: boolean;
}

export type DiskBus = 'nvme' | 'sata' | 'usb';

export interface PartitionState {
  name: string;
  size: string;
  role: 'efi' | 'root' | 'data';
  filesystem: 'fat32' | 'ext4' | null;
}

export interface DiskState {
  device: string;
  size: string;
  bus: DiskBus;
  removable: boolean;
  partitions: PartitionState[];
}

export interface NetworkInterfaceState {
  name: string;
  kind: 'ethernet' | 'wifi' | 'usb';
  up: boolean;
  connected: boolean;
  driverReady: boolean;
}

export interface HardwareProfile {
  cpuArch: 'x86_64';
  cpuModel: string;
  cpuCores: number;
  ramGiB: number;
}

export type SystemEventId = 'wifi_driver_missing' | 'mirror_timeout' | 'network_drop';

export interface SystemEventState {
  id: SystemEventId;
  active: boolean;
  resolved: boolean;
  injectedAtCommand: number | null;
}

export interface InstallState {
  selectedDisk: string | null;
  rootMounted: boolean;
  bootMounted: boolean;
  packagesUpdated: boolean;
  packagesInstalled: boolean;
  fstabGenerated: boolean;
  inChroot: boolean;
  timezoneSet: boolean;
  clockSynced: boolean;
  localeGenerated: boolean;
  hostnameSet: boolean;
  passwdSet: boolean;
  networkManagerEnabled: boolean;
  grubInstalled: boolean;
  grubConfigGenerated: boolean;
  unmounted: boolean;
  rebooted: boolean;
}

export interface RuntimeContext {
  commandCount: number;
  eventLog: string[];
  mode: 'server' | 'browser';
  browserProfile: string | null;
  currentDirectory: string;
  fdiskSession: {
    active: boolean;
    device: string | null;
    hasGpt: boolean;
    draftPartitions: PartitionState[];
  };
}

export interface PseudoFilesystemState {
  procCpuInfo: string;
  procMemInfo: string;
  sysClassNet: string[];
  devNodes: string[];
}

export interface GameState {
  difficulty: Difficulty;
  seed: string;
  profile: string;
  history: TerminalLine[];
  hardware: HardwareProfile;
  disks: DiskState[];
  installTargetDisk: string;
  networkInterfaces: NetworkInterfaceState[];
  events: SystemEventState[];
  pseudoFs: PseudoFilesystemState;
  install: InstallState;
  startedAt: number;
  attempt: number;
  currentObjective: ObjectiveId;
  completed: boolean;
  lastTeachingNote: TeachingNote | null;
  lastEvent: string | null;
  runtime: RuntimeContext;
}