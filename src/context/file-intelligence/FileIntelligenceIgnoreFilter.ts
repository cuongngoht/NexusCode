import type { NexusIgnoreMatcher } from '../project-map/NexusIgnoreMatcher';
import type { FileIntelligenceProfile } from './types';

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.zip', '.tar', '.gz', '.bz2',
  '.exe', '.dll', '.so', '.dylib',
  '.class', '.jar', '.war',
  '.mp3', '.mp4', '.wav', '.avi',
  '.bin', '.dat',
]);

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{36,}/g,
  /[A-Z0-9]{32,}/g,
  /[A-Za-z0-9+/]{40,}={0,2}/g,
];

export class FileIntelligenceIgnoreFilter {
  constructor(private readonly ignoreMatcher: NexusIgnoreMatcher) {}

  shouldIgnore(relativePath: string): boolean {
    if (this.ignoreMatcher.shouldIgnore(relativePath)) return true;
    const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
  }

  redact(value: string): string {
    let result = value;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }

  redactProfile(profile: FileIntelligenceProfile): FileIntelligenceProfile {
    const r = (s: string | undefined): string | undefined => (s ? this.redact(s) : s);
    const rArr = (arr: string[] | undefined): string[] | undefined =>
      arr ? arr.map(s => this.redact(s)) : arr;

    return {
      ...profile,
      summary: r(profile.summary),
      responsibilities: rArr(profile.responsibilities),
      publicSymbols: rArr(profile.publicSymbols),
      knownRisks: rArr(profile.knownRisks),
      commonReasonsToChange: rArr(profile.commonReasonsToChange),
      reviewFindings: profile.reviewFindings?.map(f => ({ ...f, message: this.redact(f.message) })),
      debugFindings: profile.debugFindings?.map(f => ({ ...f, description: this.redact(f.description) })),
    };
  }
}
