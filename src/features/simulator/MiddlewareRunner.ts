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

export async function runMiddlewareStack(
  stack: CommandMiddleware[],
  context: { command: string; state: any; result: any },
): Promise<{ command: string; state: any; result: any }> {
  const runner = new MiddlewareRunner(stack);
  try {
    context.result = await runner.run(
      context.command,
      context.state,
      async () => ({
        stdout: '',
        stderr: '',
        exitCode: 0,
        stateChanges: {},
        durationMs: 0,
      }),
    );
  } catch {
    context.result = context.result ?? null;
  }
  return context;
}
