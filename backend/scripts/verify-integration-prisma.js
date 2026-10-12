import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const integrationDir = path.resolve(backendRoot, 'tests', 'integration');

// Allow-list: tests/integration/setup.ts (and .js) is where the approved test client is explicitly created and registered
const ALLOWLISTED_FILES = new Set([
  path.resolve(integrationDir, 'setup.ts'),
  path.resolve(integrationDir, 'setup.js'),
]);

/**
 * Strips comments from source code while preserving character offsets and line numbers.
 * Non-newline characters in comments are replaced with spaces.
 */
function stripComments(sourceCode) {
  // Replace block comments
  let stripped = sourceCode.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    return match.replace(/[^\n]/g, ' ');
  });
  // Replace line comments
  stripped = stripped.replace(/\/\/[^\n]*/g, (match) => {
    return ' '.repeat(match.length);
  });
  return stripped;
}

/**
 * Scans a single integration file for prohibited PrismaClient imports and direct instantiations.
 */
function scanFile(filePath) {
  const rawContent = fs.readFileSync(filePath, 'utf8');
  const rawLines = rawContent.split(/\r?\n/);
  const strippedContent = stripComments(rawContent);
  const violations = [];

  // Helper to calculate 1-indexed line number from character index
  const getLineNumber = (index) => {
    return strippedContent.slice(0, index).split(/\r?\n/).length;
  };

  // 1. Prohibited: Imports of PrismaClient (including aliases or wildcards) from '@prisma/client'
  // Matches:
  // - import { PrismaClient } from '@prisma/client'
  // - import { PrismaClient as PC } from '@prisma/client'
  // - import * as Prisma from '@prisma/client'
  // - import PrismaClient from '@prisma/client'
  // - import type { PrismaClient } from '@prisma/client'
  // - const { PrismaClient } = require('@prisma/client')
  // - const PC = require('@prisma/client').PrismaClient
  const importRegex = /(?:import\s+(?:type\s+)?([\s\S]*?)from\s*['"]@prisma\/client['"])|(?:const\s+([\s\S]*?)=\s*require\s*\(\s*['"]@prisma\/client['"]\s*\))/g;
  let importMatch;
  while ((importMatch = importRegex.exec(strippedContent)) !== null) {
    const importClause = importMatch[1] || importMatch[2] || '';
    // Check if the import clause imports PrismaClient, an alias of it, or a wildcard
    if (/\bPrismaClient\b/.test(importClause) || /\*\s+as\s+/.test(importClause)) {
      const lineNum = getLineNumber(importMatch.index);
      violations.push({
        filePath,
        line: lineNum,
        rule: 'Prohibited @prisma/client import',
        lineContent: rawLines[lineNum - 1] ? rawLines[lineNum - 1].trim() : '',
        remedy: 'Do not import PrismaClient from @prisma/client in integration tests. Import { prisma } from "../../src/config/prisma.js" or use { testClient } from "./setup.js".',
      });
    }
  }

  // 2. Prohibited: Direct dynamic import of PrismaClient
  const dynamicImportRegex = /import\s*\(\s*['"]@prisma\/client['"]\s*\)/g;
  let dynamicMatch;
  while ((dynamicMatch = dynamicImportRegex.exec(strippedContent)) !== null) {
    const lineNum = getLineNumber(dynamicMatch.index);
    violations.push({
      filePath,
      line: lineNum,
      rule: 'Prohibited dynamic import of @prisma/client',
      lineContent: rawLines[lineNum - 1] ? rawLines[lineNum - 1].trim() : '',
      remedy: 'Do not dynamically import @prisma/client in integration tests. Import { prisma } from "../../src/config/prisma.js".',
    });
  }

  // 3. Prohibited: Direct PrismaClient construction
  // Matches: new PrismaClient(...) or new <identifier>.PrismaClient(...)
  const constructionRegex = /\bnew\s+(?:[a-zA-Z0-9_$]+\.)?PrismaClient\s*\(/g;
  let constrMatch;
  while ((constrMatch = constructionRegex.exec(strippedContent)) !== null) {
    const lineNum = getLineNumber(constrMatch.index);
    violations.push({
      filePath,
      line: lineNum,
      rule: 'Prohibited direct PrismaClient construction',
      lineContent: rawLines[lineNum - 1] ? rawLines[lineNum - 1].trim() : '',
      remedy: 'Do not instantiate PrismaClient directly. Use the registered test proxy { prisma } from "../../src/config/prisma.js" or { testClient } from "./setup.js".',
    });
  }

  return violations;
}

/**
 * Recursively discovers integration test files to check.
 * Excludes allowlisted files and non-script extensions.
 */
function findIntegrationFiles(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`FAIL-CLOSED ISOLATION: Integration directory does not exist: ${dir}`);
  }

  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findIntegrationFiles(fullPath));
    } else if (entry.isFile()) {
      if (/\.(ts|js|mts|cts)$/.test(entry.name)) {
        if (!ALLOWLISTED_FILES.has(path.resolve(fullPath))) {
          results.push(fullPath);
        }
      }
    }
  }

  return results;
}

/**
 * Main verification runner.
 */
export function runPrismaSafetyCheck() {
  console.log('[PRISMA-STATIC-CHECK] Inspecting integration tests for unapproved Prisma client construction...');

  let files;
  try {
    files = findIntegrationFiles(integrationDir);
  } catch (err) {
    console.error(`[PRISMA-STATIC-CHECK] FAIL-CLOSED: Inspection failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`[PRISMA-STATIC-CHECK] Discovered ${files.length} integration file(s) to verify (excluding setup allowlist).`);

  const allViolations = [];
  for (const file of files) {
    const violations = scanFile(file);
    if (violations.length > 0) {
      allViolations.push(...violations);
    }
  }

  if (allViolations.length > 0) {
    console.error(`[PRISMA-STATIC-CHECK] FAILED: ${allViolations.length} Prisma safety violation(s) detected:`);
    for (const v of allViolations) {
      const relPath = path.relative(backendRoot, v.filePath);
      console.error(`  - ${relPath}:${v.line} [${v.rule}]`);
      console.error(`    Source: "${v.lineContent}"`);
      console.error(`    Remedy: ${v.remedy}`);
    }
    process.exit(1);
  }

  console.log('[PRISMA-STATIC-CHECK] PASSED: All integration files comply with Prisma client isolation.');
  process.exit(0);
}

// Auto-run when executed via node CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runPrismaSafetyCheck();
}
