import { CommandMiddleware } from './middleware/types';
import { DifficultyMode } from './SimulatorEngine';
import { randomFailureMiddleware } from './middleware/randomFailureMiddleware';
import { hintMiddleware } from './middleware/hintMiddleware';
import { timerMiddleware } from './middleware/timerMiddleware';
import { auditMiddleware } from './middleware/auditMiddleware';

export class MiddlewareRunner {
  private middlewares: CommandMiddleware[];
  constructor(middlewares: CommandMiddleware[]) {
    this.middlewares = middlewares;
  }
  run(command: string, state: any, handler: () => Promise<any>): Promise<any> {
    let idx = -1;
    const dispatch = (): Promise<any> => {
      idx++;
      if (idx < this.middlewares.length) {
        return this.middlewares[idx](command, state, dispatch);
      }
      return handler();
    };
    return dispatch();
  }
}

export function createMiddlewareStack(difficulty: DifficultyMode): CommandMiddleware[] {
  const stack: CommandMiddleware[] = [auditMiddleware];
  if (difficulty === 'beginner') stack.push(hintMiddleware);
  if (['experienced', 'expert', 'god'].includes(difficulty)) stack.push(timerMiddleware);
  if (['expert', 'god'].includes(difficulty)) stack.push(randomFailureMiddleware);
  return stack;
}
