import { useEffect, useRef, useState } from 'react';
import { buildAppPath, buildPublicAssetPath } from './routes';

interface VmRuntimeHandle {
  reset: () => Promise<void>;
  dispose: () => void;
}

type VmStatus = 'idle' | 'starting' | 'running' | 'error';

const ROOTFS_ASSET = 'vm/archlinux.ext2';
const PERSISTENCE_KEY = 'arch-trainer-cheerpx-rootfs';

export function VmPage() {
  const consoleRef = useRef<HTMLPreElement | null>(null);
  const sessionRef = useRef<VmRuntimeHandle | null>(null);
  const [status, setStatus] = useState<VmStatus>('idle');
  const [message, setMessage] = useState('CheerpX is idle. Add a prebuilt ext2 rootfs and start the sandbox when ready.');

  useEffect(() => {
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  async function startVm() {
    if (!consoleRef.current) {
      return;
    }

    sessionRef.current?.dispose();
    sessionRef.current = null;
    setStatus('starting');
    setMessage('Loading CheerpX runtime and mounting the Linux rootfs...');

    try {
      const { launchCheerpXVm } = await import('../features/vm/cheerpx');
      const session = await launchCheerpXVm({
        consoleElement: consoleRef.current,
        persistenceKey: PERSISTENCE_KEY,
        rootfsUrl: buildPublicAssetPath(ROOTFS_ASSET),
      });
      sessionRef.current = session;
      setStatus('running');
      setMessage('Linux sandbox is running. Click inside the console to interact with /bin/bash.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to start the CheerpX sandbox.');
    }
  }

  async function resetVm() {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      setStatus('idle');
      setMessage('Nothing to reset yet. Start the sandbox first.');
      return;
    }

    setStatus('starting');
    setMessage('Resetting the persistent overlay...');

    try {
      await currentSession.reset();
      sessionRef.current = null;
      if (consoleRef.current) {
        consoleRef.current.textContent = '';
      }
      setStatus('idle');
      setMessage('Overlay reset complete. Start the sandbox again for a clean filesystem state.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to reset the VM overlay.');
    }
  }

  function stopVm() {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    if (consoleRef.current) {
      consoleRef.current.textContent = '';
    }
    setStatus('idle');
    setMessage('Linux sandbox stopped.');
  }

  return (
    <main className="app-shell theme-ice">
      <section className="terminal-stage bash-stage">
        <div className="terminal-frame">
          <header className="terminal-topbar">
            <div className="topbar-brand">
              <span className="topbar-title">ARCH TRAINER</span>
              <span className="topbar-divider">|</span>
              <span className="topbar-difficulty">VM LAB</span>
            </div>

            <div className="topbar-actions">
              <a className="topbar-link-button" href={buildAppPath()}>
                Trainer
              </a>
              <a className="topbar-link-button" href={buildAppPath('docs')}>
                Docs
              </a>
              <a className="topbar-link-button" href={buildAppPath('stats')}>
                Stats
              </a>
            </div>
          </header>

          <article className="docs-page vm-page">
            <div className="vm-hero">
              <div className="vm-copy">
                <h1>CheerpX VM Lab</h1>
                <p>
                  Experimental browser Linux sandbox powered by CheerpX. This page is separate from the main Arch
                  Trainer state machine and does not affect leaderboard or replay validation.
                </p>
                <p>
                  For this project, the simulator remains the primary teaching path. The VM lab is a side sandbox for
                  trying a prebuilt Linux rootfs inside the browser.
                </p>
              </div>

              <div className="docs-note vm-note">
                <p>Status: <strong>{status}</strong></p>
                <p>{message}</p>
                <p>Expected rootfs path: /{ROOTFS_ASSET}</p>
                <p>Recommended image format: ext2 rootfs, not a full Arch ISO.</p>
              </div>
            </div>

            <div className="vm-actions">
              <button className="menu-action" onClick={() => void startVm()} type="button">
                Start Sandbox
              </button>
              <button className="menu-action menu-action-secondary" onClick={stopVm} type="button">
                Stop Sandbox
              </button>
              <button className="menu-action menu-action-secondary" onClick={() => void resetVm()} type="button">
                Reset Overlay
              </button>
            </div>

            <div className="vm-grid">
              <section className="docs-note vm-panel">
                <h2>Integration Notes</h2>
                <ul>
                  <li>CheerpX is loaded lazily only on this page.</li>
                  <li>The runtime expects a prebuilt filesystem image in the public static assets.</li>
                  <li>The overlay is persisted in IndexedDB and can be reset from this page.</li>
                  <li>This is an experimental lab, not a replacement for the deterministic trainer core.</li>
                </ul>
              </section>

              <section className="docs-note vm-panel">
                <h2>Suggested Workflow</h2>
                <ul>
                  <li>Use the main trainer for guided install sequencing and replay validation.</li>
                  <li>Use VM Lab for shell experimentation inside a prebuilt Linux userspace.</li>
                  <li>Prepare a custom Arch-like ext2 image if you want closer alignment with the project fantasy.</li>
                </ul>
              </section>
            </div>

            <section className="vm-console-shell">
              <div className="vm-console-header">
                <span>CheerpX console</span>
                <span>{buildPublicAssetPath(ROOTFS_ASSET)}</span>
              </div>
              <pre className="vm-console" ref={consoleRef} tabIndex={0} />
            </section>
          </article>
        </div>
      </section>
    </main>
  );
}