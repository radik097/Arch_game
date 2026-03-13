import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { TerminalLine } from '../simulator/types';

interface TerminalFrameProps {
  title?: string;
  headerNote?: string;
  statusItems?: string[];
  children: ReactNode;
  promptLabel?: string;
  input?: string;
  onInputChange?: (value: string) => void;
  onSubmit?: () => void;
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

interface TerminalPanelProps {
  title?: string;
  headerNote?: string;
  statusItems?: string[];
  history: TerminalLine[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLocked: boolean;
  footer?: ReactNode;
  promptLabel?: string;
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export function TerminalFrame({
  title,
  headerNote,
  statusItems = [],
  children,
  promptLabel = 'menu ~ #',
  input = '',
  onInputChange,
  onSubmit,
  onInputKeyDown,
}: TerminalFrameProps) {
  return (
    <section className="terminal-shell fullscreen-shell">
      {title || headerNote ? (
        <header className="terminal-header">
          <div>
            <p className="eyebrow">terminal</p>
            <h2>{title}</h2>
          </div>
          <p className="header-note">{headerNote}</p>
        </header>
      ) : null}

      {statusItems.length > 0 ? (
        <div className="terminal-status-strip">
          {statusItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      <div className="terminal-viewport">{children}</div>

      {onSubmit && onInputChange ? (
        <form
          className="terminal-input-row"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="prompt" htmlFor="menu-command-input">
            {promptLabel}
          </label>
          <input
            id="menu-command-input"
            autoComplete="off"
            autoFocus
            className="terminal-input"
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            spellCheck={false}
            value={input}
          />
        </form>
      ) : null}
    </section>
  );
}

export function TerminalPanel({
  title,
  headerNote,
  statusItems = [],
  history,
  input,
  onInputChange,
  onSubmit,
  isLocked,
  footer,
  promptLabel = 'archiso ~ #',
  onInputKeyDown,
}: TerminalPanelProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }

    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [history]);

  return (
    <section className="terminal-shell fullscreen-shell">
      {title || headerNote ? (
        <header className="terminal-header">
          <div>
            <p className="eyebrow">terminal</p>
            <h2>{title}</h2>
          </div>
          <p className="header-note">{headerNote}</p>
        </header>
      ) : null}

      {statusItems.length > 0 ? (
        <div className="terminal-status-strip">
          {statusItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      <div className="terminal-viewport" ref={viewportRef}>
        {history.map((line) => (
          <p key={line.id} className={`line line-${line.kind}`}>
            {line.text}
          </p>
        ))}
      </div>

      {footer ? <div className="terminal-footer-panel">{footer}</div> : null}

      <form
        className="terminal-input-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="prompt" htmlFor="command-input">
          {promptLabel}
        </label>
        <input
          id="command-input"
          autoComplete="off"
          autoFocus
          className="terminal-input"
          disabled={isLocked}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onInputKeyDown}
          spellCheck={false}
          value={input}
        />
      </form>
    </section>
  );
}
