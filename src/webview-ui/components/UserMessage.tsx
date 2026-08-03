import type { UserMessage as UserMsg } from '../messages';
import { AttachmentThumb } from './AttachmentThumb';

interface Props {
  message: UserMsg;
}

export function UserMessage({ message }: Props) {
  const attachments = message.attachments ?? [];
  const images = attachments.filter(a => a.type === 'image');
  const others = attachments.filter(a => a.type !== 'image');

  return (
    <div className="fl-row fl-row-user" data-style="bubble">
      <div className="fl-user-msg">
        {images.length > 0 && (
          <div className="fl-user-msg-images">
            {images.map(a => (
              <AttachmentThumb key={a.path} path={a.path} size={120} />
            ))}
          </div>
        )}
        {message.prompt && <div className="fl-user-text">{message.prompt}</div>}
        {others.length > 0 && (
          <div className="fl-user-msg-atts">
            {others.map(a => (
              <span key={a.path}>{a.path}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
