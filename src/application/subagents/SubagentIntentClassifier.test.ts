import { describe, expect, it } from 'vitest';
import { classifySubagentIntent } from './SubagentIntentClassifier';

describe('classifySubagentIntent', () => {
  it('detects debug intent from prompt', () => {
    const result = classifySubagentIntent({ prompt: 'error stack failed crash', mode: 'ask' });
    expect(result.needsDebug).toBe(true);
  });

  it('detects debug intent from mode', () => {
    const result = classifySubagentIntent({ prompt: 'fix this', mode: 'debug' });
    expect(result.needsDebug).toBe(true);
  });

  it('detects test intent from prompt', () => {
    const result = classifySubagentIntent({ prompt: 'write test coverage spec', mode: 'ask' });
    expect(result.needsTests).toBe(true);
  });

  it('detects security intent', () => {
    const result = classifySubagentIntent({ prompt: 'auth token secret password', mode: 'ask' });
    expect(result.needsSecurity).toBe(true);
    expect(result.riskLevel).toBe('high');
  });

  it('detects docs intent', () => {
    const result = classifySubagentIntent({ prompt: 'update the readme documentation', mode: 'ask' });
    expect(result.needsDocs).toBe(true);
  });

  it('detects product intent', () => {
    const result = classifySubagentIntent({ prompt: 'define acceptance criteria user story', mode: 'ask' });
    expect(result.needsProduct).toBe(true);
  });

  it('detects research intent from mode', () => {
    const result = classifySubagentIntent({ prompt: 'what libraries should I use', mode: 'research' });
    expect(result.needsResearch).toBe(true);
  });

  it('security sets high risk level', () => {
    const result = classifySubagentIntent({ prompt: 'command exec shell permission', mode: 'edit' });
    expect(result.riskLevel).toBe('high');
  });

  it('debug sets medium risk level', () => {
    const result = classifySubagentIntent({ prompt: 'fix this bug', mode: 'debug' });
    expect(result.riskLevel).toBe('medium');
  });

  it('plain prompt is low risk', () => {
    const result = classifySubagentIntent({ prompt: 'add a tooltip to the button', mode: 'ask' });
    expect(result.riskLevel).toBe('low');
  });

  it('needsProjectSearch is false for ask mode', () => {
    const result = classifySubagentIntent({ prompt: 'hello', mode: 'ask' });
    expect(result.needsProjectSearch).toBe(false);
  });

  it('needsProjectSearch is true for edit mode', () => {
    const result = classifySubagentIntent({ prompt: 'add feature', mode: 'edit' });
    expect(result.needsProjectSearch).toBe(true);
  });

  it('classifies security_review as taskType when security terms present', () => {
    const result = classifySubagentIntent({ prompt: 'check auth token', mode: 'review' });
    expect(result.taskType).toBe('security_review');
  });

  it('classifies feature_planning for plan mode', () => {
    const result = classifySubagentIntent({ prompt: 'plan the feature', mode: 'plan' });
    expect(result.taskType).toBe('feature_planning');
  });

  it('classifies code_edit for edit mode with no special terms', () => {
    const result = classifySubagentIntent({ prompt: 'add a button', mode: 'edit' });
    expect(result.taskType).toBe('code_edit');
  });
});
