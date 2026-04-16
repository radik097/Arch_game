import { SystemState, ExecutionResult } from '../../../shared/types';

export type CommandMiddleware = (
  command: string,
  state: SystemState,
  next: () => Promise<ExecutionResult>
) => Promise<ExecutionResult>;
