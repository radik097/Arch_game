import { runMiddlewareStack } from '../MiddlewareRunner';
import { randomFailureMiddleware } from '../middleware/randomFailureMiddleware';
import { hintMiddleware } from '../middleware/hintMiddleware';
import { timerMiddleware } from '../middleware/timerMiddleware';
import { auditMiddleware } from '../middleware/auditMiddleware';

describe('Middleware', () => {
  it('should run all middleware and return context', async () => {
    const stack = [randomFailureMiddleware, hintMiddleware, timerMiddleware, auditMiddleware];
    const context = { command: 'test', state: {}, result: null };
    const result = await runMiddlewareStack(stack, context);
    expect(result).toHaveProperty('command');
    expect(result).toHaveProperty('state');
  });
});
