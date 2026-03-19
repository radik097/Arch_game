import { 
  createLine, 
  finalizeState, 
  failState, 
  resolvePath, 
  buildVirtualFs, 
  basename, 
  listDirectoryEntries,
  withCommandProgress,
  renderLsblk,
  renderIpLink,
  resolvePingTarget,
  findPartition,
  updatePartitionFilesystem,
  updateInstallFlag,
  beginnerExplanation,
  advanceState,
  markEventResolved,
  findEntries
} from './simulatorUtils';
import { deriveCurrentObjective, isNetworkReady } from './objectives';
import type { GameState, ParsedCommand, TerminalLine, DiskState, PartitionState } from './types';

export type CommandExecutor = (
  args: string[],
  flags: Record<string, string | boolean>,
  state: GameState,
  commandLine: TerminalLine
) => GameState;

export interface Command {
  name: string;
  execute: CommandExecutor;
  description?: string;
}

const registry: Record<string, Command> = {};

export function registerCommand(command: Command) {
  registry[command.name] = command;
}

export function getCommand(name: string): Command | undefined {
  return registry[name];
}

export function getAllCommandNames(): string[] {
  return Object.keys(registry);
}

const REQUIRED_PACSTRAP_PACKAGES = ['base', 'linux', 'linux-firmware', 'networkmanager', 'grub', 'efibootmgr'];

export function dispatchCommand(parsed: ParsedCommand, state: GameState, commandLine: TerminalLine): GameState | undefined {
  const command = registry[parsed.command];
  if (!command) return undefined;
  return command.execute(parsed.args, parsed.flags, state, commandLine);
}

// --- CORE COMMANDS ---

registerCommand({
  name: 'pwd',
  execute: (args, flags, state, commandLine) => {
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', state.runtime.currentDirectory)]));
  }
});

registerCommand({
  name: 'cd',
  execute: (args, flags, state, commandLine) => {
    const target = args[0] ?? '/root';
    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    if (!virtualFs.directories.has(resolvedPath)) {
      return failState(state, commandLine, `cd: ${target}: No such file or directory`);
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
        [commandLine]
      )
    );
  }
});

registerCommand({
  name: 'ls',
  execute: (args, flags, state, commandLine) => {
    const target = args.find((arg) => !arg.startsWith('-')) ?? state.runtime.currentDirectory;
    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    
    if (virtualFs.files.has(resolvedPath)) {
      return withCommandProgress(finalizeState(state, [commandLine, createLine('output', basename(resolvedPath))]));
    }

    if (!virtualFs.directories.has(resolvedPath)) {
      return failState(state, commandLine, `ls: cannot access '${target}': No such file or directory`);
    }

    const entries = listDirectoryEntries(virtualFs, resolvedPath);
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', entries.join('  '))]));
  }
});

registerCommand({
  name: 'cat',
  execute: (args, flags, state, commandLine) => {
    const target = args[0];
    if (!target) {
      return failState(state, commandLine, 'cat: missing operand');
    }

    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    if (virtualFs.directories.has(resolvedPath)) {
      return failState(state, commandLine, `cat: ${target}: Is a directory`);
    }

    const fileContent = virtualFs.files.get(resolvedPath);
    if (fileContent === undefined) {
      return failState(state, commandLine, `cat: ${target}: No such file or directory`);
    }

    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', fileContent)]));
  }
});

registerCommand({
  name: 'lsblk',
  execute: (args, flags, state, commandLine) => {
    return withCommandProgress(finalizeState(state, [commandLine, ...renderLsblk(state)]));
  }
});

registerCommand({
  name: 'ip',
  execute: (args, flags, state, commandLine) => {
    const sub = args[0];
    if (sub === 'link' || sub === 'a' || sub === 'addr') {
      return withCommandProgress(finalizeState(state, [commandLine, ...renderIpLink(state)]));
    }
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', 'Usage: ip [link|addr]')]));
  }
});

registerCommand({
  name: 'ping',
  execute: (args, flags, state, commandLine) => {
    const target = args[0];
    if (!target) {
      return failState(state, commandLine, 'ping: missing host operand');
    }

    const info = resolvePingTarget(target);
    if (!info) {
      return failState(state, commandLine, `ping: ${target}: Name or service not known`);
    }

    const hasNetwork = state.networkInterfaces.some((ni) => ni.connected);
    if (!hasNetwork) {
      return withCommandProgress(finalizeState(state, [commandLine, createLine('output', `PING ${target} (${info.address}) 56(84) bytes of data.`), createLine('error', 'Destination Host Unreachable')]));
    }

    return withCommandProgress(
      finalizeState(state, [
        commandLine,
        createLine('output', `PING ${target} (${info.address}) 56(84) bytes of data.`),
        createLine('output', `64 bytes from ${info.address}: icmp_seq=1 ttl=${info.ttl} time=${info.times[0]} ms`),
        createLine('output', `64 bytes from ${info.address}: icmp_seq=2 ttl=${info.ttl} time=${info.times[1]} ms`),
        createLine('output', `--- ${target} ping statistics ---`),
        createLine('output', '2 packets transmitted, 2 received, 0% packet loss'),
      ])
    );
  }
});

registerCommand({
  name: 'fdisk',
  execute: (args, flags, state, commandLine) => {
    const device = args[0];
    if (!device) {
      return failState(state, commandLine, 'fdisk: bad usage. Try fdisk /dev/sda');
    }

    const disk = state.disks.find((d) => d.device === device);
    if (!disk) {
      return failState(state, commandLine, `fdisk: cannot open ${device}: No such device`);
    }

    return withCommandProgress(
      finalizeState(
        {
          ...state,
          runtime: {
            ...state.runtime,
            fdiskSession: {
              active: true,
              device,
              hasGpt: disk.partitions.length > 0,
              draftPartitions: [...disk.partitions],
            },
          },
        },
        [
          commandLine,
          createLine('output', `Welcome to fdisk (util-linux).`),
          createLine('output', `Changes will remain in memory only, until you decide to write them.`),
          createLine('output', 'Command (m for help):'),
        ]
      )
    );
  }
});

registerCommand({
  name: 'mkfs.ext4',
  execute: (args, flags, state, commandLine) => {
    const device = args[0];
    if (!device) return failState(state, commandLine, 'mkfs.ext4: missing device');
    const partition = findPartition(state, device);
    if (!partition) return failState(state, commandLine, `mkfs.ext4: ${device}: No such partition`);
    
    return withCommandProgress(updatePartitionFilesystem(state, commandLine, device, 'ext4', `mke2fs 1.47.0: Done creating ext4 on ${device}`));
  }
});

registerCommand({
  name: 'mkfs.fat',
  execute: (args, flags, state, commandLine) => {
    const device = args[args.length - 1]; // handle flags like -F32
    if (!device || device.startsWith('-')) return failState(state, commandLine, 'mkfs.fat: missing device');
    const partition = findPartition(state, device);
    if (!partition) return failState(state, commandLine, `mkfs.fat: ${device}: No such partition`);

    return withCommandProgress(updatePartitionFilesystem(state, commandLine, device, 'fat32', `mkfs.fat 4.2: Done creating FAT32 on ${device}`));
  }
});

registerCommand({
  name: 'mount',
  execute: (args, flags, state, commandLine) => {
    if (args.length === 0) {
      // Show mounts
      const lines = Object.entries(state.install.mounted || {}).map(([mp, dev]) => 
        createLine('output', `${dev} on ${mp} type unknown (rw,relatime)`)
      );
      return withCommandProgress(finalizeState(state, [commandLine, ...lines]));
    }

    const device = args[0];
    const mountPoint = args[1];
    if (!device || !mountPoint) return failState(state, commandLine, 'mount: bad usage. Try mount /dev/sda1 /mnt');

    const partition = findPartition(state, device);
    if (!partition) return failState(state, commandLine, `mount: ${device}: No such device`);
    if (!partition.filesystem) return failState(state, commandLine, `mount: ${device}: unknown filesystem type (nil)`);

    const key = mountPoint === '/mnt' ? 'rootMounted' : mountPoint === '/mnt/boot' ? 'bootMounted' : null;
    
    const nextState = {
      ...state,
      install: {
        ...state.install,
        mounted: { ...state.install.mounted, [mountPoint]: device },
        ...(key ? { [key]: true } : {})
      }
    };

    return withCommandProgress(
      finalizeState(nextState, [commandLine, createLine('success', `Mounted ${device} to ${mountPoint}`)], null)
    );
  }
});

registerCommand({
  name: 'umount',
  execute: (args, flags, state, commandLine) => {
    const target = args[0];
    if (!target) return failState(state, commandLine, 'umount: specify mountpoint or device');

    // Simple implementation: check if it's a mountpoint
    const entry = Object.entries(state.install.mounted || {}).find(([mp, dev]) => mp === target || dev === target);
    if (!entry) return failState(state, commandLine, `umount: ${target}: not mounted`);

    const [mp, dev] = entry;
    const nextMounted = { ...state.install.mounted };
    delete nextMounted[mp];

    const key = mp === '/mnt' ? 'rootMounted' : mp === '/mnt/boot' ? 'bootMounted' : null;

    return withCommandProgress(
      finalizeState(
        {
          ...state,
          install: {
             ...state.install,
             mounted: nextMounted,
             ...(key ? { [key]: false } : {})
          }
        },
        [commandLine, createLine('success', `Unmounted ${target}`)]
      )
    );
  }
});

registerCommand({
  name: 'pacstrap',
  execute: (args, flags, state, commandLine) => {
    const mountPoint = args[0];
    const packages = args.slice(1);

    if (mountPoint !== '/mnt') {
      return failState(state, commandLine, 'pacstrap: install target must be /mnt');
    }

    if (!state.install.rootMounted) {
      return failState(state, commandLine, 'pacstrap: /mnt is not a mountpoint');
    }

    const hasNetwork = state.networkInterfaces.some((ni) => ni.connected);
    if (!hasNetwork) {
      return failState(state, commandLine, 'pacstrap: error: failed to setup chroot (networking down)');
    }

    const missing = REQUIRED_PACSTRAP_PACKAGES.filter((p) => !packages.includes(p));
    if (missing.length > 0 && state.difficulty !== 'beginner') {
      return failState(state, commandLine, `pacstrap: error: missing essential packages: ${missing.join(', ')}`);
    }

    return withCommandProgress(
      updateInstallFlag(state, commandLine, 'packagesInstalled', 'Packages installed to /mnt successfully.')
    );
  }
});

registerCommand({
  name: 'genfstab',
  execute: (args, flags, state, commandLine) => {
    if (!flags.U) {
      return failState(state, commandLine, 'genfstab: -U flag is recommended for UUIDs');
    }

    if (!state.install.rootMounted) {
      return failState(state, commandLine, 'genfstab: no mountpoints detected at /mnt');
    }

    return withCommandProgress(
      updateInstallFlag(state, commandLine, 'fstabGenerated', 'Generated /etc/fstab with UUIDs.')
    );
  }
});

registerCommand({
  name: 'arch-chroot',
  execute: (args, flags, state, commandLine) => {
    const mountPoint = args[0];
    if (mountPoint !== '/mnt') {
      return failState(state, commandLine, 'arch-chroot: mountpoint must be /mnt');
    }

    if (!state.install.packagesInstalled) {
       return failState(state, commandLine, 'arch-chroot: error: /mnt is not a valid Arch Linux installation (base missing)');
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
          lastEvent: 'Entered chroot environment.',
        },
        [
          commandLine, 
          createLine('success', 'Entered chroot at /mnt'),
          ...beginnerExplanation(state, 'You are now "inside" the new system. Commands like passwd or grub-install will affect the installed system, not the live ISO.')
        ],
        null
      )
    );
  }
});

registerCommand({
  name: 'passwd',
  execute: (args, flags, state, commandLine) => {
    if (!state.install.inChroot) return failState(state, commandLine, 'passwd: error: root password can only be set inside chroot');
    return withCommandProgress(updateInstallFlag(state, commandLine, 'passwdSet', 'Root password set successfully.'));
  }
});

registerCommand({
  name: 'locale-gen',
  execute: (args, flags, state, commandLine) => {
    if (!state.install.inChroot) return failState(state, commandLine, 'locale-gen: error: must be run inside chroot');
    return withCommandProgress(updateInstallFlag(state, commandLine, 'localeGenerated', 'Locales generated: en_US.UTF-8.'));
  }
});

registerCommand({
  name: 'hwclock',
  execute: (args, flags, state, commandLine) => {
    if (!state.install.inChroot) return failState(state, commandLine, 'hwclock: error: must be run inside chroot');
    if (args.includes('--systohc')) {
      return withCommandProgress(updateInstallFlag(state, commandLine, 'clockSynced', 'Hardware clock synced to system time.'));
    }
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', '2024-03-19 14:00:00.000000+00:00')]));
  }
});

registerCommand({
  name: 'grub-install',
  execute: (args, flags, state, commandLine) => {
    if (!state.install.inChroot) return failState(state, commandLine, 'grub-install: error: must be run inside chroot');
    const target = args.find(a => a.startsWith('--target='));
    if (!target && state.difficulty !== 'beginner') return failState(state, commandLine, 'grub-install: error: --target must be specified (e.g. x86_64-efi)');
    
    return withCommandProgress(updateInstallFlag(state, commandLine, 'grubInstalled', 'GRUB bootloader installed successfully.'));
  }
});

registerCommand({
  name: 'grub-mkconfig',
  execute: (args, flags, state, commandLine) => {
    if (!state.install.inChroot) return failState(state, commandLine, 'grub-mkconfig: error: must be run inside chroot');
    const output = args[args.indexOf('-o') + 1];
    if (!output && state.difficulty !== 'beginner') return failState(state, commandLine, 'grub-mkconfig: error: -o <path> must be specified');

    return withCommandProgress(updateInstallFlag(state, commandLine, 'grubConfigGenerated', 'GRUB configuration file generated.'));
  }
});

registerCommand({
  name: 'reboot',
  execute: (args, flags, state, commandLine) => {
    if (state.install.inChroot) return failState(state, commandLine, 'reboot: error: exit chroot before rebooting');

    const critical = [
      state.install.packagesInstalled,
      state.install.fstabGenerated,
      state.install.grubInstalled,
      state.install.grubConfigGenerated,
      state.install.passwdSet
    ];

    if (critical.includes(false)) {
       return failState(state, commandLine, 'reboot: error: system is not ready. Complete installation and configuration first.');
    }

    return withCommandProgress(
      advanceState(
        {
          ...state,
          install: {
            ...state.install,
            rebooted: true,
          },
          completed: true,
          lastEvent: 'System rebooted into installed Arch Linux.',
        },
        [
          commandLine, 
          createLine('success', 'Rebooting...'),
          createLine('system', 'Arch Linux 6.7.x-arch1-1 (tty1)'),
          createLine('system', 'archbox login: ')
        ],
        {
           title: 'Installation Complete',
           ru: 'Поздравляем! Вы успешно установили Arch Linux. Попробуйте теперь вариант Expert.',
           en: 'Congratulations! You have successfully installed Arch Linux. Try the Expert mode next.'
        }
      )
    );
  }
});

registerCommand({
  name: 'exit',
  execute: (args, flags, state, commandLine) => {
    if (state.install.inChroot) {
      return withCommandProgress(
        advanceState(
          {
            ...state,
            install: {
              ...state.install,
              inChroot: false,
            },
          },
          [commandLine, createLine('output', 'exit: leaving chroot environment')],
          null
        )
      );
    }
    // Handle overall exit if needed
    return state;
  }
});

registerCommand({
  name: 'modprobe',
  execute: (args, flags, state, commandLine) => {
    if (args[0] !== 'iwlwifi') return failState(state, commandLine, `modprobe: module ${args[0]} not found`);
    const wifiIssue = state.events.find((e) => e.id === 'wifi_driver_missing' && e.active && !e.resolved);
    if (!wifiIssue) return failState(state, commandLine, 'modprobe: module iwlwifi already loaded');

    return withCommandProgress(
      advanceState(
        {
          ...state,
          networkInterfaces: state.networkInterfaces.map((ni) =>
            ni.kind === 'wifi' ? { ...ni, driverReady: true } : ni
          ),
          events: markEventResolved(state, 'wifi_driver_missing'),
          lastEvent: 'Wireless driver loaded.',
        },
        [commandLine, createLine('success', 'modprobe: loaded iwlwifi')],
        null
      )
    );
  }
});

registerCommand({
  name: 'iwctl',
  execute: (args, flags, state, commandLine) => {
    if (args[0] === 'station' && args[2] === 'connect') {
      const iface = args[1];
      const networkInterface = state.networkInterfaces.find((ni) => ni.name === iface);
      if (!networkInterface) return failState(state, commandLine, `iwctl: device ${iface} not found`);
      if (!networkInterface.driverReady) return failState(state, commandLine, `iwctl: device ${iface} is missing driver`);

      return withCommandProgress(
        advanceState(
          {
            ...state,
            networkInterfaces: state.networkInterfaces.map((ni) =>
              ni.name === iface ? { ...ni, up: true, connected: true } : ni
            ),
            events: markEventResolved(state, 'network_drop'),
            lastEvent: `${iface} connected to ArchTrainerLab.`,
          },
          [commandLine, createLine('success', `Station ${iface} connected to ArchTrainerLab.`)],
          null
        )
      );
    }
    return failState(state, commandLine, 'iwctl: usage station <iface> connect <ssid>');
  }
});

registerCommand({
  name: 'reflector',
  execute: (args, flags, state, commandLine) => {
    const mirrorIssue = state.events.find((e) => e.id === 'mirror_timeout' && e.active && !e.resolved);
    if (!mirrorIssue) return failState(state, commandLine, 'reflector: mirrors already healthy');

    return withCommandProgress(
      advanceState(
        {
          ...state,
          events: markEventResolved(state, 'mirror_timeout'),
          lastEvent: 'Mirrorlist updated.',
        },
        [commandLine, createLine('success', 'Updated /etc/pacman.d/mirrorlist')],
        null
      )
    );
  }
});

registerCommand({
  name: 'find',
  execute: (args, flags, state, commandLine) => {
    const target = args.find(a => !a.startsWith('-')) ?? state.runtime.currentDirectory;
    const resolvedPath = resolvePath(state, target);
    const virtualFs = buildVirtualFs(state);
    const nameFilterIndex = args.indexOf('-name');
    const nameFilter = nameFilterIndex >= 0 ? args[nameFilterIndex + 1] : undefined;

    const results = findEntries(virtualFs, resolvedPath, nameFilter);
    if (results.length === 0) return failState(state, commandLine, `find: ${target}: No matches found`);
    
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', results.join('\n'))]));
  }
});

registerCommand({
  name: 'pacman',
  execute: (args, flags, state, commandLine) => {
    if (!state.install.inChroot) return failState(state, commandLine, 'pacman: error: run from inside chroot');
    if (!isNetworkReady(state)) return failState(state, commandLine, 'pacman: database download failed (no network)');

    return withCommandProgress(updateInstallFlag(state, commandLine, 'packagesUpdated', 'System updated.'));
  }
});

registerCommand({
  name: 'systemctl',
  execute: (args, flags, state, commandLine) => {
    if (args[0] === 'enable' && args[1] === 'NetworkManager') {
      if (!state.install.inChroot) return failState(state, commandLine, 'systemctl: error: must be in chroot');
      return withCommandProgress(updateInstallFlag(state, commandLine, 'networkManagerEnabled', 'NetworkManager enabled.'));
    }
    return failState(state, commandLine, 'systemctl: command not found or not supported in this scenario');
  }
});

registerCommand({
  name: 'ln',
  execute: (args, flags, state, commandLine) => {
    if (flags.s && flags.f && args.includes('/etc/localtime')) {
      if (!state.install.inChroot) return failState(state, commandLine, 'ln: error: must be in chroot');
      return withCommandProgress(updateInstallFlag(state, commandLine, 'timezoneSet', 'Timezone set.'));
    }
    return failState(state, commandLine, 'ln: unsupported operation');
  }
});

registerCommand({
  name: 'echo',
  execute: (args, flags, state, commandLine) => {
    const rawArgs = args.join(' ');
    if (rawArgs.includes('> /etc/hostname')) {
       if (!state.install.inChroot) return failState(state, commandLine, 'echo: error: must be in chroot');
       return withCommandProgress(updateInstallFlag(state, commandLine, 'hostnameSet', 'Hostname set.'));
    }
    return withCommandProgress(finalizeState(state, [commandLine, createLine('output', args.join(' '))]));
  }
});
