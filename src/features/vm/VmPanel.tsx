import React, { useEffect, useRef, useState } from 'react';
import './VmPanel.css';

interface VmPanelProps {
  onExit: () => void;
  terminalMode?: 'vm' | 'simulation';
}

export const VmPanel: React.FC<VmPanelProps> = ({ onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // V86 Initialization logic
    // Note: In a real environment, you'd load the v86 scripts here or assume they're available
    const initV86 = async () => {
      try {
        setLoading(true);
        // Placeholder for V86 initialization
        // console.log('Initializing V86...');
        setTimeout(() => setLoading(false), 2000); // Simulate boot time
      } catch (err) {
        setError('Failed to initialize virtual machine.');
        setLoading(false);
      }
    };

    initV86();

    return () => {
      // Cleanup V86 instance
    };
  }, []);

  return (
    <div className="vm-panel-container">
      <header className="vm-header">
        <div className="vm-status">
          <span className={`status-dot ${loading ? 'pulse' : 'ready'}`}></span>
          <span className="status-text">{loading ? 'BOOTING_SYSTEM...' : 'SYSTEM_READY'}</span>
        </div>
        <div className="vm-controls">
          <button className="vm-btn" onClick={() => window.location.reload()}>REBOOT</button>
          <button className="vm-btn exit" onClick={onExit}>EXIT_TO_MAP</button>
        </div>
      </header>
      
      <main className="vm-main">
        {loading && (
          <div className="vm-loading-overlay">
            <div className="spinner"></div>
            <p>LOADING ARCH ISO // PLEASE WAIT</p>
          </div>
        )}
        
        {error && (
          <div className="vm-error-overlay">
            <p>CRITICAL_ERROR: {error}</p>
          </div>
        )}

        <div id="screen-container" ref={containerRef}>
          <div id="v86-screen"></div>
          <canvas id="v86-canvas"></canvas>
        </div>

        <div id="terminal-container" ref={terminalRef}></div>
      </main>

      <footer className="vm-footer">
        <div className="keyboard-hint">Press ALT+TAB to release cursor</div>
        <div className="stats">CPU: x86_64 | MEM: 512MB</div>
      </footer>
    </div>
  );
};
