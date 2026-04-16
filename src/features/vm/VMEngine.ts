import { IExecutionEngine, SystemState, ExecutionResult, DEFAULT_SYSTEM_STATE } from '../../shared/types';

// Заглушка для v86 API
interface V86API {
  sendCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  getState(): Partial<SystemState>;
}

export class VMEngine implements IExecutionEngine {
  public readonly mode = 'vm' as const;
  private v86: V86API;
  private state: SystemState;

  constructor(v86: V86API) {
    this.v86 = v86;
    this.state = { ...DEFAULT_SYSTEM_STATE };
  }

  async execute(command: string): Promise<ExecutionResult> {
    let result: { stdout: string; stderr: string; exitCode: number };
    let timedOut = false;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => {
        timedOut = true;
        reject(new Error('VM timeout'));
      }, 30000)
    );
    try {
      result = await Promise.race([
        this.v86.sendCommand(command),
        timeout,
      ]);
    } catch (e) {
      return {
        stdout: '',
        stderr: timedOut ? 'VM did not respond in 30s' : String(e),
        exitCode: 124,
        stateChanges: {},
        durationMs: 30000,
      };
    }
    // Обновляем только те поля, которые можно получить из VM
    const vmState = this.v86.getState();
    this.setState(vmState);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      stateChanges: vmState,
      durationMs: 100,
    };
  }

  getState(): SystemState {
    return { ...this.state };
  }

  setState(state: Partial<SystemState>): void {
    this.state = { ...this.state, ...state };
  }

  reset(): void {
    this.state = { ...DEFAULT_SYSTEM_STATE };
  }

  supportsCommand(command: string): boolean {
    // В режиме VM поддерживаются все команды bash
    return true;
  }
}
