import * as vscode from 'vscode';
import type { CodeReviewTarget } from '../application/code-review/CodeReviewTarget';

export interface AutoReviewConfig {
  enabled: boolean;
  watchMode: 'workingTree' | 'staged' | 'branch';
  debounceMs: number;
  maxDiffChars: number;
  minRiskToRunAgent: 'low' | 'medium' | 'high' | 'critical';
  baseline: { enabled: boolean };
  architectureDrift: { enabled: boolean };
  requireApprovalForPatch: boolean;
  retention: { enabled: boolean; maxReports: number; maxAgeDays: number };
}

export function readAutoReviewConfig(): AutoReviewConfig {
  const cfg = vscode.workspace.getConfiguration('nexus');
  return {
    enabled: cfg.get<boolean>('autoReview.enabled', false),
    watchMode: cfg.get<'workingTree' | 'staged' | 'branch'>('autoReview.watchMode', 'workingTree'),
    debounceMs: cfg.get<number>('autoReview.debounceMs', 2500),
    maxDiffChars: cfg.get<number>('autoReview.maxDiffChars', 60000),
    minRiskToRunAgent: cfg.get<'low' | 'medium' | 'high' | 'critical'>('autoReview.minRiskToRunAgent', 'medium'),
    baseline: { enabled: cfg.get<boolean>('autoReview.baseline.enabled', true) },
    architectureDrift: { enabled: cfg.get<boolean>('autoReview.architectureDrift.enabled', true) },
    requireApprovalForPatch: cfg.get<boolean>('autoReview.requireApprovalForPatch', true),
    retention: {
      enabled: cfg.get<boolean>('autoReview.retention.enabled', true),
      maxReports: cfg.get<number>('autoReview.retention.maxReports', 100),
      maxAgeDays: cfg.get<number>('autoReview.retention.maxAgeDays', 30),
    },
  };
}

export function mapWatchModeToTarget(mode: AutoReviewConfig['watchMode']): CodeReviewTarget {
  if (mode === 'staged') return { type: 'staged' };
  if (mode === 'branch') return { type: 'branch', baseBranch: 'main' };
  return { type: 'working-tree' };
}
