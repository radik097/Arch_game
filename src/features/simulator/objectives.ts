import type { GameState, Objective, ObjectiveId } from './types';

const objectiveMeta: Record<ObjectiveId, { title: string; detail: string }> = {
  inspect: {
    title: 'Inspect the machine',
    detail: 'Identify the correct install target from the generated hardware, devices, and pseudo-filesystem views.',
  },
  network: {
    title: 'Bring networking online',
    detail: 'Repair link state, drivers, or mirrors before package installation can begin.',
  },
  partition: {
    title: 'Partition the target disk',
    detail: 'Choose the real install disk and create an EFI and root partition layout.',
  },
  format: {
    title: 'Format the partitions',
    detail: 'Prepare the EFI partition as FAT32 and the root partition as ext4.',
  },
  mount: {
    title: 'Mount the target system',
    detail: 'Mount the root partition to /mnt and the EFI partition to /mnt/boot.',
  },
  install: {
    title: 'Install the base system',
    detail: 'pacstrap must succeed against a live network path and the mounted target.',
  },
  fstab: {
    title: 'Generate fstab and chroot',
    detail: 'Persist mounts with genfstab and enter the installed system with arch-chroot.',
  },
  configure: {
    title: 'Configure the installed system',
    detail: 'Set timezone, sync clock, generate locales, set hostname, and set root password.',
  },
  bootloader: {
    title: 'Install boot support',
    detail: 'Enable networking and install GRUB before leaving the live ISO.',
  },
  reboot: {
    title: 'Shutdown the installer',
    detail: 'Exit chroot, unmount the target filesystem, and reboot into the installed system.',
  },
};

export function deriveCurrentObjective(state: GameState): ObjectiveId {
  if (state.disks.length > 1 && state.install.selectedDisk === null) {
    return 'inspect';
  }

  if (!isNetworkReady(state)) {
    return 'network';
  }

  const targetDisk = state.disks.find((disk) => disk.device === state.installTargetDisk);
  if (!targetDisk || targetDisk.partitions.length < 2) {
    return 'partition';
  }

  const efiPartition = targetDisk.partitions.find((partition) => partition.role === 'efi');
  const rootPartition = targetDisk.partitions.find((partition) => partition.role === 'root');
  if (!efiPartition || !rootPartition || efiPartition.filesystem !== 'fat32' || rootPartition.filesystem !== 'ext4') {
    return 'format';
  }

  if (!state.install.rootMounted || !state.install.bootMounted) {
    return 'mount';
  }

  if (!state.install.packagesInstalled) {
    return 'install';
  }

  if (!state.install.fstabGenerated || !state.install.inChroot) {
    return 'fstab';
  }

  if (
    !state.install.timezoneSet ||
    !state.install.clockSynced ||
    !state.install.localeGenerated ||
    !state.install.hostnameSet ||
    !state.install.passwdSet
  ) {
    return 'configure';
  }

  if (!state.install.networkManagerEnabled || !state.install.grubInstalled || !state.install.grubConfigGenerated) {
    return 'bootloader';
  }

  return 'reboot';
}

export function deriveObjectives(state: GameState): Objective[] {
  const currentObjective = deriveCurrentObjective(state);

  return (Object.keys(objectiveMeta) as ObjectiveId[]).map((id) => ({
    id,
    title: objectiveMeta[id].title,
    detail: objectiveMeta[id].detail,
    completed: objectiveRank(id) < objectiveRank(currentObjective) || (state.completed && id === 'reboot'),
  }));
}

export function isNetworkReady(state: GameState): boolean {
  const linkOnline = state.networkInterfaces.some((networkInterface) => networkInterface.connected);
  const blockingEvent = state.events.some((event) => event.active && !event.resolved && (event.id === 'wifi_driver_missing' || event.id === 'network_drop'));
  return linkOnline && !blockingEvent;
}

function objectiveRank(id: ObjectiveId): number {
  return ['inspect', 'network', 'partition', 'format', 'mount', 'install', 'fstab', 'configure', 'bootloader', 'reboot'].indexOf(id);
}