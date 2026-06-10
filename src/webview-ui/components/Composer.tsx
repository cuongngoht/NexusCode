import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, MenuTrigger, MenuList, MenuItem, MenuPopover } from '@fluentui/react-components';
import { IconAdd, IconStop, IconDoc, IconClose, IconArrowUp, IconAgent } from '../NexusIcons';
import { useT, interp } from '../i18n';
import type { AgentModeCapability, AgentRecommendation, ProviderId, TaskMode, ProviderInfo, GitReviewContext, PromptAttachment } from '../messages';
import { InlineRecommendationBanner } from './InlineRecommendationBanner';
import { AgentChipSelector } from './AgentChipSelector';

interface Props {
  isRunning: boolean;
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
}

export function Composer({
  isRunning, elapsed, provider, mode,
  availableProviders, providerDetection,
  agentCapabilityMatrix, agentRecommendations,
  reviewContext, reviewContextError,
  attachments, onAttachmentsChange,
  workspaceFiles, onRequestWorkspaceFiles,
  onRun, onStop, onProviderChange, onModeChange,
  onRefreshReviewContext, onOpenReviewAgentFile,
  subagentsEnabled, onToggleSubagents, onLoginProvider,
  onResolveDroppedFiles,
}: Props) {
  const t = useT();
  const [prompt, setPrompt] = useState('');
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [fileSearch, setFileSearch] = useState('');
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileSearchRef = useRef<HTMLInputElement>(null);

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

  const handleRun = useCallback(() => {
    const trimmed = prompt.trim();
    if ((!trimmed && mode !== 'review') || isRunning) return;
    onRun(trimmed, mode === 'review' ? selectedBase || undefined : undefined, attachments);
    setPrompt('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  }, [prompt, isRunning, mode, attachments, onRun]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun],
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const removeAttachment = (i: number) =>
    onAttachmentsChange(attachments.filter((_, j) => j !== i));

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    if (--dragCounter.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const paths = extractDroppedPaths(e);
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
            <div className="nx-review-error">{reviewContextError}</div>
          )}

          {reviewContext?.message && (
            <div className="nx-review-error">{reviewContext.message}</div>
          )}

          {reviewContext && !reviewContext.message && (
            <div className="nx-review-meta">
              <span>{interp(t.review.metaChangedFiles, { count: String(reviewContext.changedFiles.length) })}</span>
            </div>
          )}

          {reviewContext?.diffStat && (
            <pre className="nx-review-stat">{reviewContext.diffStat}</pre>
          )}
        </div>
      )}

      <div
        className={`fl-cmp-box${isDragOver ? ' fl-cmp-box--drag' : ''}`}
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

        <div className="fl-cmp-bar">
          <div className="fl-cmp-bar-left">
            <button
              type="button"
              className={`fl-cmp-add${showFilePicker ? ' fl-cmp-add--active' : ''}`}
              title={t.composer.attachFile}
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
                  {(['ask', 'edit', 'research', 'brainstorm', 'review', 'debug', 'plan', 'test', 'scan-project'] as TaskMode[]).map(m => {
                    const modeT = (t.mode as Record<string, { label: string; desc: string }>)[m];
                    return (
                      <MenuItem
                        key={m}
                        className={`nx-mode-menu-item${mode === m ? ' nx-mode-menu-item--active' : ''}`}
                        onClick={() => onModeChange(m)}
                      >
                        <span className="nx-mode-menu-item-main">
                          <span>{modeT?.label ?? m}</span>
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
                <button type="button" className="fl-cmp-stop-btn" title={t.composer.stop} onClick={onStop}>
                  <IconStop size={13} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="fl-cmp-send-btn"
                disabled={mode !== 'review' && !prompt.trim()}
                title={mode === 'review' ? t.review.sendTitle : t.composer.send}
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
}

function extractDroppedPaths(e: React.DragEvent): string[] {
  const paths: string[] = [];
  // Electron File objects expose an absolute .path property
  for (const file of Array.from(e.dataTransfer.files)) {
    const p = (file as unknown as { path?: string }).path;
    if (p) paths.push(p);
  }
  // Fallback: text/uri-list (VS Code Explorer drag or non-Electron)
  if (paths.length === 0) {
    const uriList = e.dataTransfer.getData('text/uri-list');
    for (const line of uriList.split(/\r?\n/)) {
      const uri = line.trim();
      if (!uri || uri.startsWith('#')) continue;
      if (uri.startsWith('file://')) {
        try { paths.push(decodeURIComponent(uri.replace(/^file:\/\//, ''))); } catch { /* ignore */ }
      }
    }
  }
  return paths;
}
