import {
  IExecutionEngine,
  SystemState,
  ExecutionResult,
  InstallStage,
  Partition,
  DEFAULT_SYSTEM_STATE,
} from '../../shared/types';

export type DifficultyMode = 'beginner' | 'experienced' | 'expert' | 'god';

// Симуляторный движок Arch Trainer
export class SimulatorEngine implements IExecutionEngine {
  public readonly mode = 'simulator' as const;
  private state: SystemState;
  private readonly difficulty: DifficultyMode;

  constructor(difficulty: DifficultyMode = 'beginner') {
    this.difficulty = difficulty;
    this.state = { ...DEFAULT_SYSTEM_STATE };
  }

  async execute(command: string): Promise<ExecutionResult> {
    const [cmd, ...args] = command.trim().split(/\s+/);
    let result: ExecutionResult;
    switch (cmd) {
      case 'lsblk':
        result = this.handleLsblk(); break;
      case 'fdisk':
      case 'cfdisk':
        result = this.handlePartition(cmd, args); break;
      case 'mkfs.ext4':
      case 'mkfs.fat':
      case 'mkswap':
        result = this.handleFormat(cmd, args); break;
      case 'swapon':
        result = this.handleSwapon(args); break;
      case 'mount':
        result = this.handleMount(args); break;
      case 'pacstrap':
        result = this.handlePacstrap(args); break;
      case 'genfstab':
        result = this.handleGenfstab(args); break;
      case 'arch-chroot':
        result = this.handleChroot(args); break;
      case 'passwd':
        result = this.handlePasswd(args); break;
      case 'useradd':
        result = this.handleUseradd(args); break;
      case 'hostnamectl':
        result = this.handleHostnamectl(args); break;
      case 'timedatectl':
        result = this.handleTimedatectl(args); break;
      case 'grub-install':
      case 'grub-mkconfig':
        result = this.handleGrub(cmd, args); break;
      case 'bootctl':
        result = this.handleBootctl(args); break;
      case 'mkinitcpio':
        result = this.handleMkinitcpio(args); break;
      case 'exit':
        result = this.handleExit(); break;
      default:
        result = {
          stdout: '',
          stderr: `bash: ${cmd}: command not found`,
          exitCode: 127,
          stateChanges: {},
          durationMs: 10,
        };
    }
    this.setState(result.stateChanges);
    return result;
  }

  getState(): SystemState {
    return { ...this.state };
  }

  setState(state: Partial<SystemState>): void {
    this.state = { ...this.state, ...state };
  }

  reset(): void {
    this.state = { ...DEFAULT_SYSTEM_STATE };
  }

  supportsCommand(command: string): boolean {
    const supported = [
      'lsblk', 'fdisk', 'cfdisk', 'mkfs.ext4', 'mkfs.fat', 'mkswap', 'swapon',
      'mount', 'pacstrap', 'genfstab', 'arch-chroot', 'passwd', 'useradd',
      'hostnamectl', 'timedatectl', 'grub-install', 'grub-mkconfig', 'bootctl',
      'mkinitcpio', 'exit',
    ];
    return supported.includes(command.split(' ')[0]);
  }

  getCurrentStage(): InstallStage {
    return this.state.currentStage;
  }

  advanceStage(result: 'success' | 'failure'): void {
    if (result !== 'success') {
      return;
    }

    const stages: InstallStage[] = [
      'BOOT_LIVE',
      'PARTITIONING',
      'FORMATTING',
      'MOUNTING',
      'PACSTRAP',
      'CHROOT',
      'BOOTLOADER',
      'COMPLETE',
    ];
    const currentIndex = stages.indexOf(this.state.currentStage);
    if (currentIndex >= 0 && currentIndex < stages.length - 1) {
      this.state = {
        ...this.state,
        currentStage: stages[currentIndex + 1],
      };
    }
  }

  // --- Command Handlers ---
  private handleLsblk(): ExecutionResult {
    const devices = ['sda', 'sdb', 'nvme0n1'];
    const lines = devices.map((dev) => `${dev}    8:0    0   20G  0 disk`);
    return {
      stdout: `NAME   MAJ:MIN RM  SIZE RO TYPE\n${lines.join('\n')}`,
      stderr: '',
      exitCode: 0,
      stateChanges: {},
      durationMs: 15,
    };
  }

  private handlePartition(cmd: string, args: string[]): ExecutionResult {
    // Упрощённая логика: всегда создаёт раздел sda1
    const newPartition: Partition = {
      device: 'sda1',
      size: 20480,
      type: 'primary',
      fsType: null,
    };
    return {
      stdout: `${cmd}: partition created: /dev/sda1`,
      stderr: '',
      exitCode: 0,
      stateChanges: { partitions: [...this.state.partitions, newPartition] },
      durationMs: 100,
    };
  }

  private handleFormat(cmd: string, args: string[]): ExecutionResult {
    // Применяет fsType к первому разделу без fsType
    const fsType = cmd === 'mkfs.ext4' ? 'ext4' : cmd === 'mkfs.fat' ? 'vfat' : 'swap';
    const idx = this.state.partitions.findIndex((p) => !p.fsType);
    if (idx === -1) {
      return {
        stdout: '',
        stderr: 'No unformatted partition found',
        exitCode: 1,
        stateChanges: {},
        durationMs: 20,
      };
    }
    const updated = [...this.state.partitions];
    updated[idx] = { ...updated[idx], fsType };
    return {
      stdout: `${cmd}: formatted /dev/${updated[idx].device} as ${fsType}`,
      stderr: '',
      exitCode: 0,
      stateChanges: { partitions: updated },
      durationMs: 50,
    };
  }

  private handleSwapon(args: string[]): ExecutionResult {
    // Просто успех
    return {
      stdout: 'swapon: enabled swap',
      stderr: '',
      exitCode: 0,
      stateChanges: {},
      durationMs: 10,
    };
  }

  private handleMount(args: string[]): ExecutionResult {
    // mount /dev/sda1 /mnt
    const [dev, mountpoint] = args;
    if (!dev || !mountpoint) {
      return {
        stdout: '',
        stderr: 'mount: missing operand',
        exitCode: 1,
        stateChanges: {},
        durationMs: 10,
      };
    }
    return {
      stdout: `mounted ${dev} to ${mountpoint}`,
      stderr: '',
      exitCode: 0,
      stateChanges: { mounts: { ...this.state.mounts, [mountpoint]: dev } },
      durationMs: 20,
    };
  }

  private handlePacstrap(args: string[]): ExecutionResult {
    // pacstrap /mnt base linux linux-firmware
    if (!this.state.mounts['/mnt']) {
      return {
        stdout: '',
        stderr: 'pacstrap: /mnt not mounted',
        exitCode: 1,
        stateChanges: {},
        durationMs: 10,
      };
    }
    const pkgs = args.slice(1);
    return {
      stdout: `installed: ${pkgs.join(', ')}`,
      stderr: '',
      exitCode: 0,
      stateChanges: { installedPackages: [...this.state.installedPackages, ...pkgs] },
      durationMs: 200,
    };
  }

  private handleGenfstab(args: string[]): ExecutionResult {
    return {
      stdout: 'genfstab: /etc/fstab generated',
      stderr: '',
      exitCode: 0,
      stateChanges: {},
      durationMs: 15,
    };
  }

  private handleChroot(args: string[]): ExecutionResult {
    return {
      stdout: 'arch-chroot: switched root',
      stderr: '',
      exitCode: 0,
      stateChanges: { currentStage: 'CHROOT' },
      durationMs: 10,
    };
  }

  private handlePasswd(args: string[]): ExecutionResult {
    return {
      stdout: 'Password set for root',
      stderr: '',
      exitCode: 0,
      stateChanges: { rootPassword: true },
      durationMs: 10,
    };
  }

  private handleUseradd(args: string[]): ExecutionResult {
    const user = args[0] || 'user';
    return {
      stdout: `User ${user} added`,
      stderr: '',
      exitCode: 0,
      stateChanges: { users: [...this.state.users, user] },
      durationMs: 10,
    };
  }

  private handleHostnamectl(args: string[]): ExecutionResult {
    const hostname = args[1] || 'archlinux';
    return {
      stdout: `Hostname set to ${hostname}`,
      stderr: '',
      exitCode: 0,
      stateChanges: { hostname },
      durationMs: 10,
    };
  }

  private handleTimedatectl(args: string[]): ExecutionResult {
    const timezone = args[1] || 'UTC';
    return {
      stdout: `Timezone set to ${timezone}`,
      stderr: '',
      exitCode: 0,
      stateChanges: { timezone },
      durationMs: 10,
    };
  }

  private handleGrub(cmd: string, args: string[]): ExecutionResult {
    return {
      stdout: `${cmd}: bootloader installed`,
      stderr: '',
      exitCode: 0,
      stateChanges: { bootloader: 'grub' },
      durationMs: 30,
    };
  }

  private handleBootctl(args: string[]): ExecutionResult {
    return {
      stdout: 'bootctl: systemd-boot installed',
      stderr: '',
      exitCode: 0,
      stateChanges: { bootloader: 'systemd-boot' },
      durationMs: 30,
    };
  }

  private handleMkinitcpio(args: string[]): ExecutionResult {
    return {
      stdout: 'mkinitcpio: initramfs generated',
      stderr: '',
      exitCode: 0,
      stateChanges: {},
      durationMs: 20,
    };
  }

  private handleExit(): ExecutionResult {
    return {
      stdout: 'Session ended',
      stderr: '',
      exitCode: 0,
      stateChanges: { currentStage: 'COMPLETE' },
      durationMs: 5,
    };
  }
}
