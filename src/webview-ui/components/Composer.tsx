import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Menu, MenuTrigger, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components';
import { IconAdd, IconStop, IconDoc, IconClose, IconArrowUp, IconAgent } from '../NexusIcons';
import { useT, interp } from '../i18n';
import type { AgentModeCapability, AgentRecommendation, ProviderId, TaskMode, ProviderInfo, GitReviewContext, PromptAttachment, AgentPrompt, AgentMentionState, SkillPrompt, SkillMentionState, CommandDef } from '../messages';
import { InlineRecommendationBanner } from './InlineRecommendationBanner';
import { AgentChipSelector } from './AgentChipSelector';
import { ErrorBanner } from './ErrorBanner';
import { filterPromptReferenceCandidates } from '../../context/promptReferenceCompletion';

type RiskLevel = 'readonly' | 'plan' | 'mutate';

const MODE_RISK: Record<TaskMode, RiskLevel> = {
  ask: 'readonly',
  research: 'readonly',
  'scan-project': 'readonly',
  brainstorm: 'readonly',
  plan: 'plan',
  review: 'readonly',
  edit: 'mutate',
  debug: 'mutate',
  test: 'mutate',
  agent: 'mutate',
};

const RISK_DOT_CLASS: Record<RiskLevel, string> = {
  readonly: 'nx-mode-risk-dot--readonly',
  plan: 'nx-mode-risk-dot--plan',
  mutate: 'nx-mode-risk-dot--mutate',
};

interface Props {
  isRunning: boolean;
  isStopping?: boolean;
  elapsed: number;
  provider: ProviderId;
  mode: TaskMode;
  availableProviders: string[];
  providerDetection: ProviderInfo[];
  agentCapabilityMatrix: AgentModeCapability[];
  agentRecommendations: AgentRecommendation[];
  reviewContext?: GitReviewContext;
  reviewContextError?: string;
  attachments: PromptAttachment[];
  onAttachmentsChange: (attachments: PromptAttachment[]) => void;
  workspaceFiles: string[];
  onRequestWorkspaceFiles: () => void;
  onRun: (prompt: string, baseBranch?: string, attachments?: PromptAttachment[]) => void;
  onStop: () => void;
  onProviderChange: (v: ProviderId) => void;
  onModeChange: (v: TaskMode) => void;
  onRefreshReviewContext: (baseBranch?: string) => void;
  onOpenReviewAgentFile: () => void;
  subagentsEnabled: boolean;
  onToggleSubagents: () => void;
  onLoginProvider: (id: ProviderId) => void;
  onResolveDroppedFiles: (paths: string[]) => void;
  agentPrompts: AgentPrompt[];
  agentMention?: AgentMentionState;
  onAgentMentionChange: (state: AgentMentionState | undefined) => void;
  onReloadAgents: () => void;
  skillPrompts: SkillPrompt[];
  skillMention?: SkillMentionState;
  onSkillMentionChange: (state: SkillMentionState | undefined) => void;
  onReloadSkills: () => void;
  onResearchCommand: (action: 'done' | 'current' | 'next' | 'list' | 'reload') => void;
  onCompactCommand: (action: 'compact' | 'show' | 'clear') => void;
  commandDefs: CommandDef[];
  onReloadCommands: () => void;
}

interface SlashCommand {
  id: string;
  description: string;
  run: () => void;
}

interface SlashMention {
  query: string;
  selectedIndex: number;
}

function nextSelectionIndex(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return 0;
  return (current + delta + length) % length;
}

export interface ComposerRef {
  focus(): void;
  insertText(text: string): void;
}

export const Composer = forwardRef<ComposerRef, Props>(function Composer({
  isRunning, isStopping, elapsed, provider, mode,
  availableProviders, providerDetection,
  agentCapabilityMatrix, agentRecommendations,
  reviewContext, reviewContextError,
  attachments, onAttachmentsChange,
  workspaceFiles, onRequestWorkspaceFiles,
  onRun, onStop, onProviderChange, onModeChange,
  onRefreshReviewContext, onOpenReviewAgentFile,
  subagentsEnabled, onToggleSubagents, onLoginProvider,
  onResolveDroppedFiles,
  agentPrompts, agentMention, onAgentMentionChange, onReloadAgents,
  skillPrompts, skillMention, onSkillMentionChange, onReloadSkills,
  onResearchCommand,
  onCompactCommand,
  commandDefs, onReloadCommands,
}: Props, ref) {
  const t = useT();
  const [prompt, setPrompt] = useState('');
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [fileSearch, setFileSearch] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [slashMention, setSlashMention] = useState<SlashMention | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileSearchRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    insertText: (text: string) => {
      setPrompt(prev => prev ? prev + '\n\n' + text : text);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
  }));

  // Sync selectedBase when reviewContext first loads or the server returns a different base branch
  useEffect(() => {
    if (reviewContext?.baseBranch && reviewContext.baseBranch !== selectedBase) {
      setSelectedBase(reviewContext.baseBranch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewContext?.baseBranch]);

  // Close file picker on Escape
  useEffect(() => {
    if (!showFilePicker) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowFilePicker(false); setFileSearch(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showFilePicker]);

  // Focus search input when picker opens
  useEffect(() => {
    if (showFilePicker) fileSearchRef.current?.focus();
  }, [showFilePicker]);

  const filteredFiles = useMemo(() => {
    const q = fileSearch.toLowerCase();
    const already = new Set(attachments.map(a => a.path));
    if (!q) return workspaceFiles.filter(f => !already.has(f)).slice(0, 10);
    // Score: 0 = filename starts with query, 1 = filename contains, 2 = path contains
    type Scored = { f: string; score: number };
    const scored: Scored[] = [];
    for (const f of workspaceFiles) {
      if (already.has(f)) continue;
      const name = f.includes('/') ? f.slice(f.lastIndexOf('/') + 1).toLowerCase() : f.toLowerCase();
      if (name.startsWith(q)) scored.push({ f, score: 0 });
      else if (name.includes(q)) scored.push({ f, score: 1 });
      else if (f.toLowerCase().includes(q)) scored.push({ f, score: 2 });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, 60).map(r => r.f);
  }, [workspaceFiles, fileSearch, attachments]);

  const openFilePicker = useCallback(() => {
    setShowFilePicker(true);
    setFileSearch('');
    if (workspaceFiles.length === 0) onRequestWorkspaceFiles();
  }, [workspaceFiles.length, onRequestWorkspaceFiles]);

  const pickFile = useCallback((filePath: string) => {
    onAttachmentsChange([...attachments, { type: 'file', path: filePath }]);
    setShowFilePicker(false);
    setFileSearch('');
  }, [attachments, onAttachmentsChange]);

  const slashCommands = useMemo<SlashCommand[]>(() => [
    {
      id: 'reload-agents',
      description: t.composer.cmdReloadAgents,
      run: () => { onReloadAgents(); setPrompt(''); },
    },
    {
      id: 'reload-skills',
      description: t.composer.cmdReloadSkills,
      run: () => { onReloadSkills(); setPrompt(''); },
    },
    {
      id: 'research done',
      description: t.composer.cmdResearchDone,
      run: () => { onResearchCommand('done'); setPrompt(''); },
    },
    {
      id: 'research current',
      description: t.composer.cmdResearchCurrent,
      run: () => { onResearchCommand('current'); setPrompt(''); },
    },
    {
      id: 'research next',
      description: t.composer.cmdResearchNext,
      run: () => { onResearchCommand('next'); setPrompt(''); },
    },
    {
      id: 'research list',
      description: t.composer.cmdResearchList,
      run: () => { onResearchCommand('list'); setPrompt(''); },
    },
    {
      id: 'research reload',
      description: t.composer.cmdResearchReload,
      run: () => { onResearchCommand('reload'); setPrompt(''); },
    },
    {
      id: 'compact',
      description: t.composer.cmdCompact,
      run: () => { onCompactCommand('compact'); setPrompt(''); },
    },
    {
      id: 'show-compact',
      description: t.composer.cmdShowCompact,
      run: () => { onCompactCommand('show'); setPrompt(''); },
    },
    {
      id: 'clear-compact',
      description: t.composer.cmdClearCompact,
      run: () => { onCompactCommand('clear'); setPrompt(''); },
    },
    {
      id: 'reload-commands',
      description: t.composer.cmdReloadCommands,
      run: () => { onReloadCommands(); setPrompt(''); },
    },
    // Dynamic workflow commands loaded from media/commands/ files
    ...commandDefs.map(def => ({
      id: def.id,
      description: def.description,
      run: () => { onRun(def.promptTemplate, undefined, []); setPrompt(''); },
    })),
  ], [
    onReloadAgents, onReloadSkills, onResearchCommand, onCompactCommand,
    onReloadCommands, commandDefs, onRun,
    t.composer.cmdReloadAgents, t.composer.cmdReloadSkills,
    t.composer.cmdResearchDone, t.composer.cmdResearchCurrent,
    t.composer.cmdResearchNext, t.composer.cmdResearchList,
    t.composer.cmdResearchReload,
    t.composer.cmdCompact, t.composer.cmdShowCompact, t.composer.cmdClearCompact,
    t.composer.cmdReloadCommands,
  ]);

  const handleRun = useCallback(() => {
    const trimmed = prompt.trim();
    // Dispatch any recognized slash command that was typed and submitted manually
    if (trimmed.startsWith('/')) {
      const cmdId = trimmed.slice(1);
      const cmd = slashCommands.find(c => c.id === cmdId);
      if (cmd) {
        cmd.run();
        setPrompt('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        return;
      }
    }
    if ((!trimmed && mode !== 'review') || isRunning) return;
    onRun(trimmed, mode === 'review' ? selectedBase || undefined : undefined, attachments);
    setPrompt('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  }, [prompt, isRunning, mode, attachments, onRun, slashCommands]);

  const filteredSlash = useMemo(() => {
    if (!slashMention) return [];
    const q = slashMention.query.toLowerCase();
    return filterPromptReferenceCandidates(
      slashCommands.map(command => ({
        ...command,
        title: command.description,
      })),
      q,
      12,
    );
  }, [slashCommands, slashMention]);

  const filteredAgents = useMemo(() => {
    if (!agentMention) return [];
    return filterPromptReferenceCandidates(
      agentPrompts.map(agent => ({
        ...agent,
        title: agent.displayName,
        description: agent.fileName,
      })),
      agentMention.query,
      12,
    );
  }, [agentPrompts, agentMention]);

  const filteredSkills = useMemo(() => {
    if (!skillMention) return [];
    return filterPromptReferenceCandidates(
      skillPrompts.map(skill => ({
        ...skill,
        title: skill.displayName,
        description: skill.fileName,
      })),
      skillMention.query,
      12,
    );
  }, [skillPrompts, skillMention]);

  const modeFitMap = useMemo(() => {
    const map = new Map<TaskMode, string>();
    if (provider === 'auto' || provider === 'nexus') return map;
    for (const cap of agentCapabilityMatrix) {
      if (cap.agentId === provider) map.set(cap.mode, cap.fit);
    }
    return map;
  }, [agentCapabilityMatrix, provider]);

  // Auto-fallback to 'ask' when the current mode becomes unsupported after a provider switch
  useEffect(() => {
    if (modeFitMap.size > 0 && modeFitMap.get(mode) === 'unsupported') {
      onModeChange('ask');
    }
  }, [modeFitMap, mode, onModeChange]);

  const selectAgent = useCallback((id: string) => {
    if (!agentMention) return;
    const before = prompt.slice(0, agentMention.triggerIndex);
    const after = prompt.slice(agentMention.triggerIndex + 1 + agentMention.query.length);
    const newPrompt = `${before}@${id} ${after}`;
    setPrompt(newPrompt);
    onAgentMentionChange(undefined);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [agentMention, prompt, onAgentMentionChange]);

  const selectSkill = useCallback((id: string) => {
    if (!skillMention) return;
    const before = prompt.slice(0, skillMention.triggerIndex);
    const after = prompt.slice(skillMention.triggerIndex + 1 + skillMention.query.length);
    const newPrompt = `${before}#${id} ${after}`;
    setPrompt(newPrompt);
    onSkillMentionChange(undefined);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [skillMention, prompt, onSkillMentionChange]);

  const selectSlash = useCallback((cmd: SlashCommand) => {
    setSlashMention(undefined);
    cmd.run();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashMention && filteredSlash.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashMention({ ...slashMention, selectedIndex: nextSelectionIndex(slashMention.selectedIndex, 1, filteredSlash.length) });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashMention({ ...slashMention, selectedIndex: nextSelectionIndex(slashMention.selectedIndex, -1, filteredSlash.length) });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const cmd = filteredSlash[slashMention.selectedIndex] ?? filteredSlash[0];
          if (cmd) selectSlash(cmd);
          return;
        }
        if (e.key === 'Escape') {
          setSlashMention(undefined);
          return;
        }
      }
      if (agentMention && filteredAgents.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          onAgentMentionChange({ ...agentMention, selectedIndex: nextSelectionIndex(agentMention.selectedIndex, 1, filteredAgents.length) });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onAgentMentionChange({ ...agentMention, selectedIndex: nextSelectionIndex(agentMention.selectedIndex, -1, filteredAgents.length) });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const agent = filteredAgents[agentMention.selectedIndex] ?? filteredAgents[0];
          if (agent) selectAgent(agent.id);
          return;
        }
        if (e.key === 'Escape') {
          onAgentMentionChange(undefined);
          return;
        }
      }
      if (skillMention && filteredSkills.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          onSkillMentionChange({ ...skillMention, selectedIndex: nextSelectionIndex(skillMention.selectedIndex, 1, filteredSkills.length) });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onSkillMentionChange({ ...skillMention, selectedIndex: nextSelectionIndex(skillMention.selectedIndex, -1, filteredSkills.length) });
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const skill = filteredSkills[skillMention.selectedIndex] ?? filteredSkills[0];
          if (skill) selectSkill(skill.id);
          return;
        }
        if (e.key === 'Escape') {
          onSkillMentionChange(undefined);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun, slashMention, filteredSlash, selectSlash, agentMention, filteredAgents, onAgentMentionChange, selectAgent, skillMention, filteredSkills, onSkillMentionChange, selectSkill],
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';

    // Detect / slash command trigger (only when entire prompt starts with /)
    const slashMatch = val.match(/^\/([a-zA-Z0-9-]*)$/);
    if (slashMatch) {
      setSlashMention({ query: slashMatch[1], selectedIndex: 0 });
      if (agentMention) onAgentMentionChange(undefined);
      return;
    }
    if (slashMention) setSlashMention(undefined);

    // Detect @mention trigger
    const cursorPos = ta.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
    if (atMatch && atMatch.index !== undefined) {
      onAgentMentionChange({ triggerIndex: atMatch.index, query: atMatch[1], selectedIndex: 0 });
      if (skillMention) onSkillMentionChange(undefined);
    } else {
      if (agentMention) onAgentMentionChange(undefined);

      // Detect #mention trigger
      const hashMatch = beforeCursor.match(/#([a-zA-Z0-9_-]*)$/);
      if (hashMatch && hashMatch.index !== undefined) {
        onSkillMentionChange({ triggerIndex: hashMatch.index, query: hashMatch[1], selectedIndex: 0 });
      } else {
        if (skillMention) onSkillMentionChange(undefined);
      }
    }
  };

  const removeAttachment = (i: number) =>
    onAttachmentsChange(attachments.filter((_, j) => j !== i));

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const next = (e.relatedTarget as Node) || null;
    if (next && (e.currentTarget as Node).contains(next)) return;
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const paths = extractDroppedPaths(e);
    console.log('[Composer] handleDrop extracted paths:', paths);
    if (paths.length > 0) onResolveDroppedFiles(paths);
  };

  const currentProviderInfo = providerDetection.find(d => d.id === provider);
  const showLoginBanner = !!(
    currentProviderInfo?.installed &&
    (currentProviderInfo.authStatus === 'unauthenticated' || currentProviderInfo.loggedIn === false) &&
    currentProviderInfo.loginCommand
  );


  const closePicker = () => { setShowFilePicker(false); setFileSearch(''); };

  return (
    <>
    {showFilePicker && (
      <>
        <div className="fl-file-picker-backdrop" onClick={closePicker} />
        <div className="fl-file-picker" role="dialog" aria-label={t.composer.searchFiles}>
          <div className="fl-file-picker-search">
            <input
              ref={fileSearchRef}
              type="text"
              placeholder={t.composer.searchFiles}
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
              aria-label={t.composer.searchFiles}
            />
          </div>
          <div className="fl-file-picker-list">
            {filteredFiles.length === 0 ? (
              <div className="fl-file-picker-empty">
                {workspaceFiles.length === 0 ? t.composer.loadingFiles : t.composer.noFilesFound}
              </div>
            ) : (
              filteredFiles.map((f, i) => {
                const slash = f.lastIndexOf('/');
                const name = slash >= 0 ? f.slice(slash + 1) : f;
                const dir  = slash >= 0 ? f.slice(0, slash) : '';
                return (
                  <button
                    key={i}
                    type="button"
                    className="fl-file-picker-item"
                    onClick={() => pickFile(f)}
                    title={f}
                  >
                    <span className="fl-file-picker-name">{name}</span>
                    {dir && <span className="fl-file-picker-dir">{dir}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </>
    )}
    {showLoginBanner && (
      <div className="nx-login-banner">
        <span className="nx-login-banner-text">{t.provider.loginRequired}</span>
        <button
          type="button"
          className="nx-login-banner-btn"
          onClick={() => onLoginProvider(provider)}
        >
          {t.provider.login}
        </button>
      </div>
    )}
    <div className="fl-composer">
      {attachments.length > 0 && (
        <div className="fl-composer-atts">
          {attachments.map((a, i) => (
            <span key={i} className="fl-att-chip">
              <IconDoc size={13} />
              <span className="fl-att-chip-type">{a.type}</span>
              {a.path}
              <button
                type="button"
                className="fl-att-chip-remove"
                onClick={() => removeAttachment(i)}
                aria-label={interp(t.composer.removeAttachment, { name: a.path })}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {mode === 'review' && (
        <div className="nx-review-panel">
          <div className="nx-review-panel-header">
            <span className="nx-review-title">{t.review.panelTitle}</span>
            <div className="nx-review-actions">
              <button type="button" onClick={() => onRefreshReviewContext(selectedBase || undefined)} disabled={isRunning}>
                {t.review.refresh}
              </button>
              <button type="button" onClick={onOpenReviewAgentFile} disabled={isRunning}>
                {t.review.editAgent}
              </button>
            </div>
          </div>

          <div className="nx-review-branch-row">
            <div className="nx-review-branch-group">
              <label className="nx-review-branch-label">{t.review.labelBase}</label>
              {reviewContext?.availableBranches?.length ? (
                <select
                  className="nx-review-branch-select"
                  value={selectedBase}
                  disabled={isRunning}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedBase(val);
                    onRefreshReviewContext(val);
                  }}
                >
                  {reviewContext.availableBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <span className="nx-review-branch-value">{selectedBase || t.review.loading}</span>
              )}
            </div>

            <span className="nx-review-arrow">→</span>

            <div className="nx-review-branch-group">
              <label className="nx-review-branch-label">{t.review.labelCompare}</label>
              <span className="nx-review-branch-value nx-review-branch-value--compare">
                {reviewContext?.compareBranch || t.review.loading}
              </span>
            </div>
          </div>

          {reviewContextError && (
            <ErrorBanner severity="error" message={reviewContextError} />
          )}

          {reviewContext?.message && (
            <div className="nx-review-error">{reviewContext.message}</div>
          )}

          {reviewContext && !reviewContext.message && (
            <div className="nx-review-meta">
              <span>{interp(t.review.metaChangedFiles, { count: String(reviewContext.changedFiles.length) })}</span>
            </div>
          )}

          {reviewContext?.diffTruncated && (
            <ErrorBanner severity="warning" message={t.nexus.reviewTruncated} />
          )}

          {reviewContext?.diffStat && (
            <pre className="nx-review-stat">{reviewContext.diffStat}</pre>
          )}
        </div>
      )}

      {slashMention && filteredSlash.length > 0 && (
        <div className="fl-agent-mention-list" role="listbox" aria-label={t.composer.slashCommands}>
          {filteredSlash.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`fl-agent-mention-item${i === slashMention.selectedIndex ? ' fl-agent-mention-item--active' : ''}`}
              role="option"
              aria-selected={i === slashMention.selectedIndex}
              onMouseDown={e => { e.preventDefault(); selectSlash(cmd); }}
            >
              <span className="fl-agent-mention-name">/{cmd.id}</span>
              <span className="fl-agent-mention-display">{cmd.description}</span>
            </div>
          ))}
        </div>
      )}

      {agentMention && filteredAgents.length > 0 && (
        <div className="fl-agent-mention-list" role="listbox" aria-label={t.composer.agentMentionLabel}>
          {filteredAgents.map((a, i) => (
            <div
              key={a.id}
              className={`fl-agent-mention-item${i === agentMention.selectedIndex ? ' fl-agent-mention-item--active' : ''}`}
              role="option"
              aria-selected={i === agentMention.selectedIndex}
              onMouseDown={e => { e.preventDefault(); selectAgent(a.id); }}
            >
              <span className="fl-agent-mention-name">@{a.id}</span>
              <span className="fl-agent-mention-display">{a.displayName}</span>
            </div>
          ))}
        </div>
      )}

      {skillMention && filteredSkills.length > 0 && (
        <div className="fl-agent-mention-list" role="listbox" aria-label={t.composer.skillMentionLabel}>
          {filteredSkills.map((s, i) => (
            <div
              key={s.id}
              className={`fl-agent-mention-item${i === skillMention.selectedIndex ? ' fl-agent-mention-item--active' : ''}`}
              role="option"
              aria-selected={i === skillMention.selectedIndex}
              onMouseDown={e => { e.preventDefault(); selectSkill(s.id); }}
            >
              <span className="fl-agent-mention-name">#{s.id}</span>
              <span className="fl-agent-mention-display">{s.displayName}</span>
            </div>
          ))}
        </div>
      )}

      <div
        className={`fl-cmp-box${isDragOver ? ' fl-cmp-box--drag' : ''}`}
        role="form"
        aria-label={t.composer.formAriaLabel}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="fl-cmp-drop-overlay" aria-hidden="true">
            <IconDoc size={16} />
            <span>{t.composer.dropHere}</span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="fl-cmp-input fl-scroll"
          placeholder={mode === 'review' ? t.review.placeholder : t.composer.placeholder}
          value={prompt}
          rows={1}
          disabled={isRunning}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          aria-label={t.composer.promptAriaLabel}
        />

        {prompt.length > 4000 && (
          <div className={`fl-cmp-char-counter${prompt.length > 8000 ? ' fl-cmp-char-counter--warn' : ''}`}>
            {prompt.length > 8000
              ? interp(t.composer.promptTooLong, { n: prompt.length })
              : interp(t.composer.charCount, { n: prompt.length })}
          </div>
        )}

        <div className="fl-cmp-bar">
          <div className="fl-cmp-bar-left">
            <button
              type="button"
              className={`fl-cmp-add${showFilePicker ? ' fl-cmp-add--active' : ''}`}
              title={t.composer.attachFile}
              aria-label={t.composer.attachFile}
              onClick={openFilePicker}
            >
              <IconAdd size={16} />
            </button>
            <button
              type="button"
              className={`fl-cmp-subagents-btn${subagentsEnabled ? ' fl-cmp-subagents-btn--active' : ''}`}
              title={t.composer.subagentsTooltip}
              onClick={onToggleSubagents}
              disabled={isRunning}
            >
              <IconAgent size={13} />
              {t.composer.subagentsToggle}
            </button>
            <Menu positioning={{ position: 'above', align: 'start' }}>
              <MenuTrigger disableButtonEnhancement>
                <button
                  type="button"
                  className="nx-mode-pill"
                  disabled={isRunning}
                >
                  <span className="nx-mode-pill-label">
                    {(t.mode as Record<string, { label: string; desc: string }>)[mode]?.label ?? mode}
                  </span>
                  <span className="nx-mode-pill-chevron" aria-hidden="true">▾</span>
                </button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {(['ask', 'edit', 'agent', 'research', 'brainstorm', 'review', 'debug', 'plan', 'test', 'scan-project'] as TaskMode[]).map(m => {
                    const modeT = (t.mode as Record<string, { label: string; desc: string }>)[m];
                    const fit = modeFitMap.get(m);
                    const isUnsupported = fit === 'unsupported';
                    const isLimited = fit === 'limited';
                    const risk = MODE_RISK[m];
                    const riskText = risk === 'plan'
                      ? t.mode.riskPlan
                      : risk === 'mutate'
                        ? t.mode.riskMutate
                        : t.mode.riskReadOnly;
                    const itemTitle = isUnsupported
                      ? t.composer.modeUnsupported
                      : isLimited
                        ? `${t.composer.modeLimited}\n${riskText}`
                        : riskText;
                    return (
                      <MenuItem
                        key={m}
                        className={`nx-mode-menu-item${mode === m ? ' nx-mode-menu-item--active' : ''}${isUnsupported ? ' nx-mode-menu-item--unsupported' : ''}`}
                        onClick={() => !isUnsupported && onModeChange(m)}
                        disabled={isUnsupported}
                        title={itemTitle}
                      >
                        <span className="nx-mode-menu-item-main">
                          <span>
                            <span className={`nx-mode-risk-dot ${RISK_DOT_CLASS[risk]}`} aria-hidden="true" />
                            {modeT?.label ?? m}
                            {isLimited && <span className="nx-mode-fit-badge nx-mode-fit-badge--limited">!</span>}
                          </span>
                          <span className="nx-mode-menu-item-desc">{modeT?.desc}</span>
                        </span>
                      </MenuItem>
                    );
                  })}
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>

          <div className="fl-cmp-bar-right">
            {isRunning ? (
              <>
                <span className="fl-running" style={{ fontSize: 11.5 }}>
                  <span className="fl-spinner" style={{ width: 10, height: 10 }} />
                  {interp(t.composer.working, { elapsed })}
                </span>
                <button type="button" className="fl-cmp-stop-btn" title={isStopping ? t.composer.stopping : t.composer.stop} aria-label={isStopping ? t.composer.stopping : t.composer.stop} onClick={onStop} disabled={isStopping}>
                  <IconStop size={13} />
                  {isStopping && <span style={{ fontSize: 10, marginLeft: 4 }}>{t.composer.stopping}</span>}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="fl-cmp-send-btn"
                disabled={mode !== 'review' && !prompt.trim()}
                title={mode === 'review' ? t.review.sendTitle : t.composer.send}
                aria-label={mode === 'review' ? t.review.sendTitle : t.composer.send}
                onClick={handleRun}
              >
                <IconArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <InlineRecommendationBanner
        mode={mode}
        provider={provider}
        recommendations={agentRecommendations}
        onUseRecommended={onProviderChange}
      />

      {modeFitMap.size > 0 && modeFitMap.get(mode) === 'limited' && (
        <div className="nx-limited-mode-banner" role="status">
          <span className="nx-limited-mode-banner-icon" aria-hidden="true">⚠</span>
          {t.composer.modeLimited}
        </div>
      )}

      {(mode === 'edit' || mode === 'debug' || mode === 'test') && (
        <div className="nx-mode-mutate-hint" role="note">
          {t.nexus.mutatesFilesWarning}
        </div>
      )}

      <AgentChipSelector
        provider={provider}
        mode={mode}
        availableProviders={availableProviders}
        providerDetection={providerDetection}
        matrix={agentCapabilityMatrix}
        recommendations={agentRecommendations}
        disabled={isRunning}
        onProviderChange={onProviderChange}
      />

    </div>
    </>
  );
});

function extractDroppedPaths(e: React.DragEvent): string[] {
  const paths: string[] = [];

  // 1. Electron File objects (when available) expose absolute .path
  for (const file of Array.from(e.dataTransfer.files)) {
    const p = (file as unknown as { path?: string }).path;
    if (p) paths.push(p);
  }

  // 2. Always also harvest from text/uri-list (Explorer drags, Finder, non-Electron webviews, folders)
  //    Merge with primary so we don't lose anything.
  try {
    const uriList = e.dataTransfer.getData('text/uri-list') || '';
    for (const line of uriList.split(/\r?\n/)) {
      let uri = line.trim();
      if (!uri || uri.startsWith('#')) continue;

      // Support file://, file:///, file://localhost/, and vscode-file: variants
      if (/^file:\/\//i.test(uri) || /^vscode-file:\/\//i.test(uri)) {
        // Strip scheme + optional authority
        let p = uri.replace(/^(?:file|vscode-file):\/+/i, '/');
        // On Windows the result may be /C:/... — keep the leading / for path.normalize later
        try {
          p = decodeURIComponent(p);
        } catch {
          /* keep original if decode fails */
        }
        if (p && !paths.includes(p)) paths.push(p);
      } else if (uri && !paths.includes(uri)) {
        // Rare: plain path in the list
        paths.push(uri);
      }
    }
  } catch {
    /* ignore getData errors */
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of paths) {
    if (!seen.has(p)) {
      seen.add(p);
      unique.push(p);
    }
  }
  return unique;
}
