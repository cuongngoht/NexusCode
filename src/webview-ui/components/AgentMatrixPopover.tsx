import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import type { AgentModeCapability, AgentRecommendation, ProviderId, TaskMode } from '../messages';
import { AgentCapabilityMatrix } from './AgentCapabilityMatrix';

interface Props {
  open: boolean;
  mode: TaskMode;
  provider: ProviderId;
  matrix: AgentModeCapability[];
  recommendations: AgentRecommendation[];
  availableProviders: string[];
  anchor: HTMLButtonElement | null;
  onClose: () => void;
  onProviderChange: (id: ProviderId) => void;
}

interface Position {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

function computePosition(anchor: HTMLButtonElement | null): Position {
  if (!anchor) return { bottom: 8, right: 8 };
  const rect = anchor.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const popoverW = Math.min(560, viewportW * 0.92);

  const spaceBelow = viewportH - rect.bottom;
  const spaceAbove = rect.top;

  let top: number | undefined;
  let bottom: number | undefined;
  if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
    top = rect.bottom + 6;
  } else {
    bottom = viewportH - rect.top + 6;
  }

  const left = Math.max(8, Math.min(rect.left, viewportW - popoverW - 8));

  return { top, bottom, left };
}

export function AgentMatrixPopover({
  open, mode, provider, matrix, recommendations, availableProviders,
  anchor, onClose, onProviderChange,
}: Props) {
  const t = useT();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position>({ bottom: 8, right: 8 });

  useEffect(() => {
    if (open) setPos(computePosition(anchor));
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const style: React.CSSProperties = {
    top: pos.top !== undefined ? pos.top : undefined,
    bottom: pos.bottom !== undefined ? pos.bottom : undefined,
    left: pos.left !== undefined ? pos.left : undefined,
    right: pos.right !== undefined ? pos.right : undefined,
  };

  return (
    <div ref={popoverRef} className="nx-agent-matrix-popover" style={style} role="dialog" aria-label={t.agentCapability.matrixTitle}>
      <div className="nx-agent-matrix-popover-header">
        <span className="nx-agent-matrix-popover-title">{t.agentCapability.matrixTitle}</span>
        <button
          type="button"
          className="nx-agent-matrix-popover-close"
          onClick={onClose}
          aria-label={t.agentCapability.closeMatrix}
        >
          ×
        </button>
      </div>
      <AgentCapabilityMatrix
        mode={mode}
        provider={provider}
        availableProviders={availableProviders}
        matrix={matrix}
        recommendations={recommendations}
        onProviderChange={(id) => { onProviderChange(id); onClose(); }}
        compact
      />
    </div>
  );
}
