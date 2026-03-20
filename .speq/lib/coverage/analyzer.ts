import * as fs from 'fs';
import * as path from 'path';
import type { CoverageReport, SteeringDoc, Spec, Gap, Feature, SpecPhase, LinearCoverageReport, LinearIssue, UnspeccedIssue } from './types.js';
import { fetchOpenIssues } from './linear-client.js';
import { scanForLinearIssues } from './spec-scanner.js';

const ENCODING = 'utf-8';
const FEATURES_START = '<!-- speq:features -->';
const FEATURES_END = '<!-- speq:features:end -->';

function findProjectRoot(): string | null {
  let current = process.cwd();
  while (current !== path.parse(current).root) {
    if (fs.existsSync(path.join(current, '.speq'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return null;
}

function extractFeaturesFromContent(content: string): Feature[] {
  const features: Feature[] = [];
  
  const startIdx = content.indexOf(FEATURES_START);
  const endIdx = content.indexOf(FEATURES_END);
  
  if (startIdx === -1 || endIdx === -1) {
    return features;
  }
  
  const block = content.slice(startIdx + FEATURES_START.length, endIdx);
  const lines = block.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^\s*-\s*`([^`]+)`\s*[-–—]\s*(.+)$/);
    if (match) {
      features.push({
        slug: match[1].trim(),
        description: match[2].trim()
      });
    }
  }
  
  return features;
}

function isSteeringEmpty(content: string): boolean {
  const withoutPlaceholders = content
    .replace(/<!--[^>]*-->/g, '')
    .replace(/^\s*[-*]\s*<!--.*-->\s*$/gm, '')
    .replace(/^\s*[-*]\s*$/gm, '')
    .trim();
  
  return withoutPlaceholders.length === 0;
}

function parseSteeringDoc(filePath: string): SteeringDoc {
  const content = fs.readFileSync(filePath, ENCODING);
  const features = extractFeaturesFromContent(content);
  const isEmpty = isSteeringEmpty(content);
  
  return {
    file: path.basename(filePath),
    path: filePath,
    status: features.length > 0 ? 'complete' : (isEmpty ? 'empty' : 'missing'),
    features
  };
}

function parseSpecPhase(dirPath: string): SpecPhase {
  return {
    requirements: fs.existsSync(path.join(dirPath, 'requirements.md')),
    design: fs.existsSync(path.join(dirPath, 'design.md')),
    tasks: fs.existsSync(path.join(dirPath, 'tasks.md'))
  };
}

function getSpecStatus(phases: SpecPhase): 'complete' | 'partial' | 'empty' {
  const count = [phases.requirements, phases.design, phases.tasks].filter(Boolean).length;
  if (count === 0) return 'empty';
  if (count === 3) return 'complete';
  return 'partial';
}

function parseSpec(dirPath: string): Spec {
  const name = path.basename(dirPath);
  const phases = parseSpecPhase(dirPath);
  
  return {
    name,
    path: dirPath,
    phases,
    status: getSpecStatus(phases)
  };
}

function findSteeringDocs(speqPath: string): SteeringDoc[] {
  const steeringPath = path.join(speqPath, 'steering');
  const docs: SteeringDoc[] = [];
  
  if (!fs.existsSync(steeringPath)) {
    return docs;
  }
  
  const files = fs.readdirSync(steeringPath).filter(f => f.endsWith('.md'));
  
  for (const file of files) {
    const filePath = path.join(steeringPath, file);
    docs.push(parseSteeringDoc(filePath));
  }
  
  return docs;
}

function findSpecs(speqPath: string): Spec[] {
  const specsPath = path.join(speqPath, 'specs');
  const specs: Spec[] = [];
  
  if (!fs.existsSync(specsPath)) {
    return specs;
  }
  
  const entries = fs.readdirSync(specsPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const dirPath = path.join(specsPath, entry.name);
      specs.push(parseSpec(dirPath));
    }
  }
  
  return specs;
}

function identifyGaps(steeringDocs: SteeringDoc[], specs: Spec[]): Gap[] {
  const gaps: Gap[] = [];
  const steeringFeatures = new Map<string, string>();
  
  for (const doc of steeringDocs) {
    for (const feature of doc.features) {
      steeringFeatures.set(feature.slug, doc.file);
    }
    
    if (doc.features.length === 0 && doc.status === 'empty') {
      gaps.push({
        type: 'empty-steering',
        file: doc.file,
        message: `${doc.file} has no features defined`
      });
    }
  }
  
  const specNames = new Set(specs.map(s => s.name));
  
  for (const [slug, file] of steeringFeatures) {
    if (!specNames.has(slug)) {
      gaps.push({
        type: 'missing-spec',
        feature: slug,
        file,
        message: `No spec exists for feature "${slug}" (from ${file})`
      });
    }
  }
  
  for (const spec of specs) {
    if (spec.status === 'empty') {
      gaps.push({
        type: 'incomplete-spec',
        feature: spec.name,
        message: `Spec "${spec.name}" has no phase files`
      });
    } else if (spec.status === 'partial') {
      const missing: string[] = [];
      if (!spec.phases.requirements) missing.push('requirements.md');
      if (!spec.phases.design) missing.push('design.md');
      if (!spec.phases.tasks) missing.push('tasks.md');
      
      gaps.push({
        type: 'incomplete-spec',
        feature: spec.name,
        message: `Spec "${spec.name}" missing: ${missing.join(', ')}`
      });
    }
  }
  
  return gaps;
}

export function analyze(): CoverageReport | null {
  const projectRoot = findProjectRoot();
  
  if (!projectRoot) {
    console.error('Error: Could not find .speq directory');
    return null;
  }
  
  const speqPath = path.join(projectRoot, '.speq');
  const specsPath = path.join(projectRoot, '.specs');
  
  if (!fs.existsSync(speqPath)) {
    console.error('Error: .speq directory not found');
    return null;
  }
  
  const steeringDocs = findSteeringDocs(specsPath);
  const specs = findSpecs(specsPath);
  const gaps = identifyGaps(steeringDocs, specs);
  
  const specsComplete = specs.filter(s => s.status === 'complete').length;
  
  return {
    steeringDocs,
    specs,
    gaps,
    totals: {
      steeringDocsTotal: steeringDocs.length,
      specsTotal: specs.length,
      specsComplete,
      gapsCount: gaps.length
    }
  };
}

export function getProjectRoot(): string | null {
  return findProjectRoot();
}

export async function analyzeLinearIssues(teamKey?: string): Promise<LinearCoverageReport | null> {
  try {
    const issues = await fetchOpenIssues(teamKey);
    const specMap = await scanForLinearIssues();

    const unspecced: UnspeccedIssue[] = [];

    for (const issue of issues) {
      if (!specMap.has(issue.identifier)) {
        unspecced.push({
          issue,
          hasSpec: false
        });
      }
    }

    return {
      issues,
      unspecced,
      totalCount: issues.length,
      unspeccedCount: unspecced.length
    };
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
