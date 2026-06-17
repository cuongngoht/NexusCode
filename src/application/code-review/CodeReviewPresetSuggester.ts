import type { CodeReviewContext } from './CodeReviewContextBuilder';
import type { CodeReviewPreset } from './CodeReviewPromptBuilder';

const SECURITY_PATTERNS = [
  /auth/i, /crypt/i, /password/i, /secret/i, /token/i, /\.env/,
  /sql/i, /query/i, /inject/i, /permission/i, /privilege/i, /oauth/i,
];

function isSecuritySensitive(filePath: string): boolean {
  return SECURITY_PATTERNS.some(re => re.test(filePath));
}

export interface PresetSuggestion {
  preset: CodeReviewPreset;
  reason: string;
}

export function suggestPreset(
  ctx: CodeReviewContext,
  configPreset: CodeReviewPreset,
): PresetSuggestion {
  const fileCount = ctx.changedFiles.length;
  const diffChars = ctx.diff.length;

  // Large diff — reduce depth to avoid token blowout
  if (diffChars > 40000 || fileCount > 30) {
    return {
      preset: 'fast',
      reason: fileCount > 30
        ? `Large PR detected (${fileCount} files) — using "fast" preset`
        : `Large diff detected (${Math.round(diffChars / 1000)}K chars) — using "fast" preset`,
    };
  }

  // Security-sensitive files — escalate to safe preset
  if (ctx.changedFiles.some(f => isSecuritySensitive(f.path))) {
    return {
      preset: 'safe',
      reason: 'Security-sensitive files detected — using "safe" preset',
    };
  }

  // Small diff — run full depth
  if (diffChars < 3000 && fileCount < 5) {
    return {
      preset: 'full',
      reason: `Small change (${fileCount} file${fileCount !== 1 ? 's' : ''}) — using "full" preset`,
    };
  }

  // Use config preset for everything else
  return { preset: configPreset, reason: '' };
}
