import { CommandMiddleware } from './types';

let elapsed = 0;
let commandCount = 0;

export const timerMiddleware: CommandMiddleware = async (command, state, next) => {
  const start = Date.now();
  const result = await next();
  const duration = result.durationMs || (Date.now() - start);
  elapsed += duration;
  commandCount++;
  return result;
};

export function getSessionTimer() {
  return { elapsed, commandCount };
}
