import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createNexusConsoleCompleter } from './NexusConsoleCompleter';
import type { NexusConsoleState } from './NexusConsoleState';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-console-completer-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeState(): NexusConsoleState {
  return {
    workspaceRoot: tmpDir,
    providerRoute: 'auto',
    mode: 'ask',
    stage: 'dev',
    autoApprove: false,
  };
}

describe('createNexusConsoleCompleter', () => {
  it('completes agents by id and display name', () => {
    const agentsDir = path.join(tmpDir, '.nexus', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'code-review.md'), '# Nexus AI Code Review Agent\n', 'utf8');

    const complete = createNexusConsoleCompleter(makeState());

    expect(complete('@code')[0]).toContain('@code-review');
    expect(complete('@nexus')[0]).toContain('@code-review');
  });

  it('completes skills and commands by metadata', () => {
    const skillsDir = path.join(tmpDir, '.nexus', 'skills');
    const commandsDir = path.join(tmpDir, '.nexus', 'commands');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'security-review.md'), '# Security Review\n', 'utf8');
    fs.writeFileSync(
      path.join(commandsDir, 'ship.md'),
      '---\ndescription: Prepare release checklist\n---\nShip this change safely.\n',
      'utf8',
    );

    const complete = createNexusConsoleCompleter(makeState());

    expect(complete('#security')[0]).toContain('#security-review');
    expect(complete('/release')[0]).toContain('/ship');
  });
});
