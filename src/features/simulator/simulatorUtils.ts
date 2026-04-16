import { deriveCurrentObjective } from './objectives';
import type {
  Difficulty,
  DiskState,
  DiskBus,
  GameState,
  PartitionState,
  TeachingNote,
  TerminalLine,
  SystemEventState,
} from './types';

// --- ELEMENT CREATION ---

export function createLine(kind: TerminalLine['kind'], text: string): TerminalLine {
  return {
    id: `${kind}-${Math.random().toString(36).slice(2, 10)}`,
    kind,
    text,
  };
}

export function createWelcomeLines(difficulty: Difficulty, targetDisk: string, disks: DiskState[]): TerminalLine[] {
  const lines = [
    createLine('system', 'Arch Trainer simulator initialized.'),
    createLine('system', 'Target profile: Linux install trainer with generated hardware and seed-locked events.'),
    createLine('system', `Detected ${disks.length} disk device(s). Inspect carefully before partitioning.`),
  ];

  if (difficulty !== 'beginner') {
    lines.push(createLine('system', `Seeded install target exists on ${targetDisk}, but the shell will not tell you directly again.`));
  }

  if (difficulty === 'expert' || difficulty === 'god') {
    lines.push(createLine('system', 'Expert scenario active: recovery events may block networking or mirrors.'));
  }

  return lines;
}

// --- STATE MANAGEMENT ---

export function finalizeState(state: GameState, lines: TerminalLine[], teachingNote = state.lastTeachingNote): GameState {
  const nextState: GameState = {
    ...state,
    history: [...state.history, ...lines],
    lastTeachingNote: teachingNote,
  };

  nextState.currentObjective = deriveCurrentObjective(nextState);
  return nextState;
}

export function advanceState(state: GameState, lines: TerminalLine[], teachingNote: TeachingNote | null): GameState {
  return finalizeState(state, lines, teachingNote);
}

export function withCommandProgress(state: GameState): GameState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      commandCount: state.runtime.commandCount + 1,
    },
  };
}

export function failState(state: GameState, commandLine: TerminalLine, message: string): GameState {
  return withCommandProgress(finalizeState(state, [commandLine, createLine('error', message)]));
}

// --- PATH RESOLUTION ---

export function resolvePath(state: GameState, rawPath: string): string {
  if (rawPath === '~') {
    return '/root';
  }

  const base = rawPath.startsWith('/') ? rawPath : `${state.runtime.currentDirectory}/${rawPath}`;
  const segments = base.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return `/${stack.join('/')}` || '/';
}

export function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '/';
}

// --- VIRTUAL FILESYSTEM ---

export function buildVirtualFs(state: GameState) {
  const directories = new Set<string>([
    '/', '/root', '/boot', '/dev', '/etc', '/etc/pacman.d', '/home', '/mnt', '/mnt/boot', '/mnt/etc', '/proc', '/proc/net', '/run', '/run/archiso', '/run/systemd', '/run/systemd/resolve', '/run/udev', '/sys', '/sys/class', '/sys/class/net', '/sys/firmware', '/sys/firmware/efi', '/usr', '/usr/share', '/usr/share/zoneinfo',
  ]);
  const files = new Map<string, string>();

  files.set('/proc/cpuinfo', state.pseudoFs.procCpuInfo);
  files.set('/proc/meminfo', state.pseudoFs.procMemInfo);
  files.set('/proc/net/dev', buildProcNetDev(state));
  files.set('/proc/net/route', buildProcNetRoute(state));
  files.set('/sys/firmware/efi/fw_platform_size', '64');
  files.set('/etc/locale.gen', '#en_US.UTF-8 UTF-8\n#ru_RU.UTF-8 UTF-8');
  files.set('/etc/hostname', state.install.hostnameSet ? 'archbox' : 'archiso');
  files.set('/etc/fstab', '# /etc/fstab\n# live environment');
  files.set('/etc/hosts', buildEtcHosts(state));
  files.set('/etc/resolv.conf', buildResolvConf(state));
  files.set('/etc/pacman.d/mirrorlist', buildMirrorList(state));
  files.set('/run/archiso/bootmnt', '/run/archiso/bootmnt');
  files.set('/run/archiso/airootfs', 'overlayfs');
  files.set('/run/systemd/resolve/stub-resolv.conf', buildResolvConf(state));
  files.set('/run/udev/data/version', 'arch-trainer-udev');

  if (state.install.fstabGenerated) {
    const fstabContent = `# /etc/fstab\nUUID=${state.seed.slice(0, 8)} / ext4 defaults 0 1`;
    files.set('/mnt/etc/fstab', fstabContent);
    if (state.install.inChroot) {
      files.set('/etc/fstab', fstabContent);
    }
  }

  for (const disk of state.disks) {
    files.set(disk.device, 'block-device');
    for (const partition of disk.partitions) {
      files.set(partition.name, 'block-partition');
    }
  }

  for (const networkInterface of state.networkInterfaces) {
    directories.add(`/sys/class/net/${networkInterface.name}`);
    files.set(`/sys/class/net/${networkInterface.name}/operstate`, networkInterface.connected ? 'up' : networkInterface.up ? 'dormant' : 'down');
    files.set(`/sys/class/net/${networkInterface.name}/carrier`, networkInterface.connected || networkInterface.up ? '1' : '0');
    files.set(`/sys/class/net/${networkInterface.name}/address`, buildMacAddress(state.seed, networkInterface.name));
    files.set(`/sys/class/net/${networkInterface.name}/mtu`, '1500');
    files.set(`/sys/class/net/${networkInterface.name}/type`, networkInterface.kind === 'ethernet' ? '1' : '801');
  }

  return { directories, files };
}

export function listDirectoryEntries(virtualFs: ReturnType<typeof buildVirtualFs>, directory: string): string[] {
  const entries = new Set<string>();
  const prefix = directory === '/' ? '/' : `${directory}/`;
  for (const dir of virtualFs.directories) {
    if (dir === directory || !dir.startsWith(prefix)) {
      continue;
    }
    const rest = dir.slice(prefix.length);
    const name = rest.split('/')[0];
    if (name) {
      entries.add(name);
    }
  }
  for (const file of virtualFs.files.keys()) {
    if (!file.startsWith(prefix)) {
      continue;
    }
    const rest = file.slice(prefix.length);
    const name = rest.split('/')[0];
    if (name) {
      entries.add(name);
    }
  }
  return Array.from(entries).sort();
}

export function findEntries(virtualFs: ReturnType<typeof buildVirtualFs>, basePath: string, nameFilter?: string): string[] {
  const matcher = nameFilter?.replace(/\*/g, '') ?? null;
  const results = new Set<string>();
  const prefix = basePath === '/' ? '/' : `${basePath}/`;

  for (const dir of virtualFs.directories) {
    if (dir === basePath || dir.startsWith(prefix)) {
      if (!matcher || basename(dir).includes(matcher)) {
        results.add(dir);
      }
    }
  }
  for (const file of virtualFs.files.keys()) {
    if (file === basePath || file.startsWith(prefix)) {
      if (!matcher || basename(file).includes(matcher)) {
        results.add(file);
      }
    }
  }
  return Array.from(results).sort();
}

// --- NETWORK HELPERS ---

export function buildEtcHosts(state: GameState): string {
  const hostname = state.install.hostnameSet ? 'archbox' : 'archiso';
  return [
    '127.0.0.1\tlocalhost',
    '::1\t\tlocalhost',
    `127.0.1.1\t${hostname}.localdomain\t${hostname}`,
  ].join('\n');
}

export function buildResolvConf(state: GameState): string {
  const hasNetwork = state.networkInterfaces.some((networkInterface) => networkInterface.connected);
  return [
    '# Generated by systemd-resolved',
    'nameserver 127.0.0.53',
    `search ${hasNetwork ? 'archtrainer.lab' : '.'}`,
  ].join('\n');
}

export function buildMirrorList(state: GameState): string {
  const mirrorBroken = state.events.some((event) => event.id === 'mirror_timeout' && event.active && !event.resolved);
  return mirrorBroken
    ? '# reflector recommended\nServer = https://stale-mirror.invalid/$repo/os/$arch\nServer = https://backup-mirror.invalid/$repo/os/$arch'
    : '# reflector generated\nServer = https://mirror.rackspace.com/archlinux/$repo/os/$arch\nServer = https://geo.mirror.pkgbuild.com/$repo/os/$arch';
}

export function buildProcNetDev(state: GameState): string {
  const lines = [
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
  ];

  for (const networkInterface of state.networkInterfaces) {
    const rxBytes = networkInterface.connected ? 18432 : networkInterface.up ? 512 : 0;
    const txBytes = networkInterface.connected ? 9024 : networkInterface.up ? 256 : 0;
    const rxPackets = networkInterface.connected ? 188 : networkInterface.up ? 6 : 0;
    const txPackets = networkInterface.connected ? 94 : networkInterface.up ? 3 : 0;
    lines.push(`${networkInterface.name.padStart(6, ' ')}:${String(rxBytes).padStart(8, ' ')}${String(rxPackets).padStart(9, ' ')}    0    0    0     0          0         0${String(txBytes).padStart(8, ' ')}${String(txPackets).padStart(9, ' ')}    0    0    0     0       0          0`);
  }

  return lines.join('\n');
}

export function buildProcNetRoute(state: GameState): string {
  const activeInterface = state.networkInterfaces.find((networkInterface) => networkInterface.connected || networkInterface.up);
  if (!activeInterface) {
    return 'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT';
  }

  return [
    'Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\t\tMTU\tWindow\tIRTT',
    `${activeInterface.name}\t00000000\t0101A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0`,
    `${activeInterface.name}\t0001A8C0\t00000000\t0001\t0\t0\t600\t00FFFFFF\t0\t0\t0`,
  ].join('\n');
}

export function buildMacAddress(seed: string, interfaceName: string): string {
  const source = `${seed}:${interfaceName}`;
  const octets = Array.from({ length: 6 }, (_, index) => {
    const charCode = source.charCodeAt(index % source.length);
    const value = (charCode + index * 37) & 0xff;
    return value.toString(16).padStart(2, '0');
  });
  octets[0] = '52';
  return octets.join(':');
}

export function renderIpLink(state: GameState): TerminalLine[] {
  return state.networkInterfaces.map((networkInterface, index) => {
    const flags = ['BROADCAST', 'MULTICAST'];
    if (networkInterface.up) {
      flags.push('UP');
    }
    if (networkInterface.connected) {
      flags.push('LOWER_UP');
    }

    return createLine(
      'output',
      `${index + 1}: ${networkInterface.name}: <${flags.join(',')}> mtu 1500 state ${networkInterface.connected ? 'UP' : 'DOWN'}`,
    );
  });
}

// --- DISK HELPERS ---

export function getInstallDisk(state: GameState): DiskState | null {
  return state.disks.find((disk) => disk.device === state.installTargetDisk) ?? null;
}

export function getPartitionByRole(state: GameState, role: PartitionState['role']): PartitionState | null {
  const disk = getInstallDisk(state);
  return disk?.partitions.find((partition) => partition.role === role) ?? null;
}

export function partitionName(device: string, partitionIndex: number): string {
  return device.includes('nvme') ? `${device}p${partitionIndex}` : `${device}${partitionIndex}`;
}

export function findPartition(state: GameState, device: string): PartitionState | null {
  for (const disk of state.disks) {
    const partition = disk.partitions.find((item) => item.name === device);
    if (partition) {
      return partition;
    }
  }
  return null;
}

export function renderLsblk(state: GameState): TerminalLine[] {
  const lines = [createLine('output', 'NAME        SIZE  TYPE RM MOUNTPOINTS')];

  for (const disk of state.disks) {
    lines.push(createLine('output', `${disk.device.replace('/dev/', '').padEnd(11)} ${disk.size.padEnd(5)} disk ${disk.removable ? '1' : '0'} `));
    for (const partition of disk.partitions) {
      const mountPoint = partition.role === 'root' && state.install.rootMounted ? '/mnt' : partition.role === 'efi' && state.install.bootMounted ? '/mnt/boot' : '';
      lines.push(
        createLine(
          'output',
          `${partition.name.replace('/dev/', '').padEnd(11)} ${partition.size.padEnd(5)} part 0 ${mountPoint}`,
        ),
      );
    }
  }

  return lines;
}

export function updatePartitionFilesystem(
  state: GameState,
  commandLine: TerminalLine,
  device: string,
  filesystem: PartitionState['filesystem'],
  successText: string,
): GameState {
  const nextDisks = state.disks.map((disk) => ({
    ...disk,
    partitions: disk.partitions.map((partition) =>
      partition.name === device
        ? { ...partition, filesystem }
        : partition,
    ),
  }));

  return advanceState(
    {
      ...state,
      disks: nextDisks,
      pseudoFs: rebuildPseudoFs(state, nextDisks),
      lastEvent: `${device} formatted as ${filesystem}.`,
    },
    [commandLine, createLine('success', successText), createLine('output', `${device}: formatted as ${filesystem}.`)],
    null,
  );
}

export function rebuildPseudoFs(state: GameState, disks: DiskState[]) {
  return {
    ...state.pseudoFs,
    devNodes: [...disks.map((disk) => disk.device), ...state.networkInterfaces.map((networkInterface) => `/sys/class/net/${networkInterface.name}`)],
  };
}

// --- INSTALL HELPERS ---

export function updateInstallFlag(
  state: GameState,
  commandLine: TerminalLine,
  key: keyof GameState['install'],
  message: string,
): GameState {
  return advanceState(
    {
      ...state,
      install: {
        ...state.install,
        [key]: true,
      },
      lastEvent: message,
    },
    [commandLine, createLine('success', message)],
    null,
  );
}

export function beginnerExplanation(state: GameState, text: string): TerminalLine[] {
  if (state.difficulty !== 'beginner') {
    return [];
  }
  return [createLine('info', `Explanation: ${text}`)];
}

export function describeActiveEvents(events: GameState['events']): string {
  return events
    .filter((event) => event.active)
    .map((event) => event.id)
    .join(', ');
}

export function markEventResolved(state: GameState, eventId: GameState['events'][number]['id']) {
  return state.events.map((event) =>
    event.id === eventId
      ? { ...event, active: false, resolved: true, injectedAtCommand: state.runtime.commandCount }
      : event,
  );
}

// --- UI / COMMAND HELPERS ---

export function getLastLineByKind(lines: TerminalLine[], kind: TerminalLine['kind']): TerminalLine | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.kind === kind) {
      return lines[index] ?? null;
    }
  }
  return null;
}

export function getCommandSuggestions(): string[] {
  return [
    'help', 'ls', 'lsblk', 'cd', 'cat', 'pwd', 'find', 'ping', 'ip', 'fdisk', 'mount', 'umount',
    'mkfs.ext4', 'mkfs.fat', 'pacstrap', 'pacman', 'genfstab', 'arch-chroot', 'modprobe', 'iwctl', 'passwd',
    'locale-gen', 'hwclock', 'systemctl', 'grub-install', 'grub-mkconfig', 'reflector', 'ln', 'echo',
    'reboot', 'exit', 'clear', 'start', 'sessionctl',
  ];
}

export function completePathToken(state: GameState, token: string): string[] {
  const virtualFs = buildVirtualFs(state);
  const absoluteToken = token.startsWith('/') ? token : resolvePath(state, token || '.');
  const parent = absoluteToken.endsWith('/') ? absoluteToken.slice(0, -1) || '/' : absoluteToken.slice(0, absoluteToken.lastIndexOf('/')) || '/';
  const partial = absoluteToken.endsWith('/') ? '' : basename(absoluteToken);
  return listDirectoryEntries(virtualFs, parent)
    .filter((entry) => entry.startsWith(partial))
    .map((entry) => {
      const fullPath = parent === '/' ? `/${entry}` : `${parent}/${entry}`;
      return virtualFs.directories.has(fullPath) ? `${fullPath}/` : fullPath;
    })
    .sort();
}

export function longestSharedPrefix(values: string[]): string {
  if (values.length === 0) {
    return '';
  }
  let prefix = values[0] ?? '';
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix) && prefix.length > 0) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

export function resolvePingTarget(target: string): { address: string; ttl: number; times: [string, string]; isIpAddress: boolean } | null {
  const targets: Record<string, { address: string; ttl: number; times: [string, string]; isIpAddress: boolean }> = {
    'archlinux.org': { address: '95.217.163.246', ttl: 51, times: ['31.2', '29.4'], isIpAddress: false },
    'google.com': { address: '142.250.74.14', ttl: 57, times: ['24.8', '22.9'], isIpAddress: false },
    'kernel.org': { address: '139.178.84.217', ttl: 52, times: ['41.3', '39.8'], isIpAddress: false },
    'gitlab.archlinux.org': { address: '95.217.163.246', ttl: 51, times: ['30.4', '28.7'], isIpAddress: false },
    '1.1.1.1': { address: '1.1.1.1', ttl: 57, times: ['18.7', '17.9'], isIpAddress: true },
    '8.8.8.8': { address: '8.8.8.8', ttl: 57, times: ['24.8', '22.9'], isIpAddress: true },
  };
  return targets[target] ?? null;
}

export function replaceDisk(disks: DiskState[], updatedDisk: DiskState): DiskState[] {
  return disks.map((disk) => (disk.device === updatedDisk.device ? updatedDisk : disk));
}

export function handleFdiskSessionCommand(state: GameState, commandLine: TerminalLine, input: string): GameState {
  const session = state.runtime.fdiskSession;
  const device = session.device;
  if (!device) {
    return failState(state, commandLine, 'fdisk: interactive session lost target device.');
  }

  const disk = state.disks.find((item) => item.device === device);
  if (!disk) {
    return failState(state, commandLine, `fdisk: cannot open ${device}: No such device`);
  }

  const withPrompt = (lines: TerminalLine[]): TerminalLine[] => [...lines, createLine('output', 'Command (m for help):')];

  if (input === 'm') {
    return finalizeState(state, withPrompt([
      commandLine,
      createLine('output', 'g   create a new empty GPT partition table'),
      createLine('output', 'n   add a new partition'),
      createLine('output', 't   change a partition type'),
      createLine('output', 'p   print the partition table'),
      createLine('output', 'w   write table to disk and exit'),
      createLine('output', 'q   quit without saving changes'),
    ]));
  }

  if (input === 'g') {
    return finalizeState(
      {
        ...state,
        runtime: {
          ...state.runtime,
          fdiskSession: {
            ...session,
            hasGpt: true,
            draftPartitions: [],
          },
        },
      },
      withPrompt([commandLine, createLine('success', 'Created a new GPT disklabel.')]),
    );
  }

  if (input === 'n') {
    if (!session.hasGpt) {
      return failState(state, commandLine, 'fdisk: create a GPT label first with g.');
    }

    if (session.draftPartitions.length >= 2) {
      return failState(state, commandLine, 'fdisk: simulator supports two install partitions in this scenario.');
    }

    const nextIndex = session.draftPartitions.length + 1;
    const nextPartition: PartitionState = {
      name: partitionName(device, nextIndex),
      size: nextIndex === 1 ? '512M' : disk.size,
      role: nextIndex === 1 ? 'efi' : 'root',
      filesystem: null,
    };

    return finalizeState(
      {
        ...state,
        runtime: {
          ...state.runtime,
          fdiskSession: {
            ...session,
            draftPartitions: [...session.draftPartitions, nextPartition],
          },
        },
      },
      withPrompt([commandLine, createLine('success', `Created partition ${nextPartition.name}.`)]),
    );
  }

  if (input === 't') {
    if (session.draftPartitions.length === 0) {
      return failState(state, commandLine, 'fdisk: add a partition first with n.');
    }

    const draft = [...session.draftPartitions];
    if (draft[0]) {
      draft[0] = {
        ...draft[0],
        role: 'efi',
      };
    }

    return finalizeState(
      {
        ...state,
        runtime: {
          ...state.runtime,
          fdiskSession: {
            ...session,
            draftPartitions: draft,
          },
        },
      },
      withPrompt([commandLine, createLine('output', 'Changed type of partition 1 to EFI System.')]),
    );
  }

  if (input === 'p') {
    const partitionLines = session.draftPartitions.length === 0
      ? [createLine('output', 'No partitions defined yet.')]
      : session.draftPartitions.map((partition, index) =>
        createLine('output', `${index + 1} ${partition.name} ${partition.size} ${partition.role}`),
      );

    return finalizeState(state, withPrompt([commandLine, ...partitionLines]));
  }

  if (input === 'w') {
    if (!session.hasGpt || session.draftPartitions.length < 2) {
      return failState(state, commandLine, 'fdisk: create GPT and at least two partitions before writing.');
    }

    const updatedDisk: DiskState = {
      ...disk,
      partitions: session.draftPartitions,
    };

    const nextDisks = replaceDisk(state.disks, updatedDisk);
    return advanceState(
      {
        ...state,
        install: {
          ...state.install,
          selectedDisk: device,
        },
        disks: nextDisks,
        pseudoFs: rebuildPseudoFs(state, nextDisks),
        runtime: {
          ...state.runtime,
          fdiskSession: {
            active: false,
            device: null,
            hasGpt: false,
            draftPartitions: [],
          },
        },
        lastEvent: `Partition table written to ${device}.`,
      },
      [
        commandLine,
        createLine('success', `Wrote partition table to ${device}.`),
        createLine('output', `${partitionName(device, 1)} EFI System`),
        createLine('output', `${partitionName(device, 2)} Linux filesystem`),
        ...beginnerExplanation(state, 'g creates GPT, n adds partitions, and w commits partition changes to disk.'),
      ],
      null,
    );
  }

  if (input === 'q') {
    return finalizeState(
      {
        ...state,
        runtime: {
          ...state.runtime,
          fdiskSession: {
            active: false,
            device: null,
            hasGpt: false,
            draftPartitions: [],
          },
        },
      },
      [commandLine, createLine('output', 'Aborted fdisk without writing changes.')],
    );
  }

  return failState(state, commandLine, `fdisk: unknown interactive command '${input}'. Try m for help.`);
}

export function createDefaultContext(): 'beginner' {
  return 'beginner';
}
