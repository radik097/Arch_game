import { deriveCurrentObjective, isNetworkReady } from './objectives';
import { generateSystem } from './systemGenerator';
import type {
  Difficulty,
  DiskState,
  GameState,
  PartitionState,
  TeachingNote,
  TerminalLine,
} from './types';

export interface SimulatedCommandResult {
  nextState: GameState;
  accepted: boolean;
  emittedLines: TerminalLine[];
  errorText: string | null;
}

export interface CompletionResult {
  buffer: string;
  suggestions: string[];
}

const REQUIRED_PACSTRAP_PACKAGES = ['base', 'linux', 'linux-firmware', 'networkmanager', 'grub', 'efibootmgr'];
const DEFAULT_SEED = 'local-offline-seed';

interface CreateInitialStateOptions {
  seed?: string;
  startedAtMs?: number;
  profile?: string;
}

export function createInitialState(difficulty: Difficulty, options: CreateInitialStateOptions = {}): GameState {
  const seed = options.seed ?? DEFAULT_SEED;
  const profile = options.profile ?? 'uefi-single-root-grub';
  const generated = generateSystem(seed, difficulty);

  const state: GameState = {
    difficulty,
    seed,
    profile,
    history: createWelcomeLines(difficulty, generated.installTargetDisk, generated.disks),
    hardware: generated.hardware,
    disks: generated.disks,
    installTargetDisk: generated.installTargetDisk,
    networkInterfaces: generated.networkInterfaces,
    events: generated.events,
    pseudoFs: generated.pseudoFs,
    install: {
      selectedDisk: null,
      rootMounted: false,
      bootMounted: false,
      packagesUpdated: false,
      packagesInstalled: false,
      fstabGenerated: false,
      inChroot: false,
      timezoneSet: false,
      clockSynced: false,
      localeGenerated: false,
      hostnameSet: false,
      passwdSet: false,
      networkManagerEnabled: false,
      grubInstalled: false,
      grubConfigGenerated: false,
      unmounted: false,
      rebooted: false,
    },
    startedAt: options.startedAtMs ?? Date.now(),
    attempt: 1,
    currentObjective: 'inspect',
    completed: false,
    lastTeachingNote: null,
    lastEvent: generated.events.length > 0 ? describeActiveEvents(generated.events) : 'Hardware probe complete.',
    runtime: {
      commandCount: 0,
      eventLog: [],
      mode: 'browser',
      browserProfile: null,
      currentDirectory: '/root',
      fdiskSession: {
        active: false,
        device: null,
        hasGpt: false,
        draftPartitions: [],
      },
    },
  };

  state.currentObjective = deriveCurrentObjective(state);
  return state;
}

export function executeCommand(state: GameState, rawInput: string): GameState {
  const input = rawInput.trim();
  if (input.length === 0) {
    return state;
  }

  const commandPrompt = getPromptLabel(state);
  const commandLine = createLine('command', `${commandPrompt} ${input}`);

  if (input === 'clear') {
    return {
      ...state,
      history: [],
    };
  }

  if (input === 'reset') {
    const resetState = createInitialState(state.difficulty, { seed: state.seed, profile: state.profile });
    resetState.history = [createLine('system', 'Simulation reset.'), ...resetState.history];
    return resetState;
  }

  const fallback = (message: string): GameState => failState(state, commandLine, message);
  const [cmd, ...rest] = input.split(/\s+/);
  const args = rest;
  const activeLink = state.networkInterfaces.find((networkInterface) => networkInterface.connected);
  const targetDisk = getInstallDisk(state);
  const efiPartition = getPartitionByRole(state, 'efi');
  const rootPartition = getPartitionByRole(state, 'root');

  if (state.runtime.fdiskSession.active) {
    return withCommandProgress(handleFdiskSessionCommand(state, commandLine, input));
  }

  if (input === 'help') {
    return finalizeState(state, [
      commandLine,
      createLine('output', 'Supported Linux simulator path:'),
      createLine('output', 'lsblk | ip link | cat /proc/cpuinfo | cat /proc/meminfo | cat /sys/class/net'),
      createLine('output', `fdisk ${state.installTargetDisk}`),
      createLine('output', 'fdisk -l'),
      createLine('output', 'modprobe iwlwifi | ip link set <if> up | iwctl station wlan0 connect ArchTrainerLab'),
      createLine('output', `mkfs.fat -F32 ${partitionName(state.installTargetDisk, 1)}`),
      createLine('output', `mkfs.ext4 ${partitionName(state.installTargetDisk, 2)}`),
      createLine('output', `mount ${partitionName(state.installTargetDisk, 2)} /mnt`),
      createLine('output', `mount --mkdir ${partitionName(state.installTargetDisk, 1)} /mnt/boot`),
      createLine('output', 'reflector --latest 10 --sort rate --save /etc/pacman.d/mirrorlist'),
      createLine('output', 'pacstrap /mnt base linux linux-firmware networkmanager grub efibootmgr'),
      createLine('output', 'genfstab -U /mnt >> /mnt/etc/fstab'),
      createLine('output', 'arch-chroot /mnt'),
      createLine('output', 'ln -sf /usr/share/zoneinfo/UTC /etc/localtime'),
      createLine('output', 'hwclock --systohc'),
      createLine('output', 'locale-gen'),
      createLine('output', 'echo archbox > /etc/hostname'),
      createLine('output', 'passwd'),
      createLine('output', 'systemctl enable NetworkManager'),
      createLine('output', 'grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB'),
      createLine('output', 'grub-mkconfig -o /boot/grub/grub.cfg'),
      createLine('output', 'exit | umount -R /mnt | reboot'),
    ]);
  }

  if (input === 'lsblk') {
    return withCommandProgress(finalizeState(state, [commandLine, ...renderLsblk(state)]));
  }

  if (cmd === 'pwd') {
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', state.runtime.currentDirectory)]));
  }

  if (cmd === 'cd') {
    const target = args[0] ?? '/root';
    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    if (!virtualFs.directories.has(resolvedPath)) {
      return fallback(`cd: ${target}: No such file or directory`);
    }

    return withCommandProgress(
      finalizeState(
        {
          ...state,
          runtime: {
            ...state.runtime,
            currentDirectory: resolvedPath,
          },
        },
        [commandLine],
      ),
    );
  }

  if (cmd === 'ls') {
    const target = args.find((argument) => !argument.startsWith('-')) ?? state.runtime.currentDirectory;
    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    if (virtualFs.files.has(resolvedPath)) {
      return withCommandProgress(finalizeState(state, [commandLine, createLine('output', basename(resolvedPath))]));
    }

    if (!virtualFs.directories.has(resolvedPath)) {
      return fallback(`ls: cannot access '${target}': No such file or directory`);
    }

    const entries = listDirectoryEntries(virtualFs, resolvedPath);
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', entries.join('  '))]));
  }

  if (input === 'ip link') {
    return withCommandProgress(finalizeState(state, [commandLine, ...renderIpLink(state)]));
  }

  if (cmd === 'cat') {
    const target = args[0];
    if (!target) {
      return fallback('cat: missing operand');
    }

    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    if (virtualFs.directories.has(resolvedPath)) {
      return fallback(`cat: ${target}: Is a directory`);
    }

    const fileContent = virtualFs.files.get(resolvedPath);
    if (fileContent === undefined) {
      return fallback(`cat: ${target}: No such file or directory`);
    }

    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', fileContent)]));
  }

  if (cmd === 'find') {
    const baseTarget = args.find((argument) => !argument.startsWith('-')) ?? state.runtime.currentDirectory;
    const resolvedPath = resolvePath(state, baseTarget);
    const virtualFs = buildVirtualFs(state);
    if (!virtualFs.directories.has(resolvedPath) && !virtualFs.files.has(resolvedPath)) {
      return fallback(`find: '${baseTarget}': No such file or directory`);
    }

    const nameFilterIndex = args.indexOf('-name');
    const nameFilter = nameFilterIndex >= 0 ? args[nameFilterIndex + 1] : undefined;
    const found = findEntries(virtualFs, resolvedPath, nameFilter);
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', found.join('\n'))]));
  }

  if (cmd === 'modprobe' && args[0] === 'iwlwifi') {
    const wifiIssue = state.events.find((event) => event.id === 'wifi_driver_missing' && event.active && !event.resolved);
    if (!wifiIssue) {
      return fallback('modprobe: module iwlwifi already loaded or not required in this scenario.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          networkInterfaces: state.networkInterfaces.map((networkInterface) =>
            networkInterface.kind === 'wifi'
              ? { ...networkInterface, driverReady: true }
              : networkInterface,
          ),
          events: markEventResolved(state, 'wifi_driver_missing'),
          lastEvent: 'Wireless driver loaded successfully.',
        },
        [commandLine, createLine('success', 'modprobe: loaded iwlwifi'), createLine('output', 'wlan0 is now available for configuration.')],
        {
          title: 'Kernel module recovery',
          ru: 'В сложных сценариях Wi-Fi может быть недоступен до загрузки драйвера.',
          en: 'In harder scenarios Wi-Fi can remain unavailable until the driver is loaded explicitly.',
        },
      ),
    );
  }

  if (cmd === 'ip' && args[0] === 'link' && args[1] === 'set' && args[3] === 'up') {
    const interfaceName = args[2];
    const networkInterface = state.networkInterfaces.find((item) => item.name === interfaceName);
    if (!networkInterface) {
      return fallback(`ip: cannot find device '${interfaceName}'`);
    }

    if (!networkInterface.driverReady) {
      return fallback(`ip: ${interfaceName} is missing its kernel driver.`);
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          networkInterfaces: state.networkInterfaces.map((item) =>
            item.name === interfaceName ? { ...item, up: true } : item,
          ),
          events: markEventResolved(state, 'network_drop'),
          lastEvent: `${interfaceName} link is up.`,
        },
        [commandLine, createLine('success', `${interfaceName}: state UP`)],
        null,
      ),
    );
  }

  if (cmd === 'ping') {
    const target = args.find((argument) => !argument.startsWith('-'));
    if (!target) {
      return fallback('ping: usage error: Destination address required');
    }

    const pingTarget = resolvePingTarget(target);
    if (!pingTarget) {
      return fallback(`ping: ${target}: Name or service not known`);
    }

    if (!isNetworkReady(state) || !activeLink) {
      return fallback(pingTarget.isIpAddress ? 'ping: connect: Network is unreachable' : `ping: ${target}: Temporary failure in name resolution`);
    }

    return withCommandProgress(
      finalizeState(state, [
        commandLine,
        createLine('success', `PING ${target} (${pingTarget.address}): 56 data bytes`),
        createLine('success', `64 bytes from ${pingTarget.address}: icmp_seq=0 ttl=${pingTarget.ttl} time=${pingTarget.times[0]} ms`),
        createLine('success', `64 bytes from ${pingTarget.address}: icmp_seq=1 ttl=${pingTarget.ttl} time=${pingTarget.times[1]} ms`),
        createLine('output', `--- ${target} ping statistics ---`),
        createLine('output', '2 packets transmitted, 2 received, 0% packet loss'),
      ]),
    );
  }

  if (cmd === 'iwctl' && args[0] === 'station' && args[2] === 'connect') {
    const interfaceName = args[1];
    const networkInterface = state.networkInterfaces.find((item) => item.name === interfaceName);
    if (!networkInterface) {
      return fallback(`iwctl: device ${interfaceName} not found.`);
    }

    if (!networkInterface.driverReady) {
      return fallback(`iwctl: device ${interfaceName} not found because the driver is missing.`);
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          networkInterfaces: state.networkInterfaces.map((item) =>
            item.name === interfaceName ? { ...item, up: true, connected: true } : item,
          ),
          events: markEventResolved(state, 'network_drop'),
          lastEvent: `${interfaceName} connected to ArchTrainerLab.`,
        },
        [commandLine, createLine('success', `Station ${interfaceName} connected to ArchTrainerLab.`)],
        {
          title: 'Network recovery',
          ru: 'В live-среде иногда приходится вручную поднимать интерфейс и подключать сеть.',
          en: 'In the live environment you sometimes need to manually repair the link and connect the network.',
        },
      ),
    );
  }

  if (cmd === 'fdisk') {
    if (args[0] === '-l') {
      return withCommandProgress(finalizeState(state, [commandLine, ...renderLsblk(state)]));
    }

    const device = args[0];
    const disk = state.disks.find((item) => item.device === device);
    if (!disk) {
      return fallback(`fdisk: cannot open ${device}: No such device`);
    }

    if (disk.removable) {
      return fallback(`fdisk: ${device} looks removable and is not the install target in this scenario.`);
    }

    if (device !== state.installTargetDisk) {
      return fallback(`fdisk: ${device} is not the target disk for this seeded scenario.`);
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          runtime: {
            ...state.runtime,
            fdiskSession: {
              active: true,
              device,
              hasGpt: false,
              draftPartitions: [],
            },
          },
          lastEvent: `Entered fdisk interactive mode for ${device}.`,
        },
        [
          commandLine,
          createLine('output', `Welcome to fdisk (util-linux 2.40).`),
          createLine('output', `Device: ${device}`),
          createLine('output', 'Command (m for help):'),
        ],
        {
          title: 'Disk selection',
          ru: 'fdisk должен быть интерактивным: таблица и разделы пишутся только после команды w.',
          en: 'fdisk must be interactive: partition changes are written only after the w command.',
        },
      ),
    );
  }

  if (cmd === 'mkfs.fat' && args[0] === '-F32') {
    const device = args[1];
    const partition = findPartition(state, device);
    if (!partition || partition.role !== 'efi') {
      return fallback(`mkfs.fat: ${device}: No such EFI partition`);
    }

    return withCommandProgress(
      updatePartitionFilesystem(state, commandLine, device, 'fat32', 'mkfs.fat 4.2 (2021-01-31)'),
    );
  }

  if (cmd === 'mkfs.ext4') {
    const device = args[0];
    const partition = findPartition(state, device);
    if (!partition || partition.role !== 'root') {
      return fallback(`mkfs.ext4: ${device}: No such root partition`);
    }

    return withCommandProgress(
      updatePartitionFilesystem(state, commandLine, device, 'ext4', 'mke2fs 1.47.1'),
    );
  }

  if (cmd === 'mount') {
    const mountArgs = args[0] === '--mkdir' ? args.slice(1) : args;
    const device = mountArgs[0];
    const mountPoint = mountArgs[mountArgs.length - 1];
    const partition = findPartition(state, device);
    if (!partition || partition.filesystem === null) {
      return fallback(`mount: ${device}: can't read superblock`);
    }

    if (mountPoint === '/mnt' && partition.role !== 'root') {
      return fallback(`mount: ${device} is not the root partition for /mnt.`);
    }

    if (mountPoint === '/mnt/boot' && partition.role !== 'efi') {
      return fallback(`mount: ${device} is not the EFI partition for /mnt/boot.`);
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            rootMounted: mountPoint === '/mnt' ? true : state.install.rootMounted,
            bootMounted: mountPoint === '/mnt/boot' ? true : state.install.bootMounted,
            unmounted: false,
          },
          lastEvent: `${device} mounted on ${mountPoint}.`,
        },
        [
          commandLine,
          createLine('success', `${device} mounted on ${mountPoint}.`),
          ...beginnerExplanation(state, mountPoint === '/mnt'
            ? 'This attaches the root partition to /mnt, where Arch will be installed.'
            : 'This mounts the EFI partition to /mnt/boot so GRUB can install boot files.'),
        ],
        null,
      ),
    );
  }

  if (input === 'reflector --latest 10 --sort rate --save /etc/pacman.d/mirrorlist') {
    const mirrorEvent = state.events.find((event) => event.id === 'mirror_timeout' && event.active && !event.resolved);
    if (!mirrorEvent) {
      return fallback('reflector: mirrors are already usable in this scenario.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          events: markEventResolved(state, 'mirror_timeout'),
          lastEvent: 'Mirrorlist refreshed successfully.',
        },
        [commandLine, createLine('success', 'Updated /etc/pacman.d/mirrorlist with fresh mirrors.')],
        {
          title: 'Mirror repair',
          ru: 'На сложных уровнях зеркала могут быть сломаны. Нужно вручную обновить mirrorlist перед pacstrap.',
          en: 'On harder modes the mirrors can be broken. You need to refresh the mirrorlist before pacstrap succeeds.',
        },
      ),
    );
  }

  if (cmd === 'pacstrap') {
    if (!state.install.rootMounted || !state.install.bootMounted) {
      return fallback('pacstrap: mount both /mnt and /mnt/boot before installing packages.');
    }

    if (!isNetworkReady(state)) {
      return fallback('pacstrap: mirrors are unreachable because networking is degraded.');
    }

    const mirrorEvent = state.events.find((event) => event.id === 'mirror_timeout' && event.active && !event.resolved);
    if (mirrorEvent) {
      return fallback('pacstrap: failed retrieving file from mirror. Refresh the mirrorlist first.');
    }

    const packages = input.split(/\s+/).slice(2);
    const missing = REQUIRED_PACSTRAP_PACKAGES.filter((pkg) => !packages.includes(pkg));
    if (!input.startsWith('pacstrap /mnt ') || missing.length > 0) {
      return fallback(`pacstrap: this simulator expects /mnt and the package set: ${REQUIRED_PACSTRAP_PACKAGES.join(', ')}.`);
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            packagesInstalled: true,
          },
          lastEvent: 'Base system installed into /mnt.',
        },
        [
          commandLine,
          createLine('output', ':: Synchronizing package databases...'),
          createLine('success', 'Installed base linux linux-firmware networkmanager grub efibootmgr into /mnt.'),
          ...beginnerExplanation(state, 'This installs the base Arch system into /mnt, creating your target root filesystem.'),
        ],
        null,
      ),
    );
  }

  if (cmd === 'pacman' && args[0] === '-Syu') {
    if (!state.install.inChroot) {
      return fallback('pacman: run pacman -Syu from inside arch-chroot.');
    }

    if (!isNetworkReady(state)) {
      return fallback('pacman: failed to synchronize all databases (network unavailable).');
    }

    const mirrorEvent = state.events.find((event) => event.id === 'mirror_timeout' && event.active && !event.resolved);
    if (mirrorEvent) {
      return fallback('pacman: mirror database is stale or unreachable. Refresh mirrorlist first.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            packagesUpdated: true,
          },
          lastEvent: 'Package database synchronized and system packages updated.',
        },
        [
          commandLine,
          createLine('output', ':: Synchronizing package databases...'),
          createLine('output', ':: Starting full system upgrade...'),
          createLine('success', 'there is nothing to do'),
          ...beginnerExplanation(state, 'This refreshes package databases and upgrades installed packages in the target system.'),
        ],
        null,
      ),
    );
  }

  if (input === 'genfstab -U /mnt >> /mnt/etc/fstab') {
    if (!state.install.packagesInstalled) {
      return fallback('genfstab: install the base system before generating fstab.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            fstabGenerated: true,
          },
          lastEvent: 'fstab generated with UUID entries.',
        },
        [
          commandLine,
          createLine('success', 'Generated fstab with UUID-based entries.'),
          ...beginnerExplanation(state, 'This writes persistent mount rules so the installed system can mount partitions on boot.'),
        ],
        null,
      ),
    );
  }

  if (input === 'arch-chroot /mnt') {
    if (!state.install.fstabGenerated) {
      return fallback('arch-chroot: generate fstab before entering the target system.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            inChroot: true,
          },
          runtime: {
            ...state.runtime,
            currentDirectory: '/',
          },
          lastEvent: 'Entered arch-chroot.',
        },
        [commandLine, createLine('success', 'Changed root into /mnt.')],
        null,
      ),
    );
  }

  if (input === 'ln -sf /usr/share/zoneinfo/UTC /etc/localtime') {
    if (!state.install.inChroot) {
      return fallback('ln: set timezone from inside arch-chroot.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'timezoneSet', 'Timezone linked to UTC.'));
  }

  if (input === 'hwclock --systohc') {
    if (!state.install.inChroot || !state.install.timezoneSet) {
      return fallback('hwclock: set the timezone first from inside arch-chroot.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'clockSynced', 'Hardware clock synchronized from system time.'));
  }

  if (input === 'locale-gen') {
    if (!state.install.inChroot) {
      return fallback('locale-gen: run it from inside arch-chroot.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'localeGenerated', 'Generating locales... done.'));
  }

  if (cmd === 'echo' && input.includes('> /etc/hostname')) {
    if (!state.install.inChroot) {
      return fallback('echo: set hostname from inside arch-chroot.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'hostnameSet', 'Hostname written to /etc/hostname.'));
  }

  if (input === 'passwd') {
    if (!state.install.inChroot) {
      return fallback('passwd: Authentication token manipulation error');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'passwdSet', 'passwd: password updated successfully'));
  }

  if (input === 'systemctl enable NetworkManager') {
    if (!state.install.inChroot || !state.install.packagesInstalled) {
      return fallback('systemctl: enable services from inside the installed system after pacstrap.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'networkManagerEnabled', 'Created symlink for NetworkManager.service.'));
  }

  if (input === 'grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB') {
    if (!state.install.inChroot || !state.install.bootMounted || !efiPartition) {
      return fallback('grub-install: enter arch-chroot and mount /boot before installing the bootloader.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'grubInstalled', 'Installation finished. No error reported.'));
  }

  if (input === 'grub-mkconfig -o /boot/grub/grub.cfg') {
    if (!state.install.grubInstalled) {
      return fallback('grub-mkconfig: install GRUB before generating grub.cfg.');
    }

    return withCommandProgress(updateInstallFlag(state, commandLine, 'grubConfigGenerated', 'Generated /boot/grub/grub.cfg'));
  }

  if (input === 'exit') {
    if (!state.install.inChroot) {
      return fallback('exit: you are not inside arch-chroot.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            inChroot: false,
          },
          runtime: {
            ...state.runtime,
            currentDirectory: '/root',
          },
          lastEvent: 'Leaving chroot environment.',
        },
        [commandLine, createLine('success', 'Leaving chroot environment.')],
        null,
      ),
    );
  }

  if (input === 'umount -R /mnt') {
    if (state.install.inChroot) {
      return fallback('umount: exit arch-chroot before unmounting the target system.');
    }

    if (!state.install.grubConfigGenerated || !state.install.networkManagerEnabled) {
      return fallback('umount: finish bootloader setup and service enablement before final teardown.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            rootMounted: false,
            bootMounted: false,
            unmounted: true,
          },
          lastEvent: 'Target filesystem unmounted.',
        },
        [commandLine, createLine('success', 'Unmounted /mnt recursively.')],
        null,
      ),
    );
  }

  if (input === 'reboot') {
    if (
      !state.install.unmounted ||
      !state.install.grubConfigGenerated ||
      !state.install.clockSynced ||
      !state.install.localeGenerated ||
      !state.install.hostnameSet ||
      !state.install.passwdSet
    ) {
      return fallback('reboot: the system is not ready to boot yet. Complete configuration and unmount first.');
    }

    return withCommandProgress(
      finalizeState(
        {
          ...state,
          install: {
            ...state.install,
            rebooted: true,
          },
          completed: true,
          lastEvent: 'Arch system booted successfully.',
        },
        [commandLine, createLine('success', 'Rebooting...'), createLine('system', 'Boot target reached: Arch Linux installed and ready.')],
        {
          title: 'Installation complete',
          ru: 'Система установлена. Теперь можно тренировать более сложные сценарии: RAID, LUKS и recovery boot.',
          en: 'The system is installed. The natural next step is harder scenarios: RAID, LUKS, and boot recovery.',
        },
      ),
    );
  }

  return fallback(`Command not recognized in this simulator path: ${input}`);
}

export function simulateCommand(state: GameState, rawInput: string): SimulatedCommandResult {
  const nextState = executeCommand(state, rawInput);
  const emittedLines = nextState.history.slice(state.history.length);
  const errorText = getLastLineByKind(emittedLines, 'error')?.text ?? null;

  return {
    nextState,
    accepted: errorText === null,
    emittedLines,
    errorText,
  };
}

export function getPromptLabel(state: GameState): string {
  const displayPath = state.runtime.currentDirectory === '/root'
    ? '~'
    : state.runtime.currentDirectory.startsWith('/root/')
      ? `~${state.runtime.currentDirectory.slice('/root'.length)}`
      : state.runtime.currentDirectory;
  return `[root@archiso ${displayPath}]#`;
}

export function completeInput(state: GameState, rawInput: string): CompletionResult {
  const tokenMatch = /(^|\s)([^\s]*)$/.exec(rawInput);
  const token = tokenMatch?.[2] ?? '';
  const tokenStart = tokenMatch ? rawInput.length - token.length : rawInput.length;
  const firstToken = rawInput.trim().split(/\s+/)[0] ?? '';
  const shouldCompletePath = token.startsWith('/') || ['cd', 'ls', 'cat', 'find', 'fdisk', 'mount', 'umount', 'mkfs.ext4', 'mkfs.fat'].includes(firstToken);

  const suggestions = shouldCompletePath
    ? completePathToken(state, token)
    : getCommandSuggestions().filter((command) => command.startsWith(token)).sort();

  if (suggestions.length === 0) {
    return { buffer: rawInput, suggestions: [] };
  }

  const nextToken = longestSharedPrefix(suggestions);
  return {
    buffer: nextToken.length > token.length ? `${rawInput.slice(0, tokenStart)}${nextToken}` : rawInput,
    suggestions,
  };
}

function createWelcomeLines(difficulty: Difficulty, targetDisk: string, disks: DiskState[]): TerminalLine[] {
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

function finalizeState(state: GameState, lines: TerminalLine[], teachingNote = state.lastTeachingNote): GameState {
  const nextState: GameState = {
    ...state,
    history: [...state.history, ...lines],
    lastTeachingNote: teachingNote,
  };

  nextState.currentObjective = deriveCurrentObjective(nextState);
  return nextState;
}

function advanceState(state: GameState, lines: TerminalLine[], teachingNote: TeachingNote | null): GameState {
  return finalizeState(state, lines, teachingNote);
}

function withCommandProgress(state: GameState): GameState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      commandCount: state.runtime.commandCount + 1,
    },
  };
}

function failState(state: GameState, commandLine: TerminalLine, message: string): GameState {
  if (state.difficulty === 'god') {
    const restarted = createInitialState('god', { seed: state.seed, profile: state.profile });
    restarted.attempt = state.attempt + 1;
    restarted.history = [
      commandLine,
      createLine('error', message),
      createLine('system', 'God mode: one mistake resets the run.'),
      ...createWelcomeLines('god', restarted.installTargetDisk, restarted.disks),
    ];
    return restarted;
  }

  return withCommandProgress(finalizeState(state, [commandLine, createLine('error', message)]));
}

function renderLsblk(state: GameState): TerminalLine[] {
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

function renderIpLink(state: GameState): TerminalLine[] {
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

function replaceDisk(disks: DiskState[], updatedDisk: DiskState): DiskState[] {
  return disks.map((disk) => (disk.device === updatedDisk.device ? updatedDisk : disk));
}

function findPartition(state: GameState, device: string): PartitionState | null {
  for (const disk of state.disks) {
    const partition = disk.partitions.find((item) => item.name === device);
    if (partition) {
      return partition;
    }
  }

  return null;
}

function getPartitionByRole(state: GameState, role: PartitionState['role']): PartitionState | null {
  const disk = getInstallDisk(state);
  return disk?.partitions.find((partition) => partition.role === role) ?? null;
}

function getInstallDisk(state: GameState): DiskState | null {
  return state.disks.find((disk) => disk.device === state.installTargetDisk) ?? null;
}

function updatePartitionFilesystem(
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

function updateInstallFlag(
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

function markEventResolved(state: GameState, eventId: GameState['events'][number]['id']) {
  return state.events.map((event) =>
    event.id === eventId
      ? { ...event, active: false, resolved: true, injectedAtCommand: state.runtime.commandCount }
      : event,
  );
}

function rebuildPseudoFs(state: GameState, disks: DiskState[]) {
  return {
    ...state.pseudoFs,
    devNodes: [...disks.map((disk) => disk.device), ...state.networkInterfaces.map((networkInterface) => `/sys/class/net/${networkInterface.name}`)],
  };
}

function describeActiveEvents(events: GameState['events']): string {
  return events
    .filter((event) => event.active)
    .map((event) => event.id)
    .join(', ');
}

function partitionName(device: string, partitionIndex: number): string {
  return device.includes('nvme') ? `${device}p${partitionIndex}` : `${device}${partitionIndex}`;
}

function buildVirtualFs(state: GameState) {
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

function buildEtcHosts(state: GameState): string {
  const hostname = state.install.hostnameSet ? 'archbox' : 'archiso';
  return [
    '127.0.0.1\tlocalhost',
    '::1\t\tlocalhost',
    `127.0.1.1\t${hostname}.localdomain\t${hostname}`,
  ].join('\n');
}

function buildResolvConf(state: GameState): string {
  const hasNetwork = state.networkInterfaces.some((networkInterface) => networkInterface.connected);
  return [
    '# Generated by systemd-resolved',
    'nameserver 127.0.0.53',
    `search ${hasNetwork ? 'archtrainer.lab' : '.'}`,
  ].join('\n');
}

function buildMirrorList(state: GameState): string {
  const mirrorBroken = state.events.some((event) => event.id === 'mirror_timeout' && event.active && !event.resolved);
  return mirrorBroken
    ? '# reflector recommended\nServer = https://stale-mirror.invalid/$repo/os/$arch\nServer = https://backup-mirror.invalid/$repo/os/$arch'
    : '# reflector generated\nServer = https://mirror.rackspace.com/archlinux/$repo/os/$arch\nServer = https://geo.mirror.pkgbuild.com/$repo/os/$arch';
}

function buildProcNetDev(state: GameState): string {
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

function buildProcNetRoute(state: GameState): string {
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

function buildMacAddress(seed: string, interfaceName: string): string {
  const source = `${seed}:${interfaceName}`;
  const octets = Array.from({ length: 6 }, (_, index) => {
    const charCode = source.charCodeAt(index % source.length);
    const value = (charCode + index * 37) & 0xff;
    return value.toString(16).padStart(2, '0');
  });
  octets[0] = '52';
  return octets.join(':');
}

function resolvePath(state: GameState, rawPath: string): string {
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

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '/';
}

function listDirectoryEntries(virtualFs: ReturnType<typeof buildVirtualFs>, directory: string): string[] {
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

function findEntries(virtualFs: ReturnType<typeof buildVirtualFs>, basePath: string, nameFilter?: string): string[] {
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

function handleFdiskSessionCommand(state: GameState, commandLine: TerminalLine, input: string): GameState {
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

function beginnerExplanation(state: GameState, text: string): TerminalLine[] {
  if (state.difficulty !== 'beginner') {
    return [];
  }
  return [createLine('info', `Explanation: ${text}`)];
}

function getCommandSuggestions(): string[] {
  return [
    'help', 'ls', 'lsblk', 'cd', 'cat', 'pwd', 'find', 'ping', 'ip', 'fdisk', 'mount', 'umount',
    'mkfs.ext4', 'mkfs.fat', 'pacstrap', 'pacman', 'genfstab', 'arch-chroot', 'modprobe', 'iwctl', 'passwd',
    'locale-gen', 'hwclock', 'systemctl', 'grub-install', 'grub-mkconfig', 'reflector', 'ln', 'echo',
    'reboot', 'exit', 'clear', 'start', 'sessionctl',
  ];
}

function completePathToken(state: GameState, token: string): string[] {
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

function longestSharedPrefix(values: string[]): string {
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

function resolvePingTarget(target: string): { address: string; ttl: number; times: [string, string]; isIpAddress: boolean } | null {
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

function createLine(kind: TerminalLine['kind'], text: string): TerminalLine {
  return {
    id: `${kind}-${Math.random().toString(36).slice(2, 10)}`,
    kind,
    text,
  };
}

function getLastLineByKind(lines: TerminalLine[], kind: TerminalLine['kind']): TerminalLine | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.kind === kind) {
      return lines[index] ?? null;
    }
  }

  return null;
}