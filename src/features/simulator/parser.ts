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
    } else if (part.startsWith('-')) {
      const flagPart = part.substring(1);
      // Handle cases like -F32 or -v
      if (flagPart.length > 1) {
        // Assume first char is flag name, rest is value (e.g., -F32)
        const key = flagPart[0];
        const value = flagPart.substring(1);
        flags[key] = value;
      } else {
        // Check next part for value (e.g., -F 32)
        const key = flagPart;
        const nextPart = parts[i + 1];
        if (nextPart && !nextPart.startsWith('-')) {
          flags[key] = nextPart;
          i++; // Skip next part
        } else {
          flags[key] = true;
        }
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
