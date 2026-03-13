import { describe, expect, it } from 'vitest';
import { completeInput, createInitialState, executeCommand } from '../features/simulator/engine';

function buildInstallSequence() {
  const state = createInitialState('beginner', { seed: 'test-seed-beginner' });
  const efiPartition = state.installTargetDisk.includes('nvme') ? `${state.installTargetDisk}p1` : `${state.installTargetDisk}1`;
  const rootPartition = state.installTargetDisk.includes('nvme') ? `${state.installTargetDisk}p2` : `${state.installTargetDisk}2`;

  return {
    state,
    commands: [
      `fdisk ${state.installTargetDisk}`,
      `mkfs.fat -F32 ${efiPartition}`,
      `mkfs.ext4 ${rootPartition}`,
      `mount ${rootPartition} /mnt`,
      `mount --mkdir ${efiPartition} /mnt/boot`,
      'pacstrap /mnt base linux linux-firmware networkmanager grub efibootmgr',
      'genfstab -U /mnt >> /mnt/etc/fstab',
      'arch-chroot /mnt',
      'ln -sf /usr/share/zoneinfo/UTC /etc/localtime',
      'hwclock --systohc',
      'locale-gen',
      'echo archbox > /etc/hostname',
      'passwd',
      'systemctl enable NetworkManager',
      'grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB',
      'grub-mkconfig -o /boot/grub/grub.cfg',
      'exit',
      'umount -R /mnt',
      'reboot',
    ],
  };
}

function runSequence(initialState: ReturnType<typeof createInitialState>, commands: string[]) {
  return commands.reduce((currentState, command) => executeCommand(currentState, command), initialState);
}

describe('Arch Trainer engine', () => {
  it('blocks pacstrap before target filesystems are mounted', () => {
    const state = createInitialState('beginner', { seed: 'test-seed-pacstrap' });
    const nextState = executeCommand(
      state,
      'pacstrap /mnt base linux linux-firmware networkmanager grub efibootmgr',
    );

    expect(nextState.install.packagesInstalled).toBe(false);
    expect(nextState.history[nextState.history.length - 1]?.text).toContain('mount both /mnt and /mnt/boot');
  });

  it('completes the guided install path and reboots successfully', () => {
    const { state, commands } = buildInstallSequence();
    const finalState = runSequence(state, commands);

    expect(finalState.completed).toBe(true);
    expect(finalState.install.rebooted).toBe(true);
    expect(finalState.history[finalState.history.length - 1]?.text).toContain('Arch Linux installed');
  });

  it('requires wifi recovery in expert mode', () => {
    const initialState = createInitialState('expert', { seed: 'test-seed-expert' });
    const failedPing = executeCommand(initialState, 'ping archlinux.org');
    const wifiInterface = initialState.networkInterfaces.find((networkInterface) => networkInterface.kind === 'wifi');
    const recovered = wifiInterface
      ? executeCommand(executeCommand(failedPing, `ip link set ${wifiInterface.name} up`), `iwctl station ${wifiInterface.name} connect ArchTrainerLab`)
      : failedPing;
    const successfulPing = executeCommand(recovered, 'ping archlinux.org');

    expect(initialState.networkInterfaces.some((networkInterface) => networkInterface.connected)).toBe(false);
    expect(recovered.networkInterfaces.some((networkInterface) => networkInterface.connected)).toBe(true);
    expect(successfulPing.history[successfulPing.history.length - 1]?.text).toContain('0% packet loss');
  });

  it('supports cwd-aware navigation and file inspection', () => {
    const initialState = createInitialState('beginner', { seed: 'test-seed-shell' });
    const inProc = executeCommand(initialState, 'cd /proc');
    const pwdState = executeCommand(inProc, 'pwd');
    const catState = executeCommand(inProc, 'cat cpuinfo');

    expect(inProc.runtime.currentDirectory).toBe('/proc');
    expect(pwdState.history[pwdState.history.length - 1]?.text).toBe('/proc');
    expect(catState.history[catState.history.length - 1]?.text).toContain('model name');
  });

  it('finds pseudo filesystem entries and completes device paths', () => {
    const state = createInitialState('beginner', { seed: 'test-seed-find' });
    const deviceName = state.installTargetDisk.replace('/dev/', '');
    const devicePrefix = state.installTargetDisk.slice(0, -1);
    const findState = executeCommand(state, `find /dev -name ${deviceName}`);
    const completion = completeInput(state, `mkfs.ext4 ${devicePrefix}`);

    expect(findState.history[findState.history.length - 1]?.text).toContain(state.installTargetDisk);
    expect(completion.suggestions.some((item) => item.startsWith(state.installTargetDisk))).toBe(true);
  });

  it('renders realistic /etc and /run live ISO files', () => {
    const state = createInitialState('beginner', { seed: 'test-seed-etc' });
    const hostsState = executeCommand(state, 'cat /etc/hosts');
    const resolvState = executeCommand(state, 'cat /etc/resolv.conf');
    const runState = executeCommand(state, 'cat /run/archiso/airootfs');

    expect(hostsState.history[hostsState.history.length - 1]?.text).toContain('127.0.0.1\tlocalhost');
    expect(hostsState.history[hostsState.history.length - 1]?.text).toContain('archiso');
    expect(resolvState.history[resolvState.history.length - 1]?.text).toContain('nameserver 127.0.0.53');
    expect(runState.history[runState.history.length - 1]?.text).toBe('overlayfs');
  });

  it('renders proc net and sysfs interface files from simulator state', () => {
    const state = createInitialState('beginner', { seed: 'test-seed-netfs' });
    const interfaceName = state.networkInterfaces[0]?.name;
    expect(interfaceName).toBeTruthy();

    const procNetState = executeCommand(state, 'cat /proc/net/dev');
    const operState = executeCommand(state, `cat /sys/class/net/${interfaceName}/operstate`);
    const macState = executeCommand(state, `cat /sys/class/net/${interfaceName}/address`);

    expect(procNetState.history[procNetState.history.length - 1]?.text).toContain(interfaceName as string);
    expect(operState.history[operState.history.length - 1]?.text).toMatch(/up|down|dormant/);
    expect(macState.history[macState.history.length - 1]?.text).toMatch(/^52:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}$/);
  });

  it('returns realistic ping resolution failures for unknown hosts', () => {
    const state = createInitialState('beginner', { seed: 'test-seed-ping' });
    const nextState = executeCommand(state, 'ping unknown.invalid');

    expect(nextState.history[nextState.history.length - 1]?.text).toContain('Name or service not known');
  });
});
