import type { UserMessage as UserMsg } from '../messages';

interface Props {
  message: UserMsg;
}

export function UserMessage({ message }: Props) {
  return (
    <div className="fl-row fl-row-user" data-style="bubble">
      <div className="fl-user-msg">
        <div className="fl-user-text">{message.prompt}</div>
      </div>
    </div>
  );
}
