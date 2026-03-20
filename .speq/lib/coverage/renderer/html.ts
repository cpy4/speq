import type { CoverageReport, LinearCoverageReport } from '../types.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'complete': return '#22c55e';
    case 'partial': return '#eab308';
    case 'empty':
    case 'missing': return '#ef4444';
    default: return '#6b7280';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'complete': return 'Complete';
    case 'partial': return 'Partial';
    case 'empty': return 'Empty';
    case 'missing': return 'Missing';
    default: return status;
  }
}

function renderProgressBar(phases: { requirements: boolean; design: boolean; tasks: boolean }): string {
  const total = 3;
  const complete = [phases.requirements, phases.design, phases.tasks].filter(Boolean).length;
  const pct = Math.round((complete / total) * 100);
  
  return `
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${pct}%"></div>
    </div>
    <span class="progress-text">${complete}/${total} phases</span>
  `;
}

function renderSteeringSection(docs: CoverageReport['steeringDocs']): string {
  if (docs.length === 0) {
    return '<p class="empty">No steering templates found</p>';
  }
  
  return docs.map(doc => `
    <div class="item">
      <div class="item-header">
        <span class="status-dot" style="background: ${getStatusColor(doc.status)}"></span>
        <span class="item-name">${escapeHtml(doc.file)}</span>
        <span class="status-label">${getStatusLabel(doc.status)}</span>
      </div>
      ${doc.features.length > 0 ? `
        <ul class="feature-list">
          ${doc.features.map(f => `<li><code>${escapeHtml(f.slug)}</code> — ${escapeHtml(f.description)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');
}

function renderSpecsSection(specs: CoverageReport['specs'], gaps: CoverageReport['gaps']): string {
  const missingSpecGaps = gaps.filter(g => g.type === 'missing-spec');
  
  const merged: Array<{ type: 'spec' | 'gap'; name: string; data: CoverageReport['specs'][0] | CoverageReport['gaps'][0] }> = [
    ...specs.map(spec => ({ type: 'spec' as const, name: spec.name.toLowerCase(), data: spec })),
    ...missingSpecGaps.map(gap => ({ type: 'gap' as const, name: (gap.file || gap.feature || '').toLowerCase(), data: gap }))
  ];
  
  merged.sort((a, b) => a.name.localeCompare(b.name));
  
  if (merged.length === 0) {
    return '<p class="empty">No specs found</p>';
  }
  
  return merged.map(item => {
    if (item.type === 'gap') {
      const gap = item.data as CoverageReport['gaps'][0];
      return `
    <div class="item gap-inline">
      <div class="item-header">
        <span class="status-dot" style="background: #ef4444"></span>
        <span class="item-name">${escapeHtml(gap.file || gap.feature || 'unknown')}</span>
        <span class="badge">[GAP]</span>
        <span class="status-label">no spec exists yet</span>
      </div>
    </div>`;
    }
    
    const spec = item.data as CoverageReport['specs'][0];
    return `
    <div class="item">
      <div class="item-header">
        <span class="status-dot" style="background: ${getStatusColor(spec.status)}"></span>
        <span class="item-name">${escapeHtml(spec.name)}</span>
        <span class="status-label">${getStatusLabel(spec.status)}</span>
      </div>
      <div class="phases">
        ${renderProgressBar(spec.phases)}
      </div>
    </div>`;
  }).join('');
}

function renderGapsSection(gaps: CoverageReport['gaps']): string {
  if (gaps.length === 0) {
    return '<p class="empty">No gaps found</p>';
  }
  
  return gaps.map(gap => `
    <div class="gap-item gap-${gap.type}">
      <span class="gap-type">${gap.type.replace(/-/g, ' ')}</span>
      <span class="gap-message">${escapeHtml(gap.message)}</span>
    </div>
  `).join('');
}

function renderUnspeccedIssuesHtml(report: LinearCoverageReport): string {
  if (report.unspecced.length === 0) {
    return '<p class="empty">All Linear issues have spec coverage</p>';
  }
  
  return report.unspecced.map(item => `
    <div class="item unspecced-item">
      <div class="item-header">
        <span class="badge no-spec">[NO SPEC]</span>
        <span class="item-name">${escapeHtml(item.issue.identifier)}</span>
        <span class="status-label">${escapeHtml(item.issue.state.name)}</span>
      </div>
      <div class="issue-title">${escapeHtml(item.issue.title)}</div>
      <a href="${escapeHtml(item.issue.url)}" class="issue-link" target="_blank" rel="noopener">Open in Linear →</a>
    </div>
  `).join('');
}

export function renderHtml(report: CoverageReport): string {
  const { specsComplete, specsTotal, gapsCount, steeringDocsTotal } = report.totals;
  const coveragePct = specsTotal > 0 ? Math.round((specsComplete / specsTotal) * 100) : 0;
  const generated = new Date().toISOString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Speq Coverage Report</title>
  <style>
    :root {
      --bg: #ffffff;
      --bg-alt: #f8fafc;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --accent: #3b82f6;
      --complete: #22c55e;
      --partial: #eab308;
      --empty: #ef4444;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --bg-alt: #1e293b;
        --text: #f1f5f9;
        --text-muted: #94a3b8;
        --border: #334155;
      }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    
    .container { max-width: 900px; margin: 0 auto; }
    
    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin: 1.5rem 0 1rem; }
    
    .meta { color: var(--text-muted); font-size: 0.875rem; }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat {
      background: var(--bg-alt);
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }
    
    .stat-label {
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    
    section {
      margin-bottom: 2rem;
    }
    
    .item {
      background: var(--bg-alt);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }
    
    .item-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .item-name {
      font-weight: 600;
      flex: 1;
    }
    
    .status-label {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: var(--border);
    }
    
    .badge {
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      background: #ef4444;
      color: white;
      font-weight: 700;
    }
    
    .gap-inline {
      border-left: 3px solid #ef4444;
    }
    
    .feature-list {
      margin-top: 0.5rem;
      padding-left: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    
    .feature-list li { margin: 0.25rem 0; }
    .feature-list code {
      background: var(--border);
      padding: 0.125rem 0.25rem;
      border-radius: 4px;
      font-size: 0.8125rem;
    }
    
    .phases {
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .progress-bar {
      flex: 1;
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--complete);
      transition: width 0.3s;
    }
    
    .progress-text {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    
    .empty {
      color: var(--text-muted);
      font-style: italic;
    }
    
    .gap-item {
      padding: 0.75rem;
      border-radius: 6px;
      margin-bottom: 0.5rem;
      border-left: 3px solid;
    }
    
    .gap-missing-spec { border-color: var(--empty); background: rgba(239, 68, 68, 0.1); }
    .gap-incomplete-spec { border-color: var(--partial); background: rgba(234, 179, 8, 0.1); }
    .gap-empty-steering { border-color: var(--text-muted); background: var(--bg-alt); }
    
    .gap-type {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--text-muted);
    }
    
    .gap-message {
      display: block;
      font-size: 0.875rem;
    }
    
    .badge.no-spec {
      background: #06b6d4;
    }
    
    .unspecced-item {
      border-left: 3px solid #06b6d4;
    }
    
    .issue-title {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    
    .issue-link {
      display: inline-block;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--accent);
      text-decoration: none;
    }
    
    .issue-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Speq Coverage Report</h1>
      <p class="meta">Generated: ${generated}</p>
    </header>
    
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${steeringDocsTotal}</div>
        <div class="stat-label">Steering Docs</div>
      </div>
      <div class="stat">
        <div class="stat-value">${specsComplete}/${specsTotal}</div>
        <div class="stat-label">Specs Complete</div>
      </div>
      <div class="stat">
        <div class="stat-value">${coveragePct}%</div>
        <div class="stat-label">Coverage</div>
      </div>
      <div class="stat">
        <div class="stat-value">${gapsCount}</div>
        <div class="stat-label">Gaps</div>
      </div>
    </div>
    
    <section>
      <h2>Steering Templates</h2>
      ${renderSteeringSection(report.steeringDocs)}
    </section>
    
    <section>
      <h2>Specs</h2>
      ${renderSpecsSection(report.specs, report.gaps)}
    </section>
    
    <section>
      <h2>Gaps</h2>
      ${renderGapsSection(report.gaps)}
    </section>
    ${report.linearCoverage ? `
    <section>
      <h2>Unspecced Issues</h2>
      ${renderUnspeccedIssuesHtml(report.linearCoverage)}
    </section>
    ` : ''}
  </div>
</body>
</html>`;
}
