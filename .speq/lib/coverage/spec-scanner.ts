import * as fs from 'fs';
import * as path from 'path';

const LINEAR_SOURCE_REGEX = /<!--\s*source:\s*linear:([A-Z]+-\d+)\s*-->/g;

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

export async function scanForLinearIssues(): Promise<Map<string, string>> {
  const projectRoot = findProjectRoot();
  
  if (!projectRoot) {
    console.warn('Warning: Could not find .speq directory');
    return new Map();
  }

  const specsPath = path.join(projectRoot, '.specs', 'specs');
  const issueToSpecMap = new Map<string, string>();

  if (!fs.existsSync(specsPath)) {
    return issueToSpecMap;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(specsPath, { withFileTypes: true });
  } catch {
    return issueToSpecMap;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const requirementsPath = path.join(specsPath, entry.name, 'requirements.md');
    
    if (!fs.existsSync(requirementsPath)) {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(requirementsPath, 'utf-8');
    } catch {
      continue;
    }

    let match;
    LINEAR_SOURCE_REGEX.lastIndex = 0;
    while ((match = LINEAR_SOURCE_REGEX.exec(content)) !== null) {
      const issueId = match[1];
      issueToSpecMap.set(issueId, requirementsPath);
    }
  }

  return issueToSpecMap;
}
