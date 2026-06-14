import React, { useState } from 'react';
import { Button, Tab, TabList, Text, Divider, Badge, Accordion, AccordionItem, AccordionHeader, AccordionPanel } from '@fluentui/react-components';
import { ArrowExport24Regular } from '@fluentui/react-icons';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { ReviewSummaryCard } from './ReviewSummaryCard';
import { ReviewFindingList } from './ReviewFindingList';
import { ReviewFileTree } from './ReviewFileTree';
import { ReviewArchitectureScoreCard } from './ReviewArchitectureScoreCard';
import { ReviewSubagentTimeline } from './ReviewSubagentTimeline';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { ReviewHistoryPanel } from './ReviewHistoryPanel';
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

type TabValue = 'summary' | 'findings' | 'architecture' | 'files' | 'history';

export function ReviewPanel({ report, history = [], onSelectReport, onClearHistory, subagentTrace, subagentSynthesis }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;
  const [activeTab, setActiveTab] = useState<TabValue>('summary');

  const archFindings = report.findings.filter(f =>
    f.category === 'architecture' ||
    f.category === 'oop' ||
    f.category === 'ood' ||
    f.category === 'design-pattern' ||
    f.category === 'coupling' ||
    f.category === 'cohesion' ||
    f.category === 'abstraction' ||
    f.category === 'dependency-direction'
  );
  const codeFindings = report.findings.filter(f => !archFindings.includes(f));

  function exportReport(): void {
    getVsCodeApi().postMessage({ type: 'exportCodeReviewReport', reportId: report.id });
  }

  const generatedDate = new Date(report.generatedAt).toLocaleString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text weight="semibold" size={500}>{s.panelTitle}</Text>
        <Button appearance="subtle" size="small" icon={<ArrowExport24Regular />} onClick={exportReport}>
          {s.exportReport}
        </Button>
      </div>

      <Divider />

      {/* Verdict + meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <Text weight="semibold">{s.verdict}:</Text>
          <ReviewVerdictBadge verdict={report.verdict} type="review" />
          {report.architectureVerdict && (
            <>
              <Text style={{ color: 'var(--vscode-descriptionForeground)' }}>{s.architectureVerdict}:</Text>
              <ReviewVerdictBadge verdict={report.architectureVerdict} type="architecture" />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {s.generatedAt}: {generatedDate}
          </Text>
          {report.baseBranch && (
            <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
              {s.target}: {report.baseBranch}
            </Text>
          )}
        </div>
      </div>

      {/* Subagent timeline */}
      {subagentTrace && subagentTrace.items.length > 0 && (
        <Accordion collapsible defaultOpenItems="subagents">
          <AccordionItem value="subagents">
            <AccordionHeader size="small">
              <Text weight="semibold" size={300}>{s.subagentSection}</Text>
              <Badge appearance="tint" color="brand" size="small" style={{ marginLeft: '8px' }}>
                {subagentTrace.items.filter(i => i.status === 'completed').length}/{subagentTrace.items.length}
              </Badge>
            </AccordionHeader>
            <AccordionPanel>
              <ReviewSubagentTimeline trace={subagentTrace} synthesis={subagentSynthesis} />
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}

      {/* Tabs */}
      <TabList
        selectedValue={activeTab}
        onTabSelect={(_, data) => setActiveTab(data.value as TabValue)}
        size="small"
      >
        <Tab value="summary">{s.tabSummary}</Tab>
        <Tab value="findings">{s.tabFindings} ({codeFindings.length})</Tab>
        <Tab value="architecture">{s.tabArchitecture} ({archFindings.length})</Tab>
        <Tab value="files">{s.tabFiles} ({report.changedFiles.length})</Tab>
        <Tab value="history">{s.historyTitle} ({history.length})</Tab>
      </TabList>

      {/* Tab content */}
      <div style={{ overflow: 'auto' }}>
        {activeTab === 'summary' && <ReviewSummaryCard report={report} />}
        {activeTab === 'findings' && <ReviewFindingList findings={codeFindings} />}
        {activeTab === 'architecture' && (
          <div>
            {report.architectureScore && (
              <ReviewArchitectureScoreCard score={report.architectureScore} />
            )}
            {archFindings.length > 0
              ? <ReviewFindingList findings={archFindings} />
              : <Text size={300} style={{ color: 'var(--vscode-descriptionForeground)' }}>{s.noFindings}</Text>
            }
          </div>
        )}
        {activeTab === 'files' && <ReviewFileTree report={report} />}
        {activeTab === 'history' && (
          <ReviewHistoryPanel
            reports={history}
            activeReportId={report.id}
            onSelect={onSelectReport ?? (() => undefined)}
            onClearAll={onClearHistory ?? (() => undefined)}
          />
        )}
      </div>
    </div>
  );
}
