import { CommandMiddleware } from './types';
import { SystemState, ExecutionResult } from '../../../shared/types';

const HINTS: Record<string, { ru: string; en: string }> = {
  lsblk: {
    ru: 'lsblk — покажет список дисков и разделов.',
    en: 'lsblk — shows the list of disks and partitions.',
  },
  fdisk: {
    ru: 'fdisk/cfdisk — для разметки диска.',
    en: 'fdisk/cfdisk — for disk partitioning.',
  },
  'mkfs.ext4': {
    ru: 'mkfs.ext4 — форматирует раздел в ext4.',
    en: 'mkfs.ext4 — formats partition as ext4.',
  },
  mount: {
    ru: 'mount — примонтируйте раздел к /mnt.',
    en: 'mount — mount partition to /mnt.',
  },
  pacstrap: {
    ru: 'pacstrap — установит базовую систему.',
    en: 'pacstrap — installs the base system.',
  },
  genfstab: {
    ru: 'genfstab — сгенерирует fstab.',
    en: 'genfstab — generates fstab.',
  },
  'arch-chroot': {
    ru: 'arch-chroot — переход в установленную систему.',
    en: 'arch-chroot — switch to installed system.',
  },
  passwd: {
    ru: 'passwd — задайте пароль root.',
    en: 'passwd — set root password.',
  },
  useradd: {
    ru: 'useradd — создайте нового пользователя.',
    en: 'useradd — add a new user.',
  },
  hostnamectl: {
    ru: 'hostnamectl — задайте имя хоста.',
    en: 'hostnamectl — set hostname.',
  },
  timedatectl: {
    ru: 'timedatectl — настройте часовой пояс.',
    en: 'timedatectl — set timezone.',
  },
  'grub-install': {
    ru: 'grub-install — установка загрузчика GRUB.',
    en: 'grub-install — install GRUB bootloader.',
  },
  'grub-mkconfig': {
    ru: 'grub-mkconfig — генерация конфигурации GRUB.',
    en: 'grub-mkconfig — generate GRUB config.',
  },
  bootctl: {
    ru: 'bootctl — установка systemd-boot.',
    en: 'bootctl — install systemd-boot.',
  },
  mkinitcpio: {
    ru: 'mkinitcpio — генерация initramfs.',
    en: 'mkinitcpio — generate initramfs.',
  },
  exit: {
    ru: 'exit — завершить установку.',
    en: 'exit — finish installation.',
  },
};

export const hintMiddleware: CommandMiddleware = async (command, state, next) => {
  const result = await next();
  const cmd = command.split(' ')[0];
  if (state.locale && HINTS[cmd]) {
    const hint = HINTS[cmd][state.locale.startsWith('ru') ? 'ru' : 'en'];
    return {
      ...result,
      stdout: result.stdout + '\n' + hint,
    };
  }
  return result;
};
