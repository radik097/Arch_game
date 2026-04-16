import { InstallStage, SystemState } from '../../shared/types';

export const installStages: InstallStage[] = [
  'BOOT_LIVE',
  'PARTITIONING',
  'FORMATTING',
  'MOUNTING',
  'PACSTRAP',
  'CHROOT',
  'BOOTLOADER',
  'COMPLETE',
];

export interface Transition {
  from: InstallStage;
  to: InstallStage;
  guard: (state: SystemState) => boolean;
  action?: (state: SystemState) => SystemState;
  description: { ru: string; en: string };
}

export const TRANSITIONS: Transition[] = [
  {
    from: 'BOOT_LIVE',
    to: 'PARTITIONING',
    guard: (s) => true,
    description: {
      ru: 'Начать разметку диска',
      en: 'Start disk partitioning',
    },
  },
  {
    from: 'PARTITIONING',
    to: 'FORMATTING',
    guard: (s) => s.partitions.length > 0,
    description: {
      ru: 'Есть хотя бы один раздел',
      en: 'At least one partition exists',
    },
  },
  {
    from: 'FORMATTING',
    to: 'MOUNTING',
    guard: (s) => s.partitions.every((p) => p.fsType !== null),
    description: {
      ru: 'Все разделы отформатированы',
      en: 'All partitions are formatted',
    },
  },
  {
    from: 'MOUNTING',
    to: 'PACSTRAP',
    guard: (s) => Boolean(s.mounts['/mnt']),
    description: {
      ru: 'Корневая файловая система смонтирована',
      en: 'Root filesystem is mounted',
    },
  },
  {
    from: 'PACSTRAP',
    to: 'CHROOT',
    guard: (s) => s.installedPackages.includes('base'),
    description: {
      ru: 'Пакет base установлен',
      en: 'Base package is installed',
    },
  },
  {
    from: 'CHROOT',
    to: 'BOOTLOADER',
    guard: (s) => s.hostname !== null && s.locale !== null,
    description: {
      ru: 'Заданы hostname и locale',
      en: 'Hostname and locale are set',
    },
  },
  {
    from: 'BOOTLOADER',
    to: 'COMPLETE',
    guard: (s) => s.bootloader !== null,
    description: {
      ru: 'Загрузчик установлен',
      en: 'Bootloader is installed',
    },
  },
];

export class InstallationFSM {
  private state: SystemState;
  private listeners: ((stage: InstallStage) => void)[] = [];

  constructor(initialState: SystemState) {
    this.state = { ...initialState };
  }

  canTransition(to: InstallStage): boolean {
    const current = this.state.currentStage;
    const t = TRANSITIONS.find((tr) => tr.from === current && tr.to === to);
    return !!t && t.guard(this.state);
  }

  transition(to: InstallStage): { success: boolean; reason?: string } {
    const current = this.state.currentStage;
    const t = TRANSITIONS.find((tr) => tr.from === current && tr.to === to);
    if (!t) return { success: false, reason: 'No such transition' };
    if (!t.guard(this.state)) return { success: false, reason: t.description.ru + ' / ' + t.description.en };
    this.state.currentStage = to;
    if (t.action) this.state = t.action(this.state);
    this.listeners.forEach((fn) => fn(to));
    return { success: true };
  }

  getAvailableTransitions(): InstallStage[] {
    const current = this.state.currentStage;
    return TRANSITIONS.filter((t) => t.from === current && t.guard(this.state)).map((t) => t.to);
  }

  getBlockedTransitions(): { stage: InstallStage; reason: string }[] {
    const current = this.state.currentStage;
    return TRANSITIONS.filter((t) => t.from === current && !t.guard(this.state)).map((t) => ({
      stage: t.to,
      reason: t.description.ru + ' / ' + t.description.en,
    }));
  }

  subscribe(listener: (stage: InstallStage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== listener);
    };
  }
}
