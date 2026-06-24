import type { FileIntelligenceProfile } from './types';

export interface ContextBuildOptions {
  maxCharsPerProfile?: number;
  maxTotalChars?: number;
}

export class FileIntelligenceContextBuilder {
  build(profiles: FileIntelligenceProfile[], opts?: ContextBuildOptions): string {
    if (profiles.length === 0) return '';

    const maxPerProfile = opts?.maxCharsPerProfile ?? 1200;
    const maxTotal = opts?.maxTotalChars ?? 9600;

    const blocks: string[] = [];
    let totalChars = 0;

    for (const profile of profiles) {
      const block = this.buildProfileBlock(profile, maxPerProfile);
      if (!block) continue;
      if (totalChars + block.length > maxTotal) break;
      blocks.push(block);
      totalChars += block.length;
    }

    return blocks.join('\n');
  }

  private buildProfileBlock(profile: FileIntelligenceProfile, maxChars: number): string {
    const lines: string[] = [`### ${profile.filePath}`];

    if (profile.layer) lines.push(`- Layer: ${profile.layer}`);
    if (profile.module) lines.push(`- Module: ${profile.module}`);

    if (profile.responsibilities && profile.responsibilities.length > 0) {
      lines.push(`- Responsibility: ${profile.responsibilities[0]}`);
    }

    if (profile.knownRisks && profile.knownRisks.length > 0) {
      lines.push(`- Risk: ${profile.knownRisks[0]}`);
    }

    if (profile.relatedFiles && profile.relatedFiles.length > 0) {
      lines.push(`- Related: ${profile.relatedFiles.slice(0, 3).join(', ')}`);
    }

    if (profile.testFiles && profile.testFiles.length > 0) {
      lines.push(`- Tests: ${profile.testFiles.slice(0, 2).join(', ')}`);
    }

    if (profile.changeHistory && profile.changeHistory.length > 0) {
      const ch = profile.changeHistory[0];
      const added = ch.linesAdded !== undefined ? `+${ch.linesAdded}` : '';
      const removed = ch.linesRemoved !== undefined ? `-${ch.linesRemoved}` : '';
      const diff = [added, removed].filter(Boolean).join('/');
      lines.push(`- Recent changes: ${ch.reason}${diff ? ` (${diff})` : ''}`);
    }

    if (profile.reviewFindings && profile.reviewFindings.length > 0) {
      lines.push(`- Known gotchas: ${profile.reviewFindings[0].message}`);
    }

    if (profile.debugFindings && profile.debugFindings.length > 0) {
      lines.push(`- Debug history: ${profile.debugFindings[0].description}`);
    }

    if (profile.summary) {
      lines.push(`- Summary: ${profile.summary}`);
    }

    const block = lines.join('\n');
    return block.length <= maxChars ? block : block.slice(0, maxChars - 3) + '...';
  }
}
