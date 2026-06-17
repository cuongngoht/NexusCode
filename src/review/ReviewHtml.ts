import * as vscode from 'vscode';
import * as crypto from 'crypto';
import type { CodeReviewReport } from '../application/code-review/CodeReviewReport';
import type { CodeReviewFinding } from '../application/code-review/CodeReviewFinding';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'blocker': return '#dc3545';
    case 'critical': return '#fd7e14';
    case 'major': return '#ffc107';
    case 'minor': return '#0dcaf0';
    case 'nit': return '#6c757d';
    case 'info': return '#0d6efd';
    default: return '#6c757d';
  }
}

function getVerdictBadge(verdict: string, type: 'review' | 'architecture'): string {
  if (type === 'review') {
    switch (verdict) {
      case 'approve':
        return '<span class="verdict-badge verdict-approve">✓ Approve</span>';
      case 'approve-with-comments':
        return '<span class="verdict-badge verdict-approve-comments">⚠ Approve with Comments</span>';
      case 'request-changes':
        return '<span class="verdict-badge verdict-request-changes">✗ Request Changes</span>';
      default:
        return `<span class="verdict-badge">${escapeHtml(verdict)}</span>`;
    }
  } else {
    switch (verdict) {
      case 'healthy':
        return '<span class="verdict-badge verdict-healthy">✓ Healthy</span>';
      case 'acceptable-with-debt':
        return '<span class="verdict-badge verdict-acceptable">⚠ Acceptable with Debt</span>';
      case 'needs-refactor':
        return '<span class="verdict-badge verdict-needs-refactor">⚠ Needs Refactor</span>';
      case 'architecture-blocker':
        return '<span class="verdict-badge verdict-blocker">✗ Architecture Blocker</span>';
      default:
        return `<span class="verdict-badge">${escapeHtml(verdict)}</span>`;
    }
  }
}

function renderSummary(report: CodeReviewReport): string {
  const { stats } = report;

  let scoreHtml = '';
  if (report.architectureScore) {
    const score = report.architectureScore;
    scoreHtml = `
      <div class="architecture-scores">
        <h3>Architecture Scores</h3>
        <div class="score-grid">
          <div class="score-item">
            <div class="score-label">Overall</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.overall}%; background: ${score.overall >= 70 ? '#28a745' : score.overall >= 50 ? '#ffc107' : '#dc3545'}"></div>
            </div>
            <div class="score-value">${score.overall}/100</div>
          </div>
          <div class="score-item">
            <div class="score-label">Coupling</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.coupling}%"></div>
            </div>
            <div class="score-value">${score.coupling}/100</div>
          </div>
          <div class="score-item">
            <div class="score-label">Cohesion</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.cohesion}%"></div>
            </div>
            <div class="score-value">${score.cohesion}/100</div>
          </div>
          <div class="score-item">
            <div class="score-label">Abstraction</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.abstraction}%"></div>
            </div>
            <div class="score-value">${score.abstraction}/100</div>
          </div>
          <div class="score-item">
            <div class="score-label">Testability</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.testability}%"></div>
            </div>
            <div class="score-value">${score.testability}/100</div>
          </div>
          <div class="score-item">
            <div class="score-label">Extensibility</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.extensibility}%"></div>
            </div>
            <div class="score-value">${score.extensibility}/100</div>
          </div>
          <div class="score-item">
            <div class="score-label">Readability</div>
            <div class="score-bar">
              <div class="score-fill" style="width: ${score.readability}%"></div>
            </div>
            <div class="score-value">${score.readability}/100</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="summary-section">
      <div class="verdict-row">
        <span style="font-weight: 600; margin-right: 12px;">Verdict:</span>
        ${getVerdictBadge(report.verdict, 'review')}
        ${report.architectureVerdict ? `
          <span style="margin-left: 20px; margin-right: 8px; color: var(--vscode-descriptionForeground);">Architecture:</span>
          ${getVerdictBadge(report.architectureVerdict, 'architecture')}
        ` : ''}
      </div>

      <p class="summary-text">${escapeHtml(report.summary)}</p>

      ${report.architectureSummary ? `
        <div class="architecture-summary">
          <strong>Architecture Summary:</strong> ${escapeHtml(report.architectureSummary)}
        </div>
      ` : ''}

      ${scoreHtml}

      <div class="stats-row">
        ${report.stats.blocker > 0 ? `<span class="stat-badge severity-blocker">Blocker: ${report.stats.blocker}</span>` : ''}
        ${report.stats.critical > 0 ? `<span class="stat-badge severity-critical">Critical: ${report.stats.critical}</span>` : ''}
        ${report.stats.major > 0 ? `<span class="stat-badge severity-major">Major: ${report.stats.major}</span>` : ''}
        ${report.stats.minor > 0 ? `<span class="stat-badge severity-minor">Minor: ${report.stats.minor}</span>` : ''}
        ${report.stats.nit > 0 ? `<span class="stat-badge severity-nit">Nit: ${report.stats.nit}</span>` : ''}
        ${report.stats.info > 0 ? `<span class="stat-badge severity-info">Info: ${report.stats.info}</span>` : ''}
        ${stats.architecture > 0 ? `<span class="stat-badge">Architecture: ${stats.architecture}</span>` : ''}
      </div>

      ${report.changedFiles.length > 0 ? `
        <div class="changed-files-count">
          Changed Files: ${report.changedFiles.length}
        </div>
      ` : ''}
    </div>
  `;
}

function renderFinding(finding: CodeReviewFinding): string {
  const severityColor = getSeverityColor(finding.severity);

  return `
    <details class="finding-card" data-finding-id="${escapeHtml(finding.id)}" data-severity="${escapeHtml(finding.severity)}">
      <summary class="finding-summary">
        <div class="finding-badges">
          <span class="severity-badge" style="background-color: ${severityColor}; color: white;">${escapeHtml(finding.severity.toUpperCase())}</span>
          <span class="category-badge">${escapeHtml(finding.category)}</span>
        </div>
        <span class="finding-title">${escapeHtml(finding.title)}</span>
        ${finding.filePath ? `
          <span class="finding-location-inline">
            📄 ${escapeHtml(finding.filePath)}${finding.lineStart ? `:${finding.lineStart}` : ''}
          </span>
        ` : ''}
      </summary>

      <div class="finding-body">
        ${finding.filePath ? `
          <div class="finding-location">
            <a href="#" class="file-link" data-path="${escapeHtml(finding.filePath)}" data-line="${finding.lineStart || 0}">
              📄 ${escapeHtml(finding.filePath)}${finding.lineStart ? `:${finding.lineStart}` : ''}
            </a>
          </div>
        ` : ''}

        <div class="finding-description">${escapeHtml(finding.description)}</div>

        ${finding.evidence ? `
          <div class="finding-evidence">
            <div class="finding-evidence-label">Evidence</div>
            <pre><code>${escapeHtml(finding.evidence)}</code></pre>
          </div>
        ` : ''}

        ${finding.recommendation ? `
          <div class="finding-recommendation">
            <strong>Recommendation:</strong>
            <div>${escapeHtml(finding.recommendation)}</div>
          </div>
        ` : ''}
      </div>
    </details>
  `;
}

function renderFindings(findings: CodeReviewFinding[]): string {
  if (findings.length === 0) {
    return '<div class="no-findings">No findings to display.</div>';
  }

  // Group by file
  const byFile = new Map<string, CodeReviewFinding[]>();
  const noFile: CodeReviewFinding[] = [];

  for (const finding of findings) {
    if (!finding.filePath) {
      noFile.push(finding);
    } else {
      if (!byFile.has(finding.filePath)) {
        byFile.set(finding.filePath, []);
      }
      byFile.get(finding.filePath)!.push(finding);
    }
  }

  const severities = [...new Set(findings.map(f => f.severity))];
  const filterButtons = ['all', ...severities].map(s => {
    const color = s === 'all' ? '' : `style="background:${getSeverityColor(s)};color:white;border-color:${getSeverityColor(s)}"`;
    return `<button class="filter-btn${s === 'all' ? ' active' : ''}" data-filter="${escapeHtml(s)}" ${color}>${s === 'all' ? 'All' : escapeHtml(s.toUpperCase())}</button>`;
  }).join('');

  let findingsHtml = '';

  if (noFile.length > 0) {
    findingsHtml += noFile.map(f => renderFinding(f)).join('\n');
  }

  for (const [file, fileFindings] of byFile.entries()) {
    findingsHtml += `
      <div class="file-group">
        <div class="file-group-header">${escapeHtml(file)} <span class="finding-count">(${fileFindings.length})</span></div>
        ${fileFindings.map(f => renderFinding(f)).join('\n')}
      </div>
    `;
  }

  return `
    <div class="severity-filter">
      <span class="filter-label">Filter:</span>
      ${filterButtons}
    </div>
    <div id="findingsList">${findingsHtml}</div>
  `;
}

function renderReportBox(findings: CodeReviewFinding[]): string {
  if (findings.length === 0) return '';

  const severityOrder: Record<string, number> = {
    blocker: 0, critical: 1, major: 2, minor: 3, nit: 4, info: 5,
  };
  const sorted = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5),
  );

  const rows = sorted.map((f, i) => {
    const color = getSeverityColor(f.severity);
    const file = f.filePath
      ? `${escapeHtml(f.filePath)}${f.lineStart ? `:${f.lineStart}` : ''}`
      : '—';

    return `
      <tr>
        <td class="report-num">${i + 1}</td>
        <td><span class="severity-badge" style="background:${color};color:white;font-size:10px;padding:2px 6px;border-radius:8px;">${escapeHtml(f.severity.toUpperCase())}</span></td>
        <td class="report-category">${escapeHtml(f.category)}</td>
        <td class="report-file" title="${escapeHtml(f.filePath || '')}">${file}</td>
        <td class="report-title">${escapeHtml(f.title)}</td>
      </tr>`;
  }).join('\n');

  return `
    <div class="report-box">
      <div class="report-box-title">
        <span>Report Summary</span>
        <span class="report-count">${findings.length} finding${findings.length !== 1 ? 's' : ''}</span>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Severity</th>
            <th>Category</th>
            <th>File</th>
            <th>Issue</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderHistory(reports: CodeReviewReport[], currentId: string): string {
  if (reports.length === 0) {
    return '<div class="history-empty">No previous reviews found.</div>';
  }

  const items = reports.map(r => {
    const isActive = r.id === currentId;
    const date = new Date(r.generatedAt).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const verdictClass = r.verdict === 'approve' ? 'verdict-approve'
      : r.verdict === 'approve-with-comments' ? 'verdict-approve-comments'
      : 'verdict-request-changes';
    const verdictLabel = r.verdict === 'approve' ? '✓ Approve'
      : r.verdict === 'approve-with-comments' ? '⚠ Approve w/ Comments'
      : '✗ Request Changes';

    const b = r.stats.blocker > 0 ? `<span class="hstat hstat-blocker">B:${r.stats.blocker}</span>` : '';
    const c = r.stats.critical > 0 ? `<span class="hstat hstat-critical">C:${r.stats.critical}</span>` : '';
    const m = r.stats.major > 0 ? `<span class="hstat hstat-major">M:${r.stats.major}</span>` : '';

    return `
      <div class="history-item${isActive ? ' history-item-active' : ''}" data-report-id="${escapeHtml(r.id)}" role="button" tabindex="0">
        <div class="history-item-row">
          <span class="verdict-badge ${verdictClass}" style="font-size:11px;padding:2px 8px;">${verdictLabel}</span>
          <span class="history-branch">${escapeHtml(r.baseBranch || 'main')}</span>
        </div>
        <div class="history-item-meta">
          <span class="history-date">${escapeHtml(date)}</span>
          <span class="history-stats">${b}${c}${m}<span class="hstat">Total:${r.stats.totalFindings}</span></span>
        </div>
      </div>`;
  }).join('\n');

  return `
    <div class="history-panel">
      <div class="history-header">
        <span class="history-title">Review History</span>
        <button id="clearHistoryBtn" class="btn-secondary">Clear History</button>
      </div>
      ${items}
    </div>`;
}

function renderFiles(files: Array<{ path: string; status: string; additions?: number; deletions?: number }>): string {
  if (files.length === 0) {
    return '<div class="no-files">No changed files.</div>';
  }

  return `
    <div class="files-list">
      ${files.map(file => {
        const stats = (file.additions || file.deletions)
          ? ` <span class="file-stats">(+${file.additions || 0}/-${file.deletions || 0})</span>`
          : '';

        return `
          <div class="file-item">
            <span class="file-status file-status-${file.status.toLowerCase()}">[${escapeHtml(file.status)}]</span>
            <a href="#" class="file-link" data-path="${escapeHtml(file.path)}">
              ${escapeHtml(file.path)}
            </a>
            ${stats}
          </div>
        `;
      }).join('\n')}
    </div>
  `;
}

export function getReviewHtml(
  webview: vscode.Webview,
  report: CodeReviewReport,
  history: CodeReviewReport[] = [],
): string {
  const nonce = crypto.randomBytes(16).toString('hex');

  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Code Review Report</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 0;
      margin: 0;
    }

    #app {
      padding: 0 20px 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 0;
    }

    .header h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      border-radius: 2px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    /* Sticky tabs */
    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 16px;
      position: sticky;
      top: 0;
      z-index: 10;
      background-color: var(--vscode-editor-background);
      padding-top: 4px;
    }

    .tab {
      padding: 8px 16px;
      font-size: 13px;
      background: none;
      color: var(--vscode-descriptionForeground);
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }

    .tab.active {
      color: var(--vscode-foreground);
      border-bottom-color: var(--vscode-focusBorder);
      font-weight: 600;
    }

    .tab:hover {
      color: var(--vscode-foreground);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* Summary styles */
    .verdict-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .verdict-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .verdict-approve { background-color: #28a745; color: white; }
    .verdict-approve-comments { background-color: #ffc107; color: black; }
    .verdict-request-changes { background-color: #dc3545; color: white; }
    .verdict-healthy { background-color: #28a745; color: white; }
    .verdict-acceptable { background-color: #ffc107; color: black; }
    .verdict-needs-refactor { background-color: #fd7e14; color: white; }
    .verdict-blocker { background-color: #dc3545; color: white; }

    .summary-text {
      margin: 12px 0;
      line-height: 1.5;
    }

    .architecture-summary {
      margin: 12px 0;
      padding: 10px 14px;
      background-color: var(--vscode-editorWidget-background);
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    }

    .architecture-scores {
      margin: 16px 0;
    }

    .architecture-scores h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 12px 0;
    }

    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .score-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .score-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .score-bar {
      width: 100%;
      height: 8px;
      background-color: var(--vscode-editorWidget-background);
      border-radius: 4px;
      overflow: hidden;
    }

    .score-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
      transition: width 0.3s ease;
    }

    .score-value {
      font-size: 12px;
      font-weight: 600;
    }

    .stats-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }

    .stat-badge {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 10px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .severity-blocker { background-color: #dc3545; color: white; }
    .severity-critical { background-color: #fd7e14; color: white; }
    .severity-major { background-color: #ffc107; color: black; }
    .severity-minor { background-color: #0dcaf0; color: black; }
    .severity-nit { background-color: #6c757d; color: white; }
    .severity-info { background-color: #0d6efd; color: white; }

    .changed-files-count {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 8px;
    }

    /* Severity filter */
    .severity-filter {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .filter-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-right: 4px;
    }

    .filter-btn {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 10px;
      background-color: var(--vscode-editorWidget-background);
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-panel-border);
      cursor: pointer;
    }

    .filter-btn.active {
      border-width: 2px;
      font-weight: 600;
    }

    .filter-btn:hover {
      opacity: 0.85;
    }

    /* Findings styles */
    .file-group {
      margin-bottom: 20px;
    }

    .file-group-header {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
      padding: 6px 10px;
      background-color: var(--vscode-editorWidget-background);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .finding-count {
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
    }

    /* Collapsible finding card via <details> */
    .finding-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 8px;
      background-color: var(--vscode-editor-background);
      overflow: hidden;
    }

    .finding-card[open] {
      border-color: var(--vscode-focusBorder);
    }

    .finding-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      cursor: pointer;
      list-style: none;
      flex-wrap: wrap;
    }

    .finding-summary::-webkit-details-marker { display: none; }

    .finding-summary:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .finding-badges {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .severity-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      letter-spacing: 0.5px;
    }

    .category-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .finding-title {
      font-size: 13px;
      font-weight: 600;
      flex: 1;
      min-width: 0;
    }

    .finding-location-inline {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-family: var(--vscode-editor-font-family);
      margin-left: auto;
    }

    .finding-body {
      padding: 0 14px 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .finding-location {
      margin: 10px 0 8px;
      font-size: 12px;
    }

    .file-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      font-family: var(--vscode-editor-font-family);
    }

    .file-link:hover {
      text-decoration: underline;
    }

    .finding-description {
      margin: 8px 0;
      font-size: 13px;
      line-height: 1.5;
    }

    .finding-evidence {
      margin: 8px 0;
    }

    .finding-evidence-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }

    .finding-evidence pre {
      margin: 0;
      padding: 10px;
      background-color: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
      overflow-x: auto;
    }

    .finding-evidence code {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
    }

    .finding-recommendation {
      margin: 8px 0 0 0;
      padding: 10px;
      background-color: var(--vscode-editorWidget-background);
      border-left: 3px solid var(--vscode-focusBorder);
      border-radius: 2px;
      font-size: 13px;
    }

    .finding-recommendation strong {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
    }

    .no-findings {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      padding: 20px 0;
    }

    /* Files styles */
    .files-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .file-item {
      padding: 6px 10px;
      background-color: var(--vscode-editorWidget-background);
      border-radius: 4px;
      font-size: 13px;
      font-family: var(--vscode-editor-font-family);
    }

    .file-status {
      display: inline-block;
      width: 60px;
      font-size: 11px;
      font-weight: 600;
    }

    .file-status-modified { color: #ffc107; }
    .file-status-added { color: #28a745; }
    .file-status-deleted { color: #dc3545; }
    .file-status-renamed { color: #0dcaf0; }

    .file-stats {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .no-files {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      padding: 20px 0;
    }

    /* Report box styles */
    .report-box {
      margin-top: 24px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
    }

    .report-box-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background-color: var(--vscode-editorWidget-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 13px;
      font-weight: 600;
    }

    .report-count {
      font-size: 11px;
      font-weight: 400;
      color: var(--vscode-descriptionForeground);
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .report-table th {
      padding: 7px 10px;
      text-align: left;
      background-color: var(--vscode-editorWidget-background);
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .report-table td {
      padding: 7px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      vertical-align: middle;
    }

    .report-table tbody tr:last-child td {
      border-bottom: none;
    }

    .report-table tbody tr:hover td {
      background-color: var(--vscode-list-hoverBackground);
    }

    .report-num {
      color: var(--vscode-descriptionForeground);
      width: 28px;
      text-align: right;
    }

    .report-category {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }

    .report-file {
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      color: var(--vscode-textLink-foreground);
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .report-title {
      font-weight: 500;
    }

    /* History styles */
    .history-panel {
      display: flex;
      flex-direction: column;
    }

    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 8px;
    }

    .history-title {
      font-size: 13px;
      font-weight: 600;
    }

    .history-item {
      padding: 10px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 6px;
      cursor: pointer;
    }

    .history-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .history-item-active {
      border-color: var(--vscode-focusBorder);
      background-color: var(--vscode-list-activeSelectionBackground);
    }

    .history-item-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .history-branch {
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-descriptionForeground);
    }

    .history-item-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .history-date {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .history-stats {
      display: flex;
      gap: 4px;
    }

    .hstat {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 8px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .hstat-blocker { background-color: #dc3545; color: white; }
    .hstat-critical { background-color: #fd7e14; color: white; }
    .hstat-major { background-color: #ffc107; color: black; }

    .history-empty {
      padding: 24px 0;
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    /* Print styles */
    @media print {
      .header-actions,
      .tabs,
      .severity-filter { display: none; }

      .tab-content { display: block !important; }

      .finding-card { break-inside: avoid; }

      .report-box { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <h1>Code Review Report</h1>
      <div class="header-actions">
        <button id="printBtn">Print</button>
        <button id="refreshBtn">Refresh</button>
        <button id="exportBtn">Export</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="summary">Summary</button>
      <button class="tab" data-tab="findings">Findings (${report.findings.length})</button>
      <button class="tab" data-tab="files">Files (${report.changedFiles.length})</button>
      <button class="tab" data-tab="history">History (${history.length})</button>
    </div>

    <div class="tab-content active" data-content="summary">
      ${renderSummary(report)}
      ${renderReportBox(report.findings)}
    </div>

    <div class="tab-content" data-content="findings">
      ${renderFindings(report.findings)}
    </div>

    <div class="tab-content" data-content="files">
      ${renderFiles(report.changedFiles)}
    </div>

    <div class="tab-content" data-content="history">
      ${renderHistory(history, report.id)}
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const content = document.querySelector('.tab-content[data-content="' + tabName + '"]');
        if (content) content.classList.add('active');
      });
    });

    // File navigation
    document.querySelectorAll('.file-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        vscode.postMessage({
          type: 'openFile',
          path: link.dataset.path,
          line: link.dataset.line ? parseInt(link.dataset.line) : undefined,
        });
      });
    });

    // Severity filter in findings tab
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        document.querySelectorAll('.finding-card').forEach(card => {
          card.style.display = (filter === 'all' || card.dataset.severity === filter) ? '' : 'none';
        });

        // Show/hide file group headers if all children are hidden
        document.querySelectorAll('.file-group').forEach(group => {
          const visible = group.querySelectorAll('.finding-card:not([style*="none"])').length;
          group.style.display = visible === 0 ? 'none' : '';
        });
      });
    });

    // History: select report
    document.querySelectorAll('.history-item').forEach(item => {
      const select = () => {
        vscode.postMessage({ type: 'selectHistoryReport', reportId: item.dataset.reportId });
      };
      item.addEventListener('click', select);
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') select(); });
    });

    // History: clear
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) {
      let confirmPending = false;
      clearBtn.addEventListener('click', () => {
        if (confirmPending) {
          vscode.postMessage({ type: 'clearReviewHistory' });
        } else {
          confirmPending = true;
          clearBtn.textContent = '⚠ Confirm Clear';
          setTimeout(() => {
            confirmPending = false;
            clearBtn.textContent = 'Clear History';
          }, 3000);
        }
      });
    }

    // Export button
    document.getElementById('exportBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'exportReport' });
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    // Print button
    document.getElementById('printBtn').addEventListener('click', () => {
      window.print();
    });
  </script>
</body>
</html>`;
}
