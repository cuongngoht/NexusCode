import type { AssistantMessage } from '../../messages';

interface Props {
  message: AssistantMessage;
}

export function MessageMetadataBar({ message }: Props) {
  const parts: string[] = [];

  if (message.providerLabel) parts.push(message.providerLabel);
  if (message.model) parts.push(message.model);
  if (message.mode) parts.push(message.mode);
  if (message.elapsed != null) parts.push(`${message.elapsed}s`);
  if (message.tokenUsage) {
    parts.push(`${message.tokenUsage.totalTokens.toLocaleString()} tokens`);
  }

  if (parts.length === 0) return null;

  return (
    <div className="nx-msg-meta-bar" aria-label="Message metadata">
      {parts.map((p, i) => (
        <span key={i} className="nx-msg-meta-item">{p}</span>
      ))}
      {message.fallbackChain && message.fallbackChain.length > 1 && (
        <span className="nx-msg-meta-fallback" title="Provider fallback occurred">
          &#x21AA; {message.fallbackChain.join(' → ')}
        </span>
      )}
    </div>
  );
}
