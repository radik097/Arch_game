import type { ParsedCommand } from './types';

/**
 * Parses a raw command string into a structured ParsedCommand object.
 * Supports flags: -F32, -F 32, --long-flag, --flag=value
 */
export function parseCommandLine(input: string): ParsedCommand {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 0) {
    return { command: '', args: [], flags: {}, raw: input };
  }

  const command = parts[0];
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    if (part.startsWith('--')) {
      const splitIndex = part.indexOf('=');
      if (splitIndex !== -1) {
        const key = part.substring(2, splitIndex);
        const value = part.substring(splitIndex + 1);
        flags[key] = value;
      } else {
        const key = part.substring(2);
        flags[key] = true;
      }
    } else if (part.startsWith('-') && part.length > 1) {
      const flagPart = part.substring(1);
      if (/^[A-Za-z]+$/.test(flagPart) && flagPart.length > 1) {
        for (const key of flagPart) {
          flags[key] = true;
        }
      } else if (flagPart.length > 1) {
        // Attached values such as -F32 keep the first character as the key.
        const key = flagPart[0];
        const value = flagPart.substring(1);
        flags[key] = value;
      } else {
        // A standalone short flag must not consume the following positional argument.
        flags[flagPart] = true;
      }
    } else {
      args.push(part);
    }
  }

  return {
    command,
    args,
    flags,
    raw: input,
  };
}
