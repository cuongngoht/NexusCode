import { describe, it, expect } from 'vitest';
import {
  detectLanguageFromText,
  detectLanguageFromManifests,
  detectLanguage,
} from './LanguageDetector';

describe('detectLanguageFromText', () => {
  it('detects TypeScript from TS error codes', () => {
    const result = detectLanguageFromText(
      `src/core/types.ts(12,5): error TS2345: Argument of type 'string' is not assignable to type 'number'.`
    );
    expect(result.language).toBe('typescript');
    expect(result.confidence).not.toBe('low');
  });

  it('detects Python from Traceback', () => {
    const result = detectLanguageFromText(
      `Traceback (most recent call last):\n  File "app/models.py", line 42, in get_user\nModuleNotFoundError: No module named 'myapp.models'`
    );
    expect(result.language).toBe('python');
    expect(result.confidence).not.toBe('low');
  });

  it('detects Python from ModuleNotFoundError alone', () => {
    const result = detectLanguageFromText('ModuleNotFoundError: No module named requests');
    expect(result.language).toBe('python');
  });

  it('detects Rust from error[E0308]', () => {
    const result = detectLanguageFromText(
      `error[E0308]: mismatched types\n --> src/main.rs:10:5\n  |\n10 |     "hello"\n  |     ^^^^^^^ expected (), found &str`
    );
    expect(result.language).toBe('rust');
    expect(result.confidence).not.toBe('low');
  });

  it('detects Go from goroutine panic', () => {
    const result = detectLanguageFromText(
      `goroutine 1 [running]:\nmain.main()\n\t/home/user/project/main.go:12 +0x40`
    );
    expect(result.language).toBe('go');
    expect(result.confidence).not.toBe('low');
  });

  it('detects Java from Exception in thread', () => {
    const result = detectLanguageFromText(
      `Exception in thread "main" java.lang.NullPointerException\n\tat com.example.App.main(App.java:10)`
    );
    expect(result.language).toBe('java');
    expect(result.confidence).not.toBe('low');
  });

  it('detects C# from CS error codes', () => {
    const result = detectLanguageFromText(
      `/home/user/Project/Program.cs(10,5): error CS0103: The name 'x' does not exist in the current context`
    );
    expect(result.language).toBe('csharp');
    expect(result.confidence).not.toBe('low');
  });

  it('detects Ruby from rb stack trace', () => {
    const result = detectLanguageFromText(
      `/app/models/user.rb:42:in 'save': undefined method 'email' (NoMethodError)`
    );
    expect(result.language).toBe('ruby');
  });

  it('returns unknown for plain English text', () => {
    const result = detectLanguageFromText('The button does not work when I click it');
    expect(result.language).toBe('unknown');
  });
});

describe('detectLanguageFromManifests', () => {
  it('detects TypeScript from tsconfig.json', () => {
    const result = detectLanguageFromManifests(['tsconfig.json', 'package.json']);
    expect(result.language).toBe('typescript');
    expect(result.confidence).toBe('high');
  });

  it('detects Python from pyproject.toml', () => {
    const result = detectLanguageFromManifests(['pyproject.toml', 'README.md']);
    expect(result.language).toBe('python');
    expect(result.confidence).toBe('high');
  });

  it('detects Rust from Cargo.toml', () => {
    const result = detectLanguageFromManifests(['Cargo.toml', 'src/main.rs']);
    expect(result.language).toBe('rust');
    expect(result.confidence).toBe('high');
  });

  it('detects Go from go.mod', () => {
    const result = detectLanguageFromManifests(['go.mod', 'go.sum']);
    expect(result.language).toBe('go');
    expect(result.confidence).toBe('high');
  });

  it('detects Java from pom.xml', () => {
    const result = detectLanguageFromManifests(['pom.xml']);
    expect(result.language).toBe('java');
    expect(result.confidence).toBe('high');
  });

  it('detects Ruby from Gemfile', () => {
    const result = detectLanguageFromManifests(['Gemfile', 'Gemfile.lock']);
    expect(result.language).toBe('ruby');
    expect(result.confidence).toBe('high');
  });

  it('returns unknown when no known manifests', () => {
    const result = detectLanguageFromManifests(['README.md', 'LICENSE']);
    expect(result.language).toBe('unknown');
  });
});

describe('detectLanguage (combined)', () => {
  it('prefers text detection when confidence is medium or higher', () => {
    // Python traceback is high-confidence text signal
    const result = detectLanguage(
      `Traceback (most recent call last):\n  File "app.py", line 10\nImportError: cannot import name 'foo'`,
      ['package.json', 'tsconfig.json']
    );
    expect(result.language).toBe('python');
  });

  it('falls back to manifest when text signal is unknown', () => {
    const result = detectLanguage('The button does not work', ['Cargo.toml']);
    expect(result.language).toBe('rust');
  });

  it('returns unknown when both sources give no signal', () => {
    const result = detectLanguage('The button does not work', ['README.md']);
    expect(result.language).toBe('unknown');
  });
});
