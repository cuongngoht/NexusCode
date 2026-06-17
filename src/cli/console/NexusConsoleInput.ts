import * as readline from 'readline';
import type { ReadStream, WriteStream } from 'tty';
import type { NexusConsoleState } from './NexusConsoleState';
import {
  getNexusConsoleSuggestionContext,
  type NexusConsoleSuggestionContext,
} from './NexusConsoleCompleter';

interface InputState {
  line: string;
  cursor: number;
  selectedIndex: number;
  suggestionsHidden: boolean;
}

interface RenderState {
  visibleSuggestionLines: number;
}

const MAX_VISIBLE_SUGGESTIONS = 8;

function isPrintable(str: string): boolean {
  return str.length > 0 && !/[\x00-\x1F\x7F]/.test(str);
}

function clampCursor(cursor: number, line: string): number {
  return Math.max(0, Math.min(cursor, line.length));
}

function activeSuggestionContext(
  consoleState: NexusConsoleState,
  inputState: InputState,
): NexusConsoleSuggestionContext | undefined {
  if (inputState.suggestionsHidden) return undefined;
  const ctx = getNexusConsoleSuggestionContext(consoleState, inputState.line, inputState.cursor);
  if (!ctx || ctx.suggestions.length === 0) return undefined;
  return ctx;
}

function clearPromptArea(output: NodeJS.WritableStream, renderState: RenderState): void {
  output.write('\r\x1b[J');
  renderState.visibleSuggestionLines = 0;
}

function render(
  consoleState: NexusConsoleState,
  inputState: InputState,
  renderState: RenderState,
  output: NodeJS.WritableStream,
  promptText: string,
): void {
  const ctx = activeSuggestionContext(consoleState, inputState);
  const suggestions = ctx?.suggestions.slice(0, MAX_VISIBLE_SUGGESTIONS) ?? [];
  const selectedIndex = suggestions.length === 0
    ? 0
    : Math.min(inputState.selectedIndex, suggestions.length - 1);

  clearPromptArea(output, renderState);
  output.write(`${promptText}${inputState.line}`);

  const lines: string[] = suggestions.map((suggestion, index) => {
    const marker = index === selectedIndex ? '›' : ' ';
    const token = suggestion.token.padEnd(28, ' ');
    return `${marker} ${token} ${suggestion.label}`;
  });
  if (ctx && ctx.suggestions.length > suggestions.length) {
    lines.push(`  … ${ctx.suggestions.length - suggestions.length} more`);
  }

  if (lines.length > 0) {
    output.write(`\n${lines.join('\n')}`);
    output.write(`\x1b[${lines.length}A`);
  }
  output.write(`\r\x1b[${promptText.length + clampCursor(inputState.cursor, inputState.line)}C`);
  renderState.visibleSuggestionLines = lines.length;
  inputState.selectedIndex = selectedIndex;
}

function acceptSuggestion(
  consoleState: NexusConsoleState,
  inputState: InputState,
): boolean {
  const ctx = activeSuggestionContext(consoleState, inputState);
  if (!ctx || ctx.suggestions.length === 0) return false;

  const selected = ctx.suggestions[Math.min(inputState.selectedIndex, ctx.suggestions.length - 1)];
  if (!selected) return false;

  const replacement = `${selected.token} `;
  inputState.line = `${inputState.line.slice(0, ctx.tokenStart)}${replacement}${inputState.line.slice(ctx.tokenEnd)}`;
  inputState.cursor = ctx.tokenStart + replacement.length;
  inputState.selectedIndex = 0;
  inputState.suggestionsHidden = true;
  return true;
}

function fallbackReadLine(promptText: string): Promise<string | undefined> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise(resolve => {
    let settled = false;
    const settle = (value: string | undefined): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    rl.question(promptText, answer => {
      rl.close();
      settle(answer);
    });
    rl.once('close', () => settle(undefined));
  });
}

export function readNexusConsoleLine(
  consoleState: NexusConsoleState,
  promptText = 'nexus> ',
): Promise<string | undefined> {
  const input = process.stdin as ReadStream;
  const output = process.stdout as WriteStream;

  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    return fallbackReadLine(promptText);
  }

  readline.emitKeypressEvents(input);
  const previousRawMode = input.isRaw;
  input.setRawMode(true);
  input.resume();

  const inputState: InputState = {
    line: '',
    cursor: 0,
    selectedIndex: 0,
    suggestionsHidden: false,
  };
  const renderState: RenderState = { visibleSuggestionLines: 0 };

  return new Promise(resolve => {
    let settled = false;

    const cleanup = (): void => {
      input.off('keypress', onKeypress);
      input.setRawMode(previousRawMode);
      input.pause();
    };

    const settle = (value: string | undefined): void => {
      if (settled) return;
      settled = true;
      clearPromptArea(output, renderState);
      if (value !== undefined) {
        output.write(`${promptText}${inputState.line}`);
      }
      cleanup();
      output.write('\n');
      resolve(value);
    };

    const rerender = (): void => {
      render(consoleState, inputState, renderState, output, promptText);
    };

    const markEdited = (): void => {
      inputState.selectedIndex = 0;
      inputState.suggestionsHidden = false;
    };

    const onKeypress = (str: string, key: readline.Key): void => {
      const ctx = activeSuggestionContext(consoleState, inputState);

      if (key.ctrl && key.name === 'c') {
        settle(undefined);
        return;
      }

      if (key.ctrl && key.name === 'd' && inputState.line.length === 0) {
        settle(undefined);
        return;
      }

      if (key.name === 'escape') {
        inputState.suggestionsHidden = true;
        rerender();
        return;
      }

      if (key.name === 'up' && ctx) {
        inputState.selectedIndex = (inputState.selectedIndex - 1 + ctx.suggestions.length) % ctx.suggestions.length;
        rerender();
        return;
      }

      if (key.name === 'down' && ctx) {
        inputState.selectedIndex = (inputState.selectedIndex + 1) % ctx.suggestions.length;
        rerender();
        return;
      }

      if ((key.name === 'tab' || key.name === 'return') && ctx) {
        acceptSuggestion(consoleState, inputState);
        rerender();
        return;
      }

      if (key.name === 'return') {
        settle(inputState.line);
        return;
      }

      if (key.name === 'backspace') {
        if (inputState.cursor > 0) {
          inputState.line = `${inputState.line.slice(0, inputState.cursor - 1)}${inputState.line.slice(inputState.cursor)}`;
          inputState.cursor -= 1;
          markEdited();
          rerender();
        }
        return;
      }

      if (key.name === 'delete') {
        if (inputState.cursor < inputState.line.length) {
          inputState.line = `${inputState.line.slice(0, inputState.cursor)}${inputState.line.slice(inputState.cursor + 1)}`;
          markEdited();
          rerender();
        }
        return;
      }

      if (key.name === 'left') {
        inputState.cursor = clampCursor(inputState.cursor - 1, inputState.line);
        rerender();
        return;
      }

      if (key.name === 'right') {
        inputState.cursor = clampCursor(inputState.cursor + 1, inputState.line);
        rerender();
        return;
      }

      if (key.name === 'home') {
        inputState.cursor = 0;
        rerender();
        return;
      }

      if (key.name === 'end') {
        inputState.cursor = inputState.line.length;
        rerender();
        return;
      }

      if (isPrintable(str)) {
        inputState.line = `${inputState.line.slice(0, inputState.cursor)}${str}${inputState.line.slice(inputState.cursor)}`;
        inputState.cursor += str.length;
        markEdited();
        rerender();
      }
    };

    input.on('keypress', onKeypress);
    rerender();
  });
}
