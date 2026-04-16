import { CommandMiddleware } from './types';
import { SystemState, ExecutionResult } from '../../../shared/types';

const FAILURE_COMMANDS = ['pacstrap', 'pacman', 'curl'];

export const randomFailureMiddleware: CommandMiddleware = async (command, state, next) => {
  const cmd = command.split(' ')[0];
  const isExpert = state.currentStage === 'PACSTRAP' || state.currentStage === 'CHROOT';
  const isGod = state.currentStage === 'BOOTLOADER';
  let failChance = 0;
  if (isGod) failChance = 0.25;
  else if (isExpert) failChance = 0.15;
  if (FAILURE_COMMANDS.includes(cmd) && Math.random() < failChance) {
    return {
      stdout: '',
      stderr: {
        ru: 'ошибка: не удалось получить файл core.db: сервер вернул ошибку 404',
        en: 'error: failed to retrieve file core.db: The requested URL returned error: 404',
      }[state.locale === 'ru_RU' ? 'ru' : 'en'],
      exitCode: 1,
      stateChanges: {},
      durationMs: 100,
    };
  }
  // God mode: случайные сбои монтирования
  if (isGod && cmd === 'mount' && Math.random() < 0.25) {
    return {
      stdout: '',
      stderr: {
        ru: 'mount: неизвестная ошибка устройства',
        en: 'mount: unknown device error',
      }[state.locale === 'ru_RU' ? 'ru' : 'en'],
      exitCode: 1,
      stateChanges: {},
      durationMs: 50,
    };
  }
  return next();
};
