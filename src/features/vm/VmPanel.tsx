import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APP_TEXT, type AppLanguage, type AppThemeId } from '../../shared/i18n';
import './VmPanel.css';

interface VmPanelProps {
  locale: AppLanguage;
  onExit: () => void;
  terminalMode?: 'vm' | 'simulation';
  theme: AppThemeId;
}

type VmStatusTextKey = keyof typeof APP_TEXT.ru.vm.statuses;

declare global {
  interface Window {
    V86: any;
  }
}

export const VmPanel: React.FC<VmPanelProps> = ({ locale, onExit, theme }) => {
  const text = APP_TEXT[locale].vm;
  const screenRef = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<'setup' | 'loading' | 'booting' | 'ready' | 'error'>('setup');
  const [statusTextKey, setStatusTextKey] = useState<VmStatusTextKey>('systemIdle');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    memorySize: 512,
    bootMode: 'iso' as 'iso' | '9p',
  });
  const [memUsage, setMemUsage] = useState('0');
  const [isFocused, setIsFocused] = useState(false);

  const statusText = statusError ?? text.statuses[statusTextKey];

  const focusScreen = useCallback(() => {
    if (status === 'ready') {
      screenRef.current?.focus();
    }
  }, [status]);

  const startV86 = () => {
    setStatus('loading');
    setStatusError(null);
    setStatusTextKey('loadingEngine');
  };

  useEffect(() => {
    if (status === 'setup' || status === 'error') {
      return;
    }

    let emulator: any = null;
    let memInterval: ReturnType<typeof setInterval> | null = null;

    async function initV86() {
      try {
        setStatusTextKey('loadingEngine');

        const base = import.meta.env.BASE_URL || '/';

        if (!window.V86) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${base}libv86.js`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load libv86.js script'));
            document.body.appendChild(script);
          });
        }

        const V86Constructor = window.V86;
        if (!V86Constructor) {
          throw new Error('V86 constructor not found in global scope');
        }

        if (!screenRef.current) {
          throw new Error('Screen container not mounted');
        }

        setStatusTextKey('initializing');

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
          hda: {
            size: 2 * 1024 * 1024 * 1024,
          },
          boot_order: 'dca',
        };

        if (config.bootMode === 'iso') {
          options.cdrom = {
            url: `${base}images/arch.iso`,
            async: true,
            size: 834666496,
          };
        } else {
          options.filesystem = {
            baseurl: `${base}images/arch/`,
            basefs: `${base}images/fs.json`,
          };
          options.bzimage_initrd_from_filesystem = true;
          options.cmdline = [
            'rw',
            'root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose',
            'init=/usr/bin/init-openrc',
          ].join(' ');
        }

        emulator = new V86Constructor(options);
        emulatorRef.current = emulator;

        setStatus('booting');
        setStatusTextKey('booting');
        setTimeout(focusScreen, 500);

        emulator.add_listener('emulator-ready', () => {
          setStatus('ready');
          setStatusTextKey('running');
          focusScreen();
        });

        memInterval = setInterval(() => {
          if (emulator && emulator.v86) {
            try {
              const stats = emulator.v86.cpu?.mem8?.length;
              if (stats) {
                setMemUsage(Math.round(stats / (1024 * 1024)).toString());
              }
            } catch {
              // ignore
            }
          }
        }, 2000);
      } catch (err) {
        setStatus('error');
        setStatusError(err instanceof Error ? err.message : 'Unknown failure');
      }
    }

    if (status === 'loading') {
      void initV86();
    }

    return () => {
      if (memInterval) {
        clearInterval(memInterval);
      }
      if (emulatorRef.current) {
        try {
          emulatorRef.current.stop();
          emulatorRef.current.destroy();
        } catch {
          // cleanup
        }
        emulatorRef.current = null;
      }
    };
  }, [config.bootMode, config.memorySize, focusScreen, status]);

  const btnClick = useCallback((handler: () => void) => {
    return (event: React.MouseEvent<HTMLButtonElement>) => {
      handler();
      event.currentTarget.blur();
      setTimeout(focusScreen, 100);
    };
  }, [focusScreen]);

  const handleReboot = () => {
    if (emulatorRef.current) {
      emulatorRef.current.restart();
      setStatus('booting');
      setStatusError(null);
      setStatusTextKey('rebooting');
    }
  };

  const handlePause = () => {
    if (emulatorRef.current) {
      if (emulatorRef.current.is_running && emulatorRef.current.is_running()) {
        emulatorRef.current.stop();
        setStatusTextKey('paused');
      } else {
        emulatorRef.current.run();
        setStatusTextKey('running');
      }
    }
  };

  const handleSaveState = async () => {
    if (emulatorRef.current) {
      try {
        const state = await emulatorRef.current.save_state();
        const anchor = document.createElement('a');
        anchor.download = 'v86state.bin';
        const blob = new Blob([state], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        anchor.href = url;
        anchor.click();
        window.URL.revokeObjectURL(url);
        setStatusTextKey('stateSaved');
        setStatusError(null);
      } catch {
        setStatusTextKey('saveFailed');
      }
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleRestoreState = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length && emulatorRef.current) {
      const file = event.target.files[0];
      const fileReader = new FileReader();

      setStatusTextKey('restoring');
      fileReader.onload = async (readerEvent) => {
        try {
          if (readerEvent.target?.result instanceof ArrayBuffer) {
            await emulatorRef.current.restore_state(readerEvent.target.result);
            emulatorRef.current.run();
            setStatusTextKey('restored');
            focusScreen();
          }
        } catch {
          setStatusTextKey('restoreFailed');
        }
      };

      fileReader.readAsArrayBuffer(file);
      event.target.value = '';
    }
  };

  return (
    <div className={`vm-panel-container theme-${theme}`}>
      <header className="vm-header">
        <div className="vm-header__brand">
          <div className="vm-status">
            <span className={`status-dot ${status}`}></span>
            <span className="status-text">{statusText}</span>
          </div>
        </div>

        <div className="vm-controls">
          {status !== 'setup' ? (
            <>
              <button className="vm-btn" onClick={btnClick(handlePause)} type="button">{text.pause}</button>
              <button className="vm-btn" onClick={btnClick(handleReboot)} type="button">{text.reboot}</button>
            </>
          ) : null}
          <button className="vm-btn" onClick={btnClick(handleSaveState)} type="button">{text.exportState}</button>
          <button className="vm-btn" onClick={btnClick(handleRestoreClick)} type="button">{text.importState}</button>
          <input
            accept=".bin"
            onChange={handleRestoreState}
            ref={fileInputRef}
            style={{ display: 'none' }}
            type="file"
          />
          <button className="vm-btn vm-btn--danger" onClick={onExit} type="button">{text.exit}</button>
        </div>
      </header>

      <main className="vm-main">
        {status === 'setup' ? (
          <div className="vm-overlay">
            <section className="vm-card">
              <div className="vm-card__header">
                <p className="vm-card__eyebrow">ARCH TRAINER VM</p>
                <h1>{text.configTitle}</h1>
              </div>

              <div className="vm-card__section">
                <label>{text.memory}</label>
                <div className="memory-slider-container">
                  <input
                    className="memory-slider"
                    max="8192"
                    min="256"
                    onChange={(event) => setConfig({ ...config, memorySize: parseInt(event.target.value, 10) })}
                    step="256"
                    type="range"
                    value={config.memorySize}
                  />
                  <div className="memory-display">
                    <span className="memory-value">{config.memorySize}</span>
                    <span className="memory-unit">MB</span>
                    {config.memorySize >= 1024 ? (
                      <span className="memory-gb-hint">({(config.memorySize / 1024).toFixed(1)} GB)</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="vm-card__section">
                <label>{text.bootMode}</label>
                <div className="mode-selector">
                  <button
                    className={`mode-option${config.bootMode === 'iso' ? ' active' : ''}`}
                    onClick={() => setConfig({ ...config, bootMode: 'iso' })}
                    type="button"
                  >
                    {text.cdrom}
                  </button>
                  <button
                    className={`mode-option${config.bootMode === '9p' ? ' active' : ''}`}
                    onClick={() => setConfig({ ...config, bootMode: '9p' })}
                    type="button"
                  >
                    {text.network}
                  </button>
                </div>
              </div>

              <div className="vm-card__section">
                <label>{text.overview}</label>
                <div className="source-info">
                  {config.bootMode === 'iso' ? (
                    <>
                      <span className="source-tag">{text.cdrom}</span>
                      <span className="source-path">/images/arch.iso</span>
                    </>
                  ) : (
                    <>
                      <span className="source-tag">{text.network}</span>
                      <span className="source-path">/images/arch/fs.json</span>
                    </>
                  )}
                </div>
              </div>

              {config.bootMode === '9p' ? (
                <div className="asset-warning">{text.assetWarning}</div>
              ) : null}

              <div className="setup-actions">
                <button
                  className="vm-btn vm-btn--primary"
                  disabled={config.bootMode === '9p'}
                  onClick={startV86}
                  title={config.bootMode === '9p' ? text.assetWarning : ''}
                  type="button"
                >
                  {text.start}
                </button>
              </div>

              <p className="vm-card__footer">{text.footer}</p>
            </section>
          </div>
        ) : null}

        {status === 'loading' || status === 'booting' ? (
          <div className="vm-overlay">
            <div className="vm-loading">
              <div className="spinner"></div>
              <p>{statusText}</p>
              <small>{text.loadingHint}</small>
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="vm-overlay">
            <div className="vm-loading">
              <p>{statusError}</p>
              <button className="vm-btn" onClick={() => window.location.reload()} type="button">{text.retry}</button>
            </div>
          </div>
        ) : null}

        <div className="vm-layout">
          <div
            className={`screen-container ${status === 'ready' ? 'visible' : 'hidden'} ${isFocused ? 'focused' : ''}`}
            id="screen_container"
            onBlur={() => setIsFocused(false)}
            onClick={focusScreen}
            onFocus={() => setIsFocused(true)}
            ref={screenRef}
            style={{ outline: 'none' }}
            tabIndex={0}
          >
            <div style={{ whiteSpace: 'pre', font: '14px monospace', lineHeight: '14px' }}></div>
            <canvas style={{ display: 'none' }}></canvas>
          </div>

          {status === 'ready' || status === 'booting' ? (
            <aside className="vm-sidebar">
              <section className="vm-sidebar__section">
                <div className="vm-sidebar__header">
                  <h3>{text.metrics}</h3>
                  <div className={`vm-sidebar__badge ${isFocused ? 'is-focused' : ''}`}>
                    {isFocused ? text.focused : text.active}
                  </div>
                </div>
                <button className={`vm-btn vm-btn--full${isFocused ? ' is-active' : ''}`} onClick={focusScreen} type="button">
                  {isFocused ? text.focused : text.focusInput}
                </button>
              </section>

              <section className="vm-sidebar__section">
                <h4>{text.resources}</h4>
                <div className="metrics-list">
                  <div className="metric-item">
                    <label>{text.cpuLoad}</label>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${Math.floor(Math.random() * 15) + (status === 'ready' ? 5 : 45)}%` }}></div>
                    </div>
                  </div>
                  <div className="metric-item">
                    <label>{text.ramAllocated}</label>
                    <div className="meter-bar">
                      <div className="meter-fill" style={{ width: `${Math.min(100, (config.memorySize / 8192) * 100)}%` }}></div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="vm-sidebar__section">
                <h4>{text.specs}</h4>
                <div className="hardware-grid">
                  <div className="hw-item">
                    <span className="hw-label">{text.disk}</span>
                    <span className="hw-value">2GB_VDA</span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-label">{text.memoryShort}</span>
                    <span className="hw-value">{config.memorySize}MB</span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-label">{text.bootShort}</span>
                    <span className="hw-value">{config.bootMode.toUpperCase()}</span>
                  </div>
                  <div className="hw-item">
                    <span className="hw-label">USED</span>
                    <span className="hw-value">{memUsage}MB</span>
                  </div>
                </div>
              </section>

              <section className="vm-sidebar__section">
                <h4>{text.tasks}</h4>
                <div className="status-grid">
                  <div className="status-item is-done">{text.initEngine}</div>
                  <div className={`status-item ${status === 'ready' ? 'is-done' : ''}`}>{text.loadKernel}</div>
                  <div className={`status-item ${status === 'ready' ? 'is-done' : ''}`}>{text.userLogin}</div>
                </div>
              </section>

              <section className="vm-sidebar__section">
                <button className="vm-btn vm-btn--full" onClick={handleSaveState} type="button">{text.saveState}</button>
                <button className="vm-btn vm-btn--full" onClick={handleRestoreClick} type="button">{text.restoreState}</button>
              </section>
            </aside>
          ) : null}
        </div>
      </main>

      <footer className="vm-footer">
        <span>{text.clickToType}</span>
        <span>{text.buttonsReturnFocus}</span>
      </footer>
    </div>
  );
};
