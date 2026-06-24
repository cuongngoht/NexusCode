import React, { useState } from 'react';
import { Button, Divider, Text, Accordion, AccordionItem, AccordionHeader, AccordionPanel, Select } from '@fluentui/react-components';
import { ArrowExport24Regular } from '@fluentui/react-icons';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { ReviewOverview } from './ReviewOverview';
import { ReviewFindingTable } from './ReviewFindingTable';
import { ReviewFileTree } from './ReviewFileTree';
import { ReviewArchitectureScoreCard } from './ReviewArchitectureScoreCard';
import { ReviewFindingList } from './ReviewFindingList';
import { ReviewSubagentTimeline } from './ReviewSubagentTimeline';
import { useT } from '../../i18n';
import { getVsCodeApi } from '../../vscodeApi';

interface SubagentTraceItem {
  role: string;
  displayName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
  confidence?: number;
  findingCount?: number;
  error?: string;
}
interface SubagentTraceState { runId: string; items: SubagentTraceItem[]; }

interface Props {
  report: CodeReviewReport;
  history?: CodeReviewReport[];
  onSelectReport?: (report: CodeReviewReport) => void;
  onClearHistory?: () => void;
  subagentTrace?: SubagentTraceState | null;
  subagentSynthesis?: { topFindings: number; files: string[]; risks: string[]; confidence: number } | null;
}

const ARCH_CATEGORIES = new Set([
  'architecture', 'oop', 'ood', 'design-pattern',
  'coupling', 'cohesion', 'abstraction', 'dependency-direction',
]);
const PERF_CATEGORIES = new Set(['performance']);

export function ReviewPanel({ report, history = [], onSelectReport, onClearHistory, subagentTrace, subagentSynthesis }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;

  // Keep onClearHistory in scope to avoid unused-variable warning; used in accordion
  void onClearHistory;

  const archFindings = report.findings.filter(f => ARCH_CATEGORIES.has(f.category));
  const perfFindings = report.findings.filter(f => PERF_CATEGORIES.has(f.category));
  const allFindings = report.findings; // table shows everything, category filter handles arch

  function exportReport(): void {
    getVsCodeApi().postMessage({ type: 'exportCodeReviewReport', reportId: report.id });
  }

  function handleHistorySelect(e: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = history.find(r => r.id === e.target.value);
    if (selected && onSelectReport) onSelectReport(selected);
  }

  const [accordionOpen, setAccordionOpen] = useState<string[]>([]);

  const openItems = accordionOpen;
  function toggleItem(value: string): void {
    setAccordionOpen(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <Text weight="semibold" size={500}>{s.panelTitle}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {history.length > 1 && (
            <Select
              size="small"
              value={report.id}
              onChange={handleHistorySelect}
              aria-label={s.selectHistory}
              style={{ maxWidth: '220px' }}
            >
              {history.map(r => {
                const date = new Date(r.generatedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                });
                return (
                  <option key={r.id} value={r.id}>
                    {r.baseBranch ?? 'review'} — {date}
                  </option>
                );
              })}
            </Select>
          )}
          <Button appearance="subtle" size="small" icon={<ArrowExport24Regular />} onClick={exportReport}>
            {s.exportReport}
          </Button>
        </div>
      </div>

      {/* Section 1: Overview */}
      <ReviewOverview report={report} />

      <Divider />

      {/* Section 2: Findings table */}
      <div>
        <Text weight="semibold" size={400} style={{ display: 'block', marginBottom: '10px' }}>
          {s.findingsSection} ({allFindings.length})
        </Text>
        <ReviewFindingTable findings={allFindings} />
      </div>

      {/* Collapsible sections */}
      <Accordion
        multiple
        openItems={openItems}
        onToggle={(_, data) => toggleItem(data.value as string)}
      >
        {/* Files changed */}
        {report.changedFiles.length > 0 && (
          <AccordionItem value="files">
            <AccordionHeader size="small">
              <Text weight="semibold" size={300}>{s.tabFiles} ({report.changedFiles.length})</Text>
            </AccordionHeader>
            <AccordionPanel>
              <ReviewFileTree report={report} />
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Architecture details */}
        {(archFindings.length > 0 || report.architectureScore) && (
          <AccordionItem value="architecture">
            <AccordionHeader size="small">
              <Text weight="semibold" size={300}>{s.tabArchitecture} ({archFindings.length})</Text>
            </AccordionHeader>
            <AccordionPanel>
              {report.architectureScore && (
                <ReviewArchitectureScoreCard score={report.architectureScore} />
              )}
              {archFindings.length > 0 && (
                <ReviewFindingList findings={archFindings} />
              )}
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Performance details */}
        {perfFindings.length > 0 && (
          <AccordionItem value="performance">
            <AccordionHeader size="small">
              <Text weight="semibold" size={300}>{s.tabPerformance} ({perfFindings.length})</Text>
            </AccordionHeader>
            <AccordionPanel>
              <ReviewFindingList findings={perfFindings} />
            </AccordionPanel>
          </AccordionItem>
        )}

        {/* Subagent trace */}
        {subagentTrace && subagentTrace.items.length > 0 && (
          <AccordionItem value="subagents">
            <AccordionHeader size="small">
              <Text weight="semibold" size={300}>{s.subagentSection}</Text>
            </AccordionHeader>
            <AccordionPanel>
              <ReviewSubagentTimeline trace={subagentTrace} synthesis={subagentSynthesis} />
            </AccordionPanel>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
