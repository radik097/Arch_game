// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VmPanel } from './VmPanel';

describe('VmPanel', () => {
  afterEach(() => {
    delete window.V86;
  });

  it('keeps the emulator alive while status changes and configures a writable Arch environment', async () => {
    const destroy = vi.fn();
    const stop = vi.fn();
    let capturedOptions: Record<string, unknown> | null = null;

    class MockV86 {
      v86: object | undefined;

      constructor(options: Record<string, unknown>) {
        capturedOptions = options;
      }

      add_listener(event: string, listener: () => void) {
        if (event === 'emulator-ready') {
          queueMicrotask(() => {
            this.v86 = {};
            listener();
          });
        }
      }

      destroy = destroy;
      stop = stop;
    }

    window.V86 = MockV86;
    const view = render(<VmPanel locale="ru" onExit={vi.fn()} terminalMode="vm" theme="emerald" />);
    fireEvent.click(screen.getByRole('button', { name: /запустить систему/i }));

    await waitFor(() => expect(screen.getByText(/система запущена/i)).toBeInTheDocument());
    const options = capturedOptions as unknown as Record<string, unknown> & {
      hda: {
        set: (offset: number, data: Uint8Array, done: () => void) => void;
        get: (offset: number, length: number, done: (data: Uint8Array) => void) => void;
      };
    };
    expect(options).toMatchObject({
      autostart: true,
      bzimage: { url: '/images/vmlinuz-linux' },
      initrd: { url: '/images/initramfs-linux.img' },
      cmdline: expect.stringContaining('/images/archiso/'),
      net_device: { type: 'virtio', relay_url: 'fetch' },
    });
    expect(options).not.toHaveProperty('cdrom');
    expect(options).toHaveProperty('hda.byteLength', 2 * 1024 * 1024 * 1024);
    const disk = options.hda;
    const written = new Uint8Array([1, 2, 3, 4]);
    disk.set(65_534, written, vi.fn());
    disk.get(65_534, written.length, (data) => expect(data).toEqual(written));
    expect(destroy).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();

    view.unmount();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
