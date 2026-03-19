import React, { useEffect, useRef, useState, useCallback } from 'react';
import './VmPanel.css';

interface VmPanelProps {
  onExit: () => void;
  terminalMode?: 'vm' | 'simulation';
}

declare global {
  interface Window {
    V86: any;
  }
}

export const VmPanel: React.FC<VmPanelProps> = ({ onExit }) => {
  const screenRef = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'booting' | 'ready' | 'error'>('loading');
  const [statusText, setStatusText] = useState('LOADING_WASM...');
  const [memUsage, setMemUsage] = useState('0');

  // Focus the screen container to enable keyboard input
  const focusScreen = useCallback(() => {
    screenRef.current?.focus();
  }, []);

  useEffect(() => {
    let emulator: any = null;
    let memInterval: ReturnType<typeof setInterval> | null = null;

    async function initV86() {
      try {
        setStatus('loading');
        setStatusText('LOADING_V86_ENGINE...');

        const v86Module = await import('v86');
        const V86Constructor = v86Module.V86 || v86Module.default;

        if (!V86Constructor) {
          throw new Error('V86 constructor not found in module');
        }

        if (!screenRef.current) {
          throw new Error('Screen container not mounted');
        }

        setStatusText('INITIALIZING_EMULATOR...');

        const base = import.meta.env.BASE_URL;

        emulator = new V86Constructor({
          wasm_path: `${base}v86.wasm`,
          memory_size: 512 * 1024 * 1024,
          vga_memory_size: 8 * 1024 * 1024,
          screen_container: screenRef.current,
          bios: { url: `${base}images/seabios.bin` },
          vga_bios: { url: `${base}images/vgabios.bin` },
          cdrom: { 
            url: 'https://mirror.archlinux32.org/archisos/archlinux32-2024.07.10-i686.iso', 
            async: true, 
            size: 834666496 
          },
          autostart: true,
          disable_keyboard: false,
          disable_mouse: false,
        });

        emulatorRef.current = emulator;

        setStatus('booting');
        setStatusText('BOOTING_ARCH_ISO...');

        // Auto-focus screen for keyboard input
        setTimeout(focusScreen, 500);

        emulator.add_listener('emulator-ready', () => {
          setStatus('ready');
          setStatusText('SYSTEM_RUNNING');
          focusScreen();
        });

        emulator.add_listener('screen-set-size-graphical', (size: [number, number]) => {
          console.log('Screen resolution:', size[0], 'x', size[1]);
        });

        memInterval = setInterval(() => {
          if (emulator && emulator.v86) {
            try {
              const stats = emulator.v86.cpu?.mem8?.length;
              if (stats) {
                setMemUsage(Math.round(stats / (1024 * 1024)).toString());
              }
            } catch { /* ignore */ }
          }
        }, 2000);
      } catch (err) {
        console.error('V86 initialization failed:', err);
        setStatus('error');
        setStatusText(`ERROR: ${err instanceof Error ? err.message : 'Unknown failure'}`);
      }
    }

    initV86();

    return () => {
      if (memInterval) clearInterval(memInterval);
      if (emulatorRef.current) {
        try {
          emulatorRef.current.stop();
          emulatorRef.current.destroy();
        } catch { /* cleanup */ }
        emulatorRef.current = null;
      }
    };
  }, [focusScreen]);

  // Blur buttons after click so keyboard goes back to VM
  const btnClick = useCallback((handler: () => void) => {
    return (e: React.MouseEvent<HTMLButtonElement>) => {
      handler();
      e.currentTarget.blur();
      setTimeout(focusScreen, 100);
    };
  }, [focusScreen]);

  const handleReboot = () => {
    if (emulatorRef.current) {
      emulatorRef.current.restart();
      setStatus('booting');
      setStatusText('REBOOTING...');
    }
  };

  const handlePause = () => {
    if (emulatorRef.current) {
      if (emulatorRef.current.is_running && emulatorRef.current.is_running()) {
        emulatorRef.current.stop();
        setStatusText('PAUSED');
      } else {
        emulatorRef.current.run();
        setStatusText('SYSTEM_RUNNING');
      }
    }
  };

  return (
    <div className="vm-panel-container">
      <header className="vm-header">
        <div className="vm-status">
          <span className={`status-dot ${status}`}></span>
          <span className="status-text">{statusText}</span>
        </div>
        <div className="vm-controls">
          <button className="vm-btn" onClick={btnClick(handlePause)}>PAUSE</button>
          <button className="vm-btn" onClick={btnClick(handleReboot)}>REBOOT</button>
          <button className="vm-btn exit" onClick={onExit}>EXIT_TO_MAP</button>
        </div>
      </header>

      <main className="vm-main">
        {status === 'loading' && (
          <div className="vm-loading-overlay">
            <div className="spinner"></div>
            <p>{statusText}</p>
            <p className="loading-hint">Loading V86 WASM engine and Arch ISO...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="vm-error-overlay">
            <p className="error-icon">⚠</p>
            <p className="error-text">{statusText}</p>
            <button className="vm-btn" onClick={() => window.location.reload()}>RETRY</button>
          </div>
        )}

        <div
          id="screen_container"
          ref={screenRef}
          className="screen-container"
          tabIndex={0}
          onClick={focusScreen}
          style={{ outline: 'none' }}
        >
          <div style={{ whiteSpace: 'pre', font: '14px monospace', lineHeight: '14px' }}></div>
          <canvas style={{ display: 'none' }}></canvas>
        </div>
      </main>

      <footer className="vm-footer">
        <div className="keyboard-hint">Click screen to type • Buttons return focus to VM</div>
        <div className="stats">CPU: i686 | RAM: 512MB | ISO: arch32</div>
      </footer>
    </div>
  );
};
