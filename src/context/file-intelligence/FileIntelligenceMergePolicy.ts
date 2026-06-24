import type {
  FileIntelligenceProfile,
  FileTouchEvent,
  FileFreshness,
  ReviewFinding,
  DebugFinding,
  ChangeHistoryEntry,
  TouchStats,
} from './types';

const MAX_CHANGE_HISTORY = 20;

export class FileIntelligenceMergePolicy {
  apply(
    existing: FileIntelligenceProfile | undefined,
    event: FileTouchEvent,
    confidence: number,
    freshness: FileFreshness,
    contentHash: string | undefined,
  ): FileIntelligenceProfile {
    const now = Date.now();
    const base: FileIntelligenceProfile = existing ?? {
      filePath: event.filePath,
      confidence: 0,
      freshness: 'fresh',
      createdAt: now,
      updatedAt: now,
    };

    const reviewFindings = this.mergeReviewFindings(base.reviewFindings, event.reviewFindings);
    const debugFindings = this.mergeDebugFindings(base.debugFindings, event.debugFindings);
    const changeHistory = this.appendChangeHistory(base.changeHistory, event);
    const touchStats = this.updateTouchStats(base.touchStats, event);

    const updated: FileIntelligenceProfile = {
      ...base,
      confidence,
      freshness,
      contentHash: contentHash ?? base.contentHash,
      updatedAt: now,
      touchStats,
      changeHistory,
    };

    if (reviewFindings.length > 0) updated.reviewFindings = reviewFindings;
    if (debugFindings.length > 0) updated.debugFindings = debugFindings;
    if (event.relatedFiles && event.relatedFiles.length > 0) {
      updated.relatedFiles = this.mergeStringArrays(base.relatedFiles, event.relatedFiles);
    }
    if (event.testResult && !event.testResult.passed && event.testResult.failureSummary) {
      updated.knownRisks = this.mergeStringArrays(base.knownRisks, [event.testResult.failureSummary]);
    }

    // Mark summary stale on major changes
    if (freshness === 'stale' && existing?.summary) {
      const isLargeChange = event.diffMetadata &&
        (event.diffMetadata.isMajorChange || event.diffMetadata.linesAdded + event.diffMetadata.linesRemoved >= 20);
      if (isLargeChange) {
        updated.summary = undefined;
        updated.responsibilities = undefined;
      }
    }

    return updated;
  }

  private mergeReviewFindings(
    existing: ReviewFinding[] | undefined,
    incoming: ReviewFinding[] | undefined,
  ): ReviewFinding[] {
    if (!incoming || incoming.length === 0) return existing ?? [];

    const combined = [...(existing ?? [])];
    for (const finding of incoming) {
      const key = `${finding.message}:${finding.line ?? ''}`;
      const existingIdx = combined.findIndex(
        f => `${f.message}:${f.line ?? ''}` === key,
      );
      if (existingIdx === -1) {
        combined.push(finding);
      } else {
        // Keep highest severity
        const severityOrder = { error: 2, warning: 1, info: 0 };
        if (severityOrder[finding.severity] > severityOrder[combined[existingIdx].severity]) {
          combined[existingIdx] = finding;
        }
      }
    }
    return combined;
  }

  private mergeDebugFindings(
    existing: DebugFinding[] | undefined,
    incoming: DebugFinding[] | undefined,
  ): DebugFinding[] {
    if (!incoming || incoming.length === 0) return existing ?? [];

    const combined = [...(existing ?? [])];
    for (const finding of incoming) {
      const existingIdx = combined.findIndex(f => f.description === finding.description);
      if (existingIdx === -1) {
        combined.push(finding);
      } else if (finding.role === 'confirmed' && combined[existingIdx].role === 'suspected') {
        // Upgrade suspected → confirmed
        combined[existingIdx] = { ...combined[existingIdx], role: 'confirmed' };
      }
    }
    return combined;
  }

  private appendChangeHistory(
    existing: ChangeHistoryEntry[] | undefined,
    event: FileTouchEvent,
  ): ChangeHistoryEntry[] {
    const entry: ChangeHistoryEntry = {
      timestamp: event.timestamp,
      reason: event.reason,
      sessionId: event.sessionId,
      taskId: event.taskId,
      ...(event.diffMetadata && {
        linesAdded: event.diffMetadata.linesAdded,
        linesRemoved: event.diffMetadata.linesRemoved,
        hunks: event.diffMetadata.hunks,
        isMajorChange: event.diffMetadata.isMajorChange,
      }),
    };
    const history = [entry, ...(existing ?? [])];
    return history.slice(0, MAX_CHANGE_HISTORY);
  }

  private updateTouchStats(existing: TouchStats | undefined, event: FileTouchEvent): TouchStats {
    const base: TouchStats = existing ?? {
      editCount: 0,
      reviewCount: 0,
      debugCount: 0,
      testCount: 0,
      lastTouchedBy: event.reason,
      lastTouchedAt: event.timestamp,
    };
    return {
      editCount: base.editCount + (event.reason === 'edit' ? 1 : 0),
      reviewCount: base.reviewCount + (event.reason === 'review' ? 1 : 0),
      debugCount: base.debugCount + (event.reason === 'debug' ? 1 : 0),
      testCount: base.testCount + (event.reason === 'test' ? 1 : 0),
      lastTouchedBy: event.reason,
      lastTouchedAt: event.timestamp,
    };
  }

  private mergeStringArrays(existing: string[] | undefined, incoming: string[]): string[] {
    const set = new Set([...(existing ?? []), ...incoming]);
    return Array.from(set);
  }
}
