import type { InstallNode, InstallEdge } from './GraphTypes';
import type { InstallStage } from '../../shared/types';

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

export const installNodes: InstallNode[] = [
  {
    id: 'boot',
    type: 'input',
    position: { x: 200, y: 0 },
    data: {
      label: 'Boot Live ISO',
      stage: 'BOOT_LIVE',
      status: 'active',
      description: 'Загрузка live-образа Arch Linux / Boot Arch Linux live ISO',
      commands: ['lsblk'],
    },
  },
  {
    id: 'partition',
    position: { x: 200, y: 100 },
    data: {
      label: 'Partition Disk',
      stage: 'PARTITIONING',
      status: 'locked',
      description: 'Разметка диска / Disk partitioning',
      commands: ['fdisk', 'cfdisk'],
    },
  },
  {
    id: 'format',
    position: { x: 200, y: 200 },
    data: {
      label: 'Format Partitions',
      stage: 'FORMATTING',
      status: 'locked',
      description: 'Форматирование разделов / Format partitions',
      commands: ['mkfs.ext4', 'mkfs.fat', 'mkswap'],
    },
  },
  {
    id: 'mount',
    position: { x: 200, y: 300 },
    data: {
      label: 'Mount Filesystems',
      stage: 'MOUNTING',
      status: 'locked',
      description: 'Монтирование файловых систем / Mount filesystems',
      commands: ['mount', 'swapon'],
    },
  },
  {
    id: 'base',
    position: { x: 200, y: 400 },
    data: {
      label: 'Install Base',
      stage: 'PACSTRAP',
      status: 'locked',
      description: 'Установка базовой системы / Install base system',
      commands: ['pacstrap', 'genfstab'],
    },
  },
  {
    id: 'chroot',
    position: { x: 200, y: 500 },
    data: {
      label: 'Chroot & Config',
      stage: 'CHROOT',
      status: 'locked',
      description: 'Настройка системы / System configuration',
      commands: ['arch-chroot', 'passwd', 'useradd', 'hostnamectl', 'timedatectl'],
    },
  },
  {
    id: 'bootloader',
    position: { x: 200, y: 600 },
    data: {
      label: 'Bootloader',
      stage: 'BOOTLOADER',
      status: 'locked',
      description: 'Установка загрузчика / Bootloader setup',
      commands: ['grub-install', 'grub-mkconfig', 'bootctl', 'mkinitcpio'],
    },
  },
  {
    id: 'complete',
    type: 'output',
    position: { x: 200, y: 700 },
    data: {
      label: 'Complete',
      stage: 'COMPLETE',
      status: 'locked',
      description: 'Установка завершена / Installation complete',
      commands: ['exit'],
    },
  },
];

export const installEdges: InstallEdge[] = [
  { id: 'e1', source: 'boot', target: 'partition', data: { required: true } },
  { id: 'e2', source: 'partition', target: 'format', data: { required: true } },
  { id: 'e3', source: 'format', target: 'mount', data: { required: true } },
  { id: 'e4', source: 'mount', target: 'base', data: { required: true } },
  { id: 'e5', source: 'base', target: 'chroot', data: { required: true } },
  { id: 'e6', source: 'chroot', target: 'bootloader', data: { required: true } },
  { id: 'e7', source: 'bootloader', target: 'complete', data: { required: true } },
];
