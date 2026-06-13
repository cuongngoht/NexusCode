import type { TaskMode } from '../../core/types';

export type SubagentTaskType =
  | 'debug_runtime' | 'debug_compile' | 'debug_test_failure'
  | 'feature_planning' | 'code_edit' | 'code_review' | 'security_review'
  | 'research' | 'docs' | 'test_design' | 'unknown';

export interface SubagentIntent {
  mode: TaskMode;
  taskType: SubagentTaskType;
  needsProjectSearch: boolean;
  needsDebug: boolean;
  needsTests: boolean;
  needsReview: boolean;
  needsSecurity: boolean;
  needsDocs: boolean;
  needsProduct: boolean;
  needsResearch: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  keywords: string[];
}

export function classifySubagentIntent(input: {
  prompt: string;
  mode: TaskMode;
  debugContext?: string;
  sourceContext?: string;
}): SubagentIntent {
  const text = `${input.prompt}\n${input.debugContext ?? ''}\n${input.sourceContext ?? ''}`.toLowerCase();
  const hasAny = (terms: string[]) => terms.some(term => text.includes(term));

  const debugTerms = ['bug', 'error', 'exception', 'stack', 'failed', 'crash', 'not working', 'fix'];
  const compileTerms = ['typescript', 'tsc', 'type error', 'compile', 'build failed'];
  const testTerms = ['test', 'spec', 'coverage', 'vitest', 'jest', 'failing test'];
  const securityTerms = [
    'security', 'auth', 'token', 'secret', 'password', 'credential',
    'path traversal', 'command', 'shell', 'exec', 'filesystem', 'network', 'permission',
  ];
  const docsTerms = ['readme', 'docs', 'document', 'documentation', 'guide'];
  const productTerms = ['requirement', 'ux', 'acceptance criteria', 'user story', 'product'];
  const researchTerms = ['research', 'compare', 'investigate', 'analyze', 'latest'];

  const needsDebug = input.mode === 'debug' || hasAny(debugTerms);
  const needsTests = input.mode === 'test' || hasAny(testTerms);
  const needsSecurity = hasAny(securityTerms);
  const needsDocs = hasAny(docsTerms);
  const needsProduct = hasAny(productTerms);
  const needsResearch = input.mode === 'research' || hasAny(researchTerms);
  const needsReview = input.mode === 'review' || text.includes('review');

  const riskLevel: 'low' | 'medium' | 'high' =
    needsSecurity ? 'high'
    : needsDebug || needsTests || needsReview ? 'medium'
    : 'low';

  let taskType: SubagentTaskType = 'unknown';
  if (needsSecurity) taskType = 'security_review';
  else if (needsTests && needsDebug) taskType = 'debug_test_failure';
  else if (needsDebug && hasAny(compileTerms)) taskType = 'debug_compile';
  else if (needsDebug) taskType = 'debug_runtime';
  else if (needsProduct || input.mode === 'plan') taskType = 'feature_planning';
  else if (input.mode === 'edit') taskType = 'code_edit';
  else if (needsReview) taskType = 'code_review';
  else if (needsDocs) taskType = 'docs';
  else if (needsResearch) taskType = 'research';
  else if (needsTests) taskType = 'test_design';

  return {
    mode: input.mode,
    taskType,
    needsProjectSearch: input.mode !== 'ask',
    needsDebug,
    needsTests,
    needsReview,
    needsSecurity,
    needsDocs,
    needsProduct,
    needsResearch,
    riskLevel,
    keywords: [],
  };
}
