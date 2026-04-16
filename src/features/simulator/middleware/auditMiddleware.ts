import { CommandMiddleware } from './types';
 
async function sha256(str: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const enc = new TextEncoder();
    const buffer = await window.crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash * 31 + str.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

let lastHash = '';
const replayLog: Array<{
  command: string;
  stdoutHash: string;
  stateHash: string;
  timestamp: number;
}> = [];

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
