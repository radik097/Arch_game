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
  const [status, setStatus] = useState<'setup' | 'loading' | 'booting' | 'ready' | 'error'>('setup');
  const [config, setConfig] = useState({
    memorySize: 512, // MB
    bootMode: 'iso' as 'iso' | '9p',
  });
  const [statusText, setStatusText] = useState('SYSTEM_IDLE');
  const [memUsage, setMemUsage] = useState('0');
  const [isFocused, setIsFocused] = useState(false);

  // Focus the screen container to enable keyboard input
  const focusScreen = useCallback(() => {
    if (status === 'ready') {
      screenRef.current?.focus();
    }
  }, [status]);

  const startV86 = () => {
    setStatus('loading');
  };

  useEffect(() => {
    if (status === 'setup' || status === 'error') return;

    let emulator: any = null;
    let memInterval: ReturnType<typeof setInterval> | null = null;

    async function initV86() {
      try {
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

        const options: any = {
          wasm_path: `${base}v86.wasm`,
          memory_size: config.memorySize * 1024 * 1024,
          vga_memory_size: 8 * 1024 * 1024,
          screen_container: screenRef.current,
          bios: { url: `${base}images/seabios.bin` },
          vga_bios: { url: `${base}images/vgabios.bin` },
          autostart: true,
          disable_keyboard: false,
          disable_mouse: false,
        };

        if (config.bootMode === 'iso') {
          options.cdrom = { 
            url: `${base}images/arch.iso`, 
            async: true, 
            size: 834666496 
          };
        } else {
          // 9p mode
          options.filesystem = {
            baseurl: `${base}images/arch/`,
            basefs: `${base}images/fs.json`,
          };
          options.bzimage_initrd_from_filesystem = true;
          options.cmdline = [
            "rw",
            "root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose",
            "init=/usr/bin/init-openrc",
          ].join(" ");
        }

        emulator = new V86Constructor(options);

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

    if (status === 'loading') {
      initV86();
    }

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
  }, [status, config.memorySize, focusScreen]);


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

  const handleSaveState = async () => {
    if (emulatorRef.current) {
      try {
        const state = await emulatorRef.current.save_state();
        const a = document.createElement('a');
        a.download = 'v86state.bin';
        const blob = new Blob([state], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.click();
        window.URL.revokeObjectURL(url);
        setStatusText('STATE_SAVED');
      } catch (err) {
        console.error('Failed to save state:', err);
        setStatusText('SAVE_FAILED');
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreState = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length && emulatorRef.current) {
      const file = e.target.files[0];
      const filereader = new FileReader();
      
      setStatusText('RESTORING...');

      filereader.onload = async (event) => {
        try {
          if (event.target?.result instanceof ArrayBuffer) {
            await emulatorRef.current.restore_state(event.target.result);
            emulatorRef.current.run();
            setStatusText('STATE_RESTORED');
            focusScreen();
          }
        } catch (err) {
          console.error('Failed to restore state:', err);
          setStatusText('RESTORE_FAILED');
        }
      };
      filereader.readAsArrayBuffer(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
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
          {status !== 'setup' && (
            <>
              <button className="vm-btn" onClick={btnClick(handlePause)}>PAUSE</button>
              <button className="vm-btn" onClick={btnClick(handleReboot)}>REBOOT</button>
            </>
          )}
          <button className="vm-btn" onClick={btnClick(handleSaveState)}>EXPORT_STATE</button>
          <button className="vm-btn" onClick={btnClick(handleRestoreClick)}>IMPORT_STATE</button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleRestoreState} 
            style={{ display: 'none' }} 
            accept=".bin"
          />
          <button className="vm-btn exit" onClick={onExit}>EXIT_TO_MAP</button>
        </div>
      </header>

      <main className="vm-main">
        {status === 'setup' && (
          <div className="vm-setup-overlay">
            <div className="setup-card">
              <div className="setup-header">
                <span className="setup-icon">⚛</span>
                <h2>VM_CONFIGURATION</h2>
              </div>
              
              <div className="setup-body">
                <div className="setting-group">
                  <label>SYSTEM_MEMORY_ALLOCATION</label>
                  <div className="memory-slider-container">
                    <input 
                      type="range" 
                      min="256" 
                      max="8192" 
                      step="256"
                      value={config.memorySize}
                      onChange={(e) => setConfig({ ...config, memorySize: parseInt(e.target.value) })}
                      className="memory-slider"
                    />
                    <div className="memory-display">
                      <span className="memory-value">{config.memorySize}</span>
                      <span className="memory-unit">MB</span>
                      {config.memorySize >= 1024 && (
                        <span className="memory-gb-hint">
                          ({(config.memorySize / 1024).toFixed(1)} GB)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="setting-group">
                  <label>SYSTEM_BOOT_MODE</label>
                  <div className="mode-selector">
                    <button 
                      className={`mode-option ${config.bootMode === 'iso' ? 'active' : ''}`}
                      onClick={() => setConfig({ ...config, bootMode: 'iso' })}
                    >
                      CD-ROM (ISO)
                    </button>
                    <button 
                      className={`mode-option ${config.bootMode === '9p' ? 'active' : ''}`}
                      onClick={() => setConfig({ ...config, bootMode: '9p' })}
                    >
                      NETWORK (9p)
                    </button>
                  </div>
                </div>

                <div className="setting-group">
                  <label>HARDWARE_OVERVIEW</label>
                  <div className="source-info">
                    {config.bootMode === 'iso' ? (
                      <>
                        <span className="source-tag">ARCH_32_ISO</span>
                        <span className="source-path">/images/arch.iso</span>
                      </>
                    ) : (
                      <>
                        <span className="source-tag">9P_FILESYSTEM</span>
                        <span className="source-path">/images/arch/fs.json</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="setup-actions">
                  {config.bootMode === '9p' && (
                    <div className="asset-warning">
                      ⚠️ FS_NETWORK_MODE requires /images/arch/fs.json (Not Found). 
                      Please use CD-ROM mode unless you have the custom filesystem assets.
                    </div>
                  )}
                  <button 
                    className="start-btn" 
                    onClick={startV86}
                    disabled={config.bootMode === '9p'}
                    title={config.bootMode === '9p' ? 'Assets missing for 9p boot' : ''}
                  >
                    <span className="btn-glitch">START_SYSTEM</span>
                  </button>
                </div>
              </div>
              
              <div className="setup-footer">
                <p>Verify hardware allocation before engine initialization.</p>
              </div>
            </div>
          </div>
        )}

        {(status === 'loading' || status === 'booting') && (
          <div className="vm-loading-overlay">
            <div className="spinner"></div>
            <p>{statusText}</p>
            <p className="loading-hint">Initializing V86 engine • Allocating {config.memorySize}MB RAM...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="vm-error-overlay">
            <p className="error-icon">⚠</p>
            <p className="error-text">{statusText}</p>
            <button className="vm-btn" onClick={() => window.location.reload()}>RETRY</button>
          </div>
        )}

        <div className="vm-layout-horizontal">
          <div
            id="screen_container"
            ref={screenRef}
            className={`screen-container ${status === 'ready' ? 'visible' : 'hidden'} ${isFocused ? 'focused' : ''}`}
            tabIndex={0}
            onClick={focusScreen}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{ outline: 'none' }}
          >
            <div style={{ whiteSpace: 'pre', font: '14px monospace', lineHeight: '14px' }}></div>
            <canvas style={{ display: 'none' }}></canvas>
          </div>

          {(status === 'ready' || status === 'booting') && (
            <aside className="simulation-sidebar vm-sidebar">
              <div className="sidebar-header">
                <h3>VM_HARDWARE_METRICS</h3>
                <div className={`status-badge ${isFocused ? 'active-focus' : ''}`}>
                  {isFocused ? 'FOCUSED' : 'ACTIVE'}
                </div>
              </div>
              
              <div className="sidebar-section">
                <h4>INPUT_DEVICE</h4>
                <button 
                  className={`vm-btn focus-btn ${isFocused ? 'active' : ''}`}
                  onClick={focusScreen}
                >
                  {isFocused ? 'TERMINAL_FOCUSED' : 'FOCUS_TERMINAL_INPUT'}
                </button>
              </div>

              <div className="sidebar-section">
                <h4>RESOURCE_USAGE</h4>
                <div className="metrics-list">
                  <div className="metric-item">
                    <label>CPU_LOAD</label>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${Math.floor(Math.random() * 15) + (status === 'ready' ? 5 : 45)}%` }}></div>
                    </div>
                  </div>
                  <div className="metric-item">
                    <label>RAM_ALLOCATED</label>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${Math.min(100, (config.memorySize / 8192) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sidebar-section">
                <h4>VM_SPECIFICATIONS</h4>
                <div className="hardware-grid">
                  <div className="hw-item">
                    <span className="hw-label">ARCH</span>
                    <span className="hw-value">i686</span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-label">MEM</span>
                    <span className="hw-value">{config.memorySize}MB</span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-label">BOOT</span>
                    <span className="hw-value">{config.bootMode.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className="sidebar-section">
                <h4>V86_TASKS</h4>
                <div className="status-grid">
                  <div className={`status-item complete`}>INIT_ENGINE</div>
                  <div className={`status-item ${status === 'ready' ? 'complete' : ''}`}>LOAD_KERNEL</div>
                  <div className={`status-item`}>USER_LOGIN</div>
                </div>
              </div>

              <div className="sidebar-footer">
                <button className="vm-btn" onClick={handleSaveState}>SAVE_STATE</button>
                <div style={{ height: '8px' }}></div>
                <button className="vm-btn" onClick={handleRestoreClick}>RESTORE_STATE</button>
              </div>
            </aside>
          )}
        </div>
      </main>

      <footer className="vm-footer">
        <div className="keyboard-hint">Click screen to type • Buttons return focus to VM</div>
        <div className="stats">CPU: i686 | RAM: {config.memorySize}MB | MODE: {config.bootMode.toUpperCase()}</div>
      </footer>
    </div>
  );
};
