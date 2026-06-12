import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff } from './structuredDiff';

const MODIFIED_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index abc..def 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,4 +1,5 @@
 import foo from 'foo';
-const x = 1;
+const x = 2;
+const y = 3;
 export default x;
`;

const ADDED_DIFF = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const a = 1;
+export const b = 2;
`;

const DELETED_DIFF = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const a = 1;
-export const b = 2;
`;

const RENAMED_DIFF = `diff --git a/src/old.ts b/src/new.ts
rename from src/old.ts
rename to src/new.ts
`;

const BINARY_DIFF = `diff --git a/img.png b/img.png
index abc..def 100644
Binary files a/img.png and b/img.png differ
`;

const MULTI_HUNK_DIFF = `diff --git a/src/big.ts b/src/big.ts
index abc..def 100644
--- a/src/big.ts
+++ b/src/big.ts
@@ -1,3 +1,3 @@
 line1
-line2a
+line2b
 line3
@@ -10,3 +10,3 @@
 line10
-line11a
+line11b
 line12
`;

describe('parseUnifiedDiff', () => {
  it('parses a modified file', () => {
    const result = parseUnifiedDiff(MODIFIED_DIFF);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/foo.ts');
    expect(result[0].status).toBe('modified');
    expect(result[0].additions).toBe(2);
    expect(result[0].deletions).toBe(1);
  });

  it('parses an added file', () => {
    const result = parseUnifiedDiff(ADDED_DIFF);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('added');
    expect(result[0].additions).toBe(2);
    expect(result[0].deletions).toBe(0);
  });

  it('parses a deleted file', () => {
    const result = parseUnifiedDiff(DELETED_DIFF);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('deleted');
    expect(result[0].additions).toBe(0);
    expect(result[0].deletions).toBe(2);
  });

  it('parses a renamed file', () => {
    const result = parseUnifiedDiff(RENAMED_DIFF);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('renamed');
    expect(result[0].path).toBe('src/new.ts');
    expect(result[0].oldPath).toBe('src/old.ts');
  });

  it('handles binary files safely', () => {
    const result = parseUnifiedDiff(BINARY_DIFF);
    expect(result).toHaveLength(1);
    expect(result[0].isBinary).toBe(true);
    expect(result[0].hunks).toHaveLength(0);
  });

  it('parses multiple hunks', () => {
    const result = parseUnifiedDiff(MULTI_HUNK_DIFF);
    expect(result).toHaveLength(1);
    expect(result[0].hunks).toHaveLength(2);
  });

  it('returns isTooLarge for huge diffs', () => {
    const huge = 'x'.repeat(600_000);
    const result = parseUnifiedDiff(huge);
    expect(result).toHaveLength(1);
    expect(result[0].isTooLarge).toBe(true);
  });

  it('returns empty array for empty diff', () => {
    expect(parseUnifiedDiff('')).toHaveLength(0);
  });
});
