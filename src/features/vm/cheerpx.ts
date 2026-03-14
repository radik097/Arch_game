interface VmCommand {
  fileName: string;
  args: string[];
  env?: string[];
  cwd?: string;
}

export interface VmLaunchOptions {
  consoleElement: HTMLElement;
  rootfsUrl: string;
  persistenceKey: string;
  command?: VmCommand;
}

export interface VmSession {
  reset: () => Promise<void>;
  dispose: () => void;
}

interface CheerpXDevice {
  delete: () => void;
}

interface CheerpXIdbDevice extends CheerpXDevice {
  reset: () => Promise<void>;
}

interface CheerpXLinux {
  delete: () => void;
  run: (fileName: string, args: string[], optionals?: { env?: string[]; cwd?: string }) => Promise<{ status: number }>;
  setConsole: (element: HTMLElement) => void;
}

interface CheerpXRuntimeModule {
  HttpBytesDevice: {
    create: (url: string) => Promise<CheerpXDevice>;
  };
  IDBDevice: {
    create: (devName: string) => Promise<CheerpXIdbDevice>;
  };
  OverlayDevice: {
    create: (src: CheerpXDevice, idb: CheerpXIdbDevice) => Promise<CheerpXDevice>;
  };
  Linux: {
    create: (options?: { mounts?: unknown }) => Promise<CheerpXLinux>;
  };
}

type MountPoint =
  | { type: 'ext2'; path: string; dev: object }
  | { type: 'devs'; path: string }
  | { type: 'proc'; path: string }
  | { type: 'devpts'; path: string };

const CHEERPX_CDN_VERSION = '1.2.9';

export async function launchCheerpXVm(options: VmLaunchOptions): Promise<VmSession> {
  await assertRootfsExists(options.rootfsUrl);

  const { HttpBytesDevice, IDBDevice, Linux, OverlayDevice } = await loadCheerpXRuntime();
  const blockDevice = await HttpBytesDevice.create(options.rootfsUrl);
  const idbDevice = await IDBDevice.create(options.persistenceKey);
  const overlayDevice = await OverlayDevice.create(blockDevice, idbDevice);
  const mountPoints: MountPoint[] = [
    { type: 'ext2', path: '/', dev: overlayDevice },
    { type: 'devs', path: '/dev' },
    { type: 'devpts', path: '/dev/pts' },
    { type: 'proc', path: '/proc' },
  ];

  const linux = await Linux.create({
    mounts: mountPoints as unknown as never,
  });

  options.consoleElement.textContent = '';
  linux.setConsole(options.consoleElement);

  const command = options.command ?? {
    fileName: '/bin/bash',
    args: [],
    env: ['TERM=xterm', 'HOME=/root', 'PATH=/usr/bin:/bin'],
    cwd: '/root',
  };

  void linux.run(command.fileName, command.args, {
    env: command.env,
    cwd: command.cwd,
  });

  return createVmSession(linux, idbDevice, [overlayDevice, blockDevice, idbDevice]);
}

async function assertRootfsExists(url: string): Promise<void> {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`CheerpX rootfs not found at ${url}. Add a prebuilt ext2 image before starting the VM page.`);
  }
}

function createVmSession(linux: CheerpXLinux, idbDevice: { reset: () => Promise<void> }, devices: Array<{ delete: () => void }>): VmSession {
  let closed = false;

  const dispose = () => {
    if (closed) {
      return;
    }

    closed = true;
    linux.delete();
    for (const device of devices) {
      try {
        device.delete();
      } catch {
        // Ignore teardown failures from the proprietary runtime.
      }
    }
  };

  return {
    async reset() {
      dispose();
      await idbDevice.reset();
    },
    dispose,
  };
}

async function loadCheerpXRuntime(): Promise<CheerpXRuntimeModule> {
  const runtimeUrl = `https://cxrtnc.leaningtech.com/${CHEERPX_CDN_VERSION}/cx.esm.js`;
  return (await import(/* @vite-ignore */ runtimeUrl)) as CheerpXRuntimeModule;
}