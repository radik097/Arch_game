import { CommandMiddleware } from './types';
import { SystemState, ExecutionResult } from '../../../shared/types';

const crypto = typeof window !== 'undefined' && window.crypto ? window.crypto : require('crypto');

let lastHash = '';
const replayLog: Array<{
  command: string;
  stdoutHash: string;
  stateHash: string;
  timestamp: number;
}> = [];

function sha256(str: string): string {
  if (crypto.subtle) {
    // Browser
    const enc = new TextEncoder();
    return crypto.subtle.digest('SHA-256', enc.encode(str)).then((buf: ArrayBuffer) =>
      Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    );
  } else {
    // Node
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}

export const auditMiddleware: CommandMiddleware = async (command, state, next) => {
  const result = await next();
  const stateStr = JSON.stringify(state);
  const stdoutHash = await sha256(result.stdout);
  const stateHash = await sha256(stateStr + lastHash);
  lastHash = stateHash;
  replayLog.push({
    command,
    stdoutHash,
    stateHash,
    timestamp: Date.now(),
  });
  return result;
};

export function getReplayLog() {
  return replayLog;
}
