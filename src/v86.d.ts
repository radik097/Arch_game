declare module 'v86' {
  export class V86 {
    constructor(options: Record<string, any>);
    run(): void;
    stop(): void;
    restart(): void;
    destroy(): void;
    is_running(): boolean;
    add_listener(event: string, callback: (...args: any[]) => void): void;
    keyboard_send_scancodes(codes: number[]): void;
    serial0_send(data: string): void;
    v86: any;
  }
  export default V86;
}
