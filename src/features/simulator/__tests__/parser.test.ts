import { describe, expect, it } from 'vitest';
import { parseCommandLine } from '../parser';

describe('parseCommandLine', () => {
  it('splits combined short flags without consuming positional arguments', () => {
    expect(parseCommandLine('ln -sf /usr/share/zoneinfo/UTC /etc/localtime')).toMatchObject({
      args: ['/usr/share/zoneinfo/UTC', '/etc/localtime'],
      flags: { s: true, f: true },
    });

    expect(parseCommandLine('umount -R /mnt')).toMatchObject({
      args: ['/mnt'],
      flags: { R: true },
    });
  });

  it('keeps attached short option values', () => {
    expect(parseCommandLine('mkfs.fat -F32 /dev/sda1')).toMatchObject({
      args: ['/dev/sda1'],
      flags: { F: '32' },
    });
  });
});
