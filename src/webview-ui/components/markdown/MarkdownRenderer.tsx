import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { CopyButton } from './CopyButton';
import { LinkRenderer } from './LinkRenderer';
import { CodeBlock } from './CodeBlock';
import { CodeBlockActionsContext } from './CodeBlockActionsContext';
import { MermaidBlock } from './MermaidBlock';
import type { CodeBlockActions } from './CodeBlockActionsContext';
import type { Components, ExtraProps } from 'react-markdown';
import type { Element } from 'hast';

interface Props {
  content: string;
  className?: string;
  codeBlockActions?: CodeBlockActions;
}

const rehypeSanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
  },
};

type CodeProps = React.HTMLAttributes<HTMLElement> & ExtraProps;

function CodeBlockRenderer({ className, children, node }: CodeProps) {
  // Detect inline code: node's parent is not a 'pre' element
  const isInline = node?.type === 'element'
    ? (node as Element).tagName !== 'pre' && !((node as Element).properties?.['data-block'])
    : false;

  // Check parent — in react-markdown v10, code inside pre is block code
  // We use a heuristic: if className contains 'language-', it's a block code
  const match = /language-(\w+)/.exec(className ?? '');
  const lang = match ? match[1] : '';
  const text = String(children).replace(/\n$/, '');

  if (isInline && !lang) {
    return <code className={className}>{children}</code>;
  }

  if (lang === 'mermaid') {
    return <MermaidBlock diagram={text} />;
  }

  return <CodeBlock language={lang}>{text}</CodeBlock>;
}

const components: Components = {
  code: CodeBlockRenderer as Components['code'],
  a: LinkRenderer as Components['a'],
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className, codeBlockActions }: Props) {
  const rehypePlugins = useMemo(() => [
    [rehypeSanitize, rehypeSanitizeOptions] as [typeof rehypeSanitize, typeof rehypeSanitizeOptions],
    rehypeHighlight,
  ] as const, []);

  return (
    <CodeBlockActionsContext.Provider value={codeBlockActions ?? {}}>
      <div className={`nx-markdown ${className ?? ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </CodeBlockActionsContext.Provider>
  );
});
