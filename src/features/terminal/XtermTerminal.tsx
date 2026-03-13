import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef } from 'react';
import type { TerminalLine } from '../simulator/types';
import type { CompletionResult } from '../simulator/engine';

type InputMode = 'text' | 'password';
type TerminalThemeId = 'emerald' | 'amber' | 'ice';

interface XtermTerminalProps {
  lines: TerminalLine[];
  prompt: string;
  showPrompt: boolean;
  inputMode?: InputMode;
  theme?: TerminalThemeId;
  onSubmit: (command: string) => void | Promise<void>;
  onTabComplete?: (buffer: string) => CompletionResult;
}

const COLOR_RESET = '\u001b[0m';
const LINE_COLORS: Record<TerminalLine['kind'], string> = {
  system: '\u001b[38;5;109m',
  command: '\u001b[38;5;194m',
  output: '\u001b[38;5;252m',
  success: '\u001b[38;5;114m',
  error: '\u001b[38;5;210m',
  info: '\u001b[38;5;151m',
};

export function XtermTerminal({
  lines,
  prompt,
  showPrompt,
  inputMode = 'text',
  theme = 'emerald',
  onSubmit,
  onTabComplete,
}: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef('');
  const cursorIndexRef = useRef(0);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const historyDraftRef = useRef('');
  const onSubmitRef = useRef(onSubmit);
  const onTabCompleteRef = useRef(onTabComplete);
  const promptRef = useRef(prompt);
  const inputModeRef = useRef<InputMode>(inputMode);
  const showPromptRef = useRef(showPrompt);

  onSubmitRef.current = onSubmit;
  onTabCompleteRef.current = onTabComplete;
  promptRef.current = prompt;
  inputModeRef.current = inputMode;
  showPromptRef.current = showPrompt;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"Azeret Mono", monospace',
      fontSize: 15,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: getTerminalTheme(theme),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    terminal.focus();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    const disposable = terminal.onData((data) => {
      if (!showPromptRef.current) {
        return;
      }

      if (data === '\r') {
        const command = inputBufferRef.current;
        if (command.trim().length > 0) {
          commandHistoryRef.current.push(command);
        }
        historyIndexRef.current = null;
        historyDraftRef.current = '';
        inputBufferRef.current = '';
        cursorIndexRef.current = 0;
        terminal.write('\r\n');
        void onSubmitRef.current(command);
        return;
      }

      if (data === '\u007f') {
        if (cursorIndexRef.current === 0) {
          return;
        }
        const nextBuffer = `${inputBufferRef.current.slice(0, cursorIndexRef.current - 1)}${inputBufferRef.current.slice(cursorIndexRef.current)}`;
        inputBufferRef.current = nextBuffer;
        cursorIndexRef.current -= 1;
        redrawPromptLine(terminal, promptRef.current, nextBuffer, cursorIndexRef.current, inputModeRef.current);
        return;
      }

      if (data === '\u0003') {
        inputBufferRef.current = '';
        cursorIndexRef.current = 0;
        terminal.write('^C\r\n');
        redrawPromptLine(terminal, promptRef.current, '', 0, inputModeRef.current);
        return;
      }

      if (data === '\u000c') {
        inputBufferRef.current = '';
        cursorIndexRef.current = 0;
        commandHistoryRef.current = [];
        historyIndexRef.current = null;
        historyDraftRef.current = '';
        terminal.reset();
        return;
      }

      if (data === '\t') {
        const completion = onTabCompleteRef.current?.(inputBufferRef.current);
        if (!completion) {
          return;
        }

        if (completion.buffer !== inputBufferRef.current) {
          inputBufferRef.current = completion.buffer;
          cursorIndexRef.current = completion.buffer.length;
          redrawPromptLine(terminal, promptRef.current, completion.buffer, cursorIndexRef.current, inputModeRef.current);
          return;
        }

        if (completion.suggestions.length > 1) {
          terminal.write('\r\n');
          terminal.writeln(completion.suggestions.join('    '));
          redrawPromptLine(terminal, promptRef.current, inputBufferRef.current, cursorIndexRef.current, inputModeRef.current);
        }
        return;
      }

      if (data === '\u001b[A') {
        if (commandHistoryRef.current.length === 0) {
          return;
        }
        if (historyIndexRef.current === null) {
          historyDraftRef.current = inputBufferRef.current;
          historyIndexRef.current = commandHistoryRef.current.length - 1;
        } else {
          historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
        }

        const nextBuffer = commandHistoryRef.current[historyIndexRef.current];
        inputBufferRef.current = nextBuffer;
        cursorIndexRef.current = nextBuffer.length;
        redrawPromptLine(terminal, promptRef.current, nextBuffer, cursorIndexRef.current, inputModeRef.current);
        return;
      }

      if (data === '\u001b[B') {
        if (historyIndexRef.current === null) {
          return;
        }

        if (historyIndexRef.current >= commandHistoryRef.current.length - 1) {
          historyIndexRef.current = null;
          inputBufferRef.current = historyDraftRef.current;
          cursorIndexRef.current = inputBufferRef.current.length;
          redrawPromptLine(terminal, promptRef.current, inputBufferRef.current, cursorIndexRef.current, inputModeRef.current);
          return;
        }

        historyIndexRef.current += 1;
        const nextBuffer = commandHistoryRef.current[historyIndexRef.current];
        inputBufferRef.current = nextBuffer;
        cursorIndexRef.current = nextBuffer.length;
        redrawPromptLine(terminal, promptRef.current, nextBuffer, cursorIndexRef.current, inputModeRef.current);
        return;
      }

      if (data === '\u001b[D') {
        if (cursorIndexRef.current === 0) {
          return;
        }
        cursorIndexRef.current -= 1;
        redrawPromptLine(terminal, promptRef.current, inputBufferRef.current, cursorIndexRef.current, inputModeRef.current);
        return;
      }

      if (data === '\u001b[C') {
        if (cursorIndexRef.current >= inputBufferRef.current.length) {
          return;
        }
        cursorIndexRef.current += 1;
        redrawPromptLine(terminal, promptRef.current, inputBufferRef.current, cursorIndexRef.current, inputModeRef.current);
        return;
      }

      if (data.length !== 1 || data < ' ') {
        return;
      }

      const nextBuffer = `${inputBufferRef.current.slice(0, cursorIndexRef.current)}${data}${inputBufferRef.current.slice(cursorIndexRef.current)}`;
      inputBufferRef.current = nextBuffer;
      cursorIndexRef.current += data.length;
      redrawPromptLine(terminal, promptRef.current, nextBuffer, cursorIndexRef.current, inputModeRef.current);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const focusTerminal = () => terminal.focus();
    container.addEventListener('click', focusTerminal);

    return () => {
      container.removeEventListener('click', focusTerminal);
      disposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.options.theme = getTerminalTheme(theme);
  }, [theme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    redrawTerminal(terminal, lines, prompt, showPrompt, inputBufferRef.current, cursorIndexRef.current, inputMode);
  }, [lines, prompt, showPrompt, inputMode]);

  return <div className="xterm-shell" ref={containerRef} />;
}

function getTerminalTheme(theme: TerminalThemeId) {
  if (theme === 'amber') {
    return {
      background: '#140d07',
      foreground: '#ffd7aa',
      cursor: '#ffd7aa',
      selectionBackground: 'rgba(255, 215, 170, 0.2)',
      black: '#140d07',
      brightBlack: '#6f5842',
      red: '#ff9d7a',
      brightRed: '#ffb594',
      green: '#f0c778',
      brightGreen: '#ffd68d',
      yellow: '#ffd084',
      brightYellow: '#ffdb9f',
      blue: '#d3a86b',
      brightBlue: '#e2be89',
      magenta: '#e0b28c',
      brightMagenta: '#ebc4a6',
      cyan: '#f0c995',
      brightCyan: '#ffd9ad',
      white: '#ffd7aa',
      brightWhite: '#fff1df',
    };
  }

  if (theme === 'ice') {
    return {
      background: '#07121a',
      foreground: '#d0ebff',
      cursor: '#d0ebff',
      selectionBackground: 'rgba(208, 235, 255, 0.2)',
      black: '#07121a',
      brightBlack: '#4d6577',
      red: '#ff92aa',
      brightRed: '#ffb0c0',
      green: '#82d0ff',
      brightGreen: '#a8ddff',
      yellow: '#b7d7ff',
      brightYellow: '#d0e5ff',
      blue: '#7ab4ff',
      brightBlue: '#9ec8ff',
      magenta: '#b4c2ff',
      brightMagenta: '#ccd5ff',
      cyan: '#92e7ff',
      brightCyan: '#b8f1ff',
      white: '#d0ebff',
      brightWhite: '#f5fbff',
    };
  }

  return {
    background: '#05080b',
    foreground: '#d7efe5',
    cursor: '#d7efe5',
    selectionBackground: 'rgba(215, 239, 229, 0.2)',
    black: '#05080b',
    brightBlack: '#4d5b59',
    red: '#f19a9a',
    brightRed: '#ffb4b4',
    green: '#7ed6b2',
    brightGreen: '#a5e8cc',
    yellow: '#d8c07a',
    brightYellow: '#e6d190',
    blue: '#7cb7d9',
    brightBlue: '#9bcde9',
    magenta: '#b8a1e3',
    brightMagenta: '#cab7ed',
    cyan: '#8ec7be',
    brightCyan: '#a9dfd8',
    white: '#d7efe5',
    brightWhite: '#f3fffb',
  };
}

function redrawTerminal(
  terminal: Terminal,
  lines: TerminalLine[],
  prompt: string,
  showPrompt: boolean,
  buffer: string,
  cursorIndex: number,
  inputMode: InputMode,
) {
  terminal.reset();
  for (const line of lines) {
    terminal.writeln(formatLine(line));
  }

  if (showPrompt) {
    redrawPromptLine(terminal, prompt, buffer, cursorIndex, inputMode);
  }
}

function redrawPromptLine(
  terminal: Terminal,
  prompt: string,
  buffer: string,
  cursorIndex: number,
  inputMode: InputMode,
) {
  const displayBuffer = inputMode === 'password' ? ''.padEnd(buffer.length, '*') : buffer;
  const offset = displayBuffer.length - cursorIndex;
  terminal.write(`\r\u001b[2K${prompt}${displayBuffer}`);
  if (offset > 0) {
    terminal.write(`\u001b[${offset}D`);
  }
}

function formatLine(line: TerminalLine): string {
  return `${LINE_COLORS[line.kind]}${escapeAnsi(line.text)}${COLOR_RESET}`;
}

function escapeAnsi(text: string): string {
  return text.replace(/\u001b/g, '');
}