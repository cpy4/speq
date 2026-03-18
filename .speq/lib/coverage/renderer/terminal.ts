import type { CoverageReport, CoverageOptions } from '../types.js';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function checkMark(status: string): string {
  switch (status) {
    case 'complete': return GREEN + '✓' + RESET;
    case 'partial': return YELLOW + '◐' + RESET;
    case 'empty':
    case 'missing': return RED + '✗' + RESET;
    default: return '?';
  }
}

function statusText(status: string, extra?: string): string {
  switch (status) {
    case 'complete': return GREEN + 'complete' + RESET + (extra ? ` (${extra})` : '');
    case 'partial': return YELLOW + 'partial' + RESET + (extra ? ` (${extra})` : '');
    case 'empty': return YELLOW + 'empty' + RESET;
    case 'missing': return RED + 'missing' + RESET;
    default: return status;
  }
}

function steeringHint(status: string): string {
  switch (status) {
    case 'missing': return DIM + ' ← no speq:features block — run /steering to regenerate' + RESET;
    case 'empty':   return DIM + ' ← block exists but no features listed' + RESET;
    default: return '';
  }
}

function specHint(status: string, phases: { requirements: boolean; design: boolean; tasks: boolean }): string {
  if (status === 'empty') return DIM + ' ← no phase files yet — run /spec to start' + RESET;
  if (status === 'partial') {
    const missing: string[] = [];
    if (!phases.requirements) missing.push('requirements');
    if (!phases.design) missing.push('design');
    if (!phases.tasks) missing.push('tasks');
    return DIM + ` ← missing ${missing.join(', ')}` + RESET;
  }
  return '';
}

function gapIndicator(): string {
  return CYAN + '[GAP]' + RESET;
}

function formatSteeringDoc(doc: { file: string; status: string; features: { slug: string }[] }, connector: string): string {
  const icon = checkMark(doc.status);
  const featureCount = doc.features.length;
  const extra = featureCount > 0 ? `${featureCount} feature${featureCount !== 1 ? 's' : ''} declared` : undefined;
  const hint = steeringHint(doc.status);
  return `│   ${connector} ${doc.file.padEnd(16)} ${icon} ${statusText(doc.status, extra)}${hint}`;
}

function formatSpec(spec: { name: string; status: string; phases: { requirements: boolean; design: boolean; tasks: boolean } }, connector: string): string {
  const icon = checkMark(spec.status);
  const hint = specHint(spec.status, spec.phases);

  let statusLabel = '';
  if (spec.status === 'complete') {
    statusLabel = statusText('complete', 'all phases');
  } else if (spec.status === 'partial') {
    statusLabel = statusText('partial');
  } else if (spec.status === 'empty') {
    statusLabel = statusText('empty');
  } else if (spec.status === 'missing') {
    statusLabel = RED + 'no spec' + RESET + DIM + ' ← implied by steering, not created yet' + RESET;
  }

  return `    ${connector} ${spec.name.padEnd(22)} ${icon} ${statusLabel}${hint}`;
}

export function renderTerminal(report: CoverageReport, options: CoverageOptions): string {
  const lines: string[] = [];

  lines.push(BOLD + '.specs/' + RESET);
  lines.push('├── steering/');

  if (report.steeringDocs.length === 0) {
    lines.push('│   └── ' + DIM + '(no steering docs found — run /steering to generate)' + RESET);
  } else {
    for (let i = 0; i < report.steeringDocs.length; i++) {
      const doc = report.steeringDocs[i];
      const isLast = i === report.steeringDocs.length - 1;
      lines.push(formatSteeringDoc(doc, isLast ? '└──' : '├──'));
    }
  }

  lines.push('│');
  lines.push('└── specs/');

  if (report.specs.length === 0 && report.gaps.filter(g => g.type === 'missing-spec').length === 0) {
    lines.push('    └── ' + DIM + '(no specs found)' + RESET);
  } else {
    // Merge existing specs + missing-spec gaps into one sorted list
    const allItems: { name: string; status: string; phases: { requirements: boolean; design: boolean; tasks: boolean } }[] = [
      ...report.specs,
      ...report.gaps
        .filter(g => g.type === 'missing-spec')
        .map(g => ({ name: g.feature!, status: 'missing', phases: { requirements: false, design: false, tasks: false } }))
    ].sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < allItems.length; i++) {
      const spec = allItems[i];
      const isLast = i === allItems.length - 1;
      lines.push(formatSpec(spec, isLast ? '└──' : '├──'));
    }
  }

  lines.push('');

  // Summary line
  const { specsComplete, specsTotal, gapsCount } = report.totals;
  const coveragePct = specsTotal > 0 ? Math.round((specsComplete / specsTotal) * 100) : 0;
  const gapStr = gapsCount > 0 ? `, ${RED}${gapsCount} gap${gapsCount !== 1 ? 's' : ''} found${RESET}` : ` ${GREEN}— no gaps!${RESET}`;
  lines.push(`${BOLD}Coverage:${RESET} ${specsComplete}/${specsTotal} specs complete (${coveragePct}%)${gapStr}`);

  // Legend
  lines.push('');
  lines.push(DIM + 'Legend:' + RESET);
  lines.push(DIM + `  ${GREEN}✓ complete${RESET}${DIM}   all required files present` + RESET);
  lines.push(DIM + `  ${YELLOW}◐ partial${RESET}${DIM}    spec started but missing phase files` + RESET);
  lines.push(DIM + `  ${YELLOW}✗ empty${RESET}${DIM}      folder/block exists with no content` + RESET);
  lines.push(DIM + `  ${RED}✗ missing${RESET}${DIM}    no speq:features block (steering) or no spec created yet` + RESET);
  lines.push(DIM + `  ${CYAN}[GAP]${RESET}${DIM}        feature declared in steering but no spec exists` + RESET);

  // Verbose gap detail
  if (options.verbose && report.gaps.length > 0) {
    lines.push('');
    lines.push(BOLD + 'Gap details:' + RESET);
    for (const gap of report.gaps) {
      lines.push(`  • ${gap.message}`);
    }
  }

  return lines.join('\n');
}
