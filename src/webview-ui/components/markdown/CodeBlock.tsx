import { CopyButton } from './CopyButton';

interface Props {
  language?: string;
  filename?: string;
  children: string;
}

export function CodeBlock({ language, filename, children }: Props) {
  return (
    <div className="nx-code-block">
      <div className="nx-code-block-header">
        <span className="nx-code-block-lang">{filename ?? language ?? 'text'}</span>
        <CopyButton text={children} className="nx-code-block-copy" />
      </div>
      <pre className={`nx-code-pre ${language ? `language-${language}` : ''}`}>
        <code>{children}</code>
      </pre>
    </div>
  );
}
