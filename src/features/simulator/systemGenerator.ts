import type { Difficulty, DiskState, HardwareProfile, NetworkInterfaceState, PseudoFilesystemState, SystemEventState } from './types';

export interface GeneratedSystem {
  hardware: HardwareProfile;
  disks: DiskState[];
  installTargetDisk: string;
  networkInterfaces: NetworkInterfaceState[];
  events: SystemEventState[];
  pseudoFs: PseudoFilesystemState;
}

export function generateSystem(seed: string, difficulty: Difficulty): GeneratedSystem {
  const random = createSeededRandom(seed);
  const primaryBus = random() > 0.5 ? 'nvme' : 'sata';
  const primaryDisk = createDisk(primaryBus, random, false, true);
  const disks: DiskState[] = [primaryDisk];

  if (difficulty !== 'beginner') {
    disks.push(createDisk('usb', random, true, false));
  }

  if (difficulty === 'expert' || difficulty === 'god') {
    disks.push(createDisk(primaryBus === 'nvme' ? 'sata' : 'nvme', random, false, false));
  }

  const cpuCores = 2 + Math.floor(random() * 14);
  const ramGiB = 4 + Math.floor(random() * 29);
  const hardware: HardwareProfile = {
    cpuArch: 'x86_64',
    cpuModel: ['Ryzen Virtual CPU', 'Intel Core Virtual CPU', 'QEMU Virtual CPU'][Math.floor(random() * 3)] ?? 'Virtual CPU',
    cpuCores,
    ramGiB,
  };

  const networkInterfaces: NetworkInterfaceState[] = [
    {
      name: 'eth0',
      kind: 'ethernet',
      up: true,
      connected: difficulty === 'beginner' || difficulty === 'experienced',
      driverReady: true,
    },
  ];

  if (difficulty === 'expert' || difficulty === 'god') {
    networkInterfaces.push({
      name: 'wlan0',
      kind: 'wifi',
      up: false,
      connected: false,
      driverReady: difficulty !== 'god',
    });
  }

  const events = generateEvents(seed, difficulty);
  if (events.some((event) => event.id === 'wifi_driver_missing' && event.active)) {
    const wifi = networkInterfaces.find((networkInterface) => networkInterface.kind === 'wifi');
    if (wifi) {
      wifi.driverReady = false;
    }
  }

  const pseudoFs = buildPseudoFilesystem(hardware, disks, networkInterfaces);

  return {
    hardware,
    disks,
    installTargetDisk: primaryDisk.device,
    networkInterfaces,
    events,
    pseudoFs,
  };
}

function createDisk(bus: 'nvme' | 'sata' | 'usb', random: () => number, removable: boolean, preferredTarget: boolean): DiskState {
  const size = bus === 'usb' ? ['16G', '32G', '64G'][Math.floor(random() * 3)] ?? '32G' : ['128G', '256G', '512G', '1T'][Math.floor(random() * 4)] ?? '256G';
  const device = bus === 'nvme' ? `/dev/nvme${Math.floor(random() * 2)}n1` : bus === 'sata' ? `/dev/sda` : `/dev/sdb`;

  return {
    device: preferredTarget ? device : uniqueDeviceName(device, random),
    size,
    bus,
    removable,
    partitions: [],
  };
}

function generateEvents(seed: string, difficulty: Difficulty): SystemEventState[] {
  const random = createSeededRandom(`${seed}:${difficulty}:events`);
  const events: SystemEventState[] = [];

  if (difficulty === 'expert' || difficulty === 'god') {
    events.push({
      id: random() > 0.5 ? 'mirror_timeout' : 'network_drop',
      active: true,
      resolved: false,
      injectedAtCommand: null,
    });
  }

  if (difficulty === 'god') {
    events.push({
      id: 'wifi_driver_missing',
      active: true,
      resolved: false,
      injectedAtCommand: null,
    });
  }

  return events;
}

function buildPseudoFilesystem(
  hardware: HardwareProfile,
  disks: DiskState[],
  networkInterfaces: NetworkInterfaceState[],
): PseudoFilesystemState {
  const procCpuInfo = Array.from({ length: hardware.cpuCores }, (_, index) => {
    return `processor\t: ${index}\nmodel name\t: ${hardware.cpuModel}\ncpu cores\t: ${hardware.cpuCores}`;
  }).join('\n\n');

  const totalMemKb = hardware.ramGiB * 1024 * 1024;
  const procMemInfo = `MemTotal:\t${totalMemKb} kB\nMemFree:\t${Math.floor(totalMemKb * 0.42)} kB\nMemAvailable:\t${Math.floor(totalMemKb * 0.71)} kB`;

  return {
    procCpuInfo,
    procMemInfo,
    sysClassNet: networkInterfaces.map((networkInterface) => networkInterface.name),
    devNodes: [...disks.map((disk) => disk.device), ...networkInterfaces.map((networkInterface) => `/sys/class/net/${networkInterface.name}`)],
  };
}

function uniqueDeviceName(baseDevice: string, random: () => number): string {
  if (baseDevice.startsWith('/dev/sd')) {
    const suffix = ['a', 'b', 'c'][1 + Math.floor(random() * 2)] ?? 'b';
    return `/dev/sd${suffix}`;
  }

  return `/dev/nvme${1 + Math.floor(random() * 2)}n1`;
}

function createSeededRandom(seed: string): () => number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}