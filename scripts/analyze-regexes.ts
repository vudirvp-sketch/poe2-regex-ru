import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ────────────────────────────────────────────────────────────────
interface Token {
  id: string;
  category: string;
  rawText: { ru: string };
  regex: { ru: string };
  familyKey: { ru: string };
  regexPrefix: { ru: string };
  hasMultiPlaceholder: boolean;
}

interface DataFile {
  version: string;
  category: string;
  source: string;
  tokens: Token[];
}

interface FlatToken {
  id: string;
  category: string;
  rawTextRu: string;
  regexRu: string;
  regexLength: number;
  familyKeyRu: string;
  regexPrefixRu: string;
  hasMultiPlaceholder: boolean;
}

interface Conflict {
  regex: string;
  sourceCategory: string;
  sourceIds: string[];
  targetCategory: string;
  targetId: string;
  targetRawText: string;
}

interface Ambiguity {
  category: string;
  regex: string;
  familyKeys: string[];
  ids: string[];
}

interface CategoryStats {
  category: string;
  totalTokens: number;
  avgRegexLength: number;
  minRegexLength: number;
  maxRegexLength: number;
  shortRegexCount: number;
  crossCategoryConflictCount: number;
}

// ── Config ───────────────────────────────────────────────────────────────
const GENERATED_DIR = path.resolve(__dirname, '..', 'public', 'generated');
const REPORT_PATH = path.resolve(__dirname, '..', 'регис', 'analysis-report.md');
const SHORT_THRESHOLD = 10;

// ── Load data ────────────────────────────────────────────────────────────
const jsonFiles = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('.json'));
console.error(`Found ${jsonFiles.length} JSON files in ${GENERATED_DIR}`);

const allTokens: FlatToken[] = [];

for (const file of jsonFiles) {
  const filePath = path.join(GENERATED_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: DataFile = JSON.parse(raw);
  const category = data.category;

  for (const token of data.tokens) {
    const regexRu = token.regex?.ru ?? '';
    const rawTextRu = token.rawText?.ru ?? '';
    const familyKeyRu = token.familyKey?.ru ?? '';
    const regexPrefixRu = token.regexPrefix?.ru ?? '';

    allTokens.push({
      id: token.id,
      category,
      rawTextRu,
      regexRu,
      regexLength: [...regexRu].length,
      familyKeyRu,
      regexPrefixRu,
      hasMultiPlaceholder: token.hasMultiPlaceholder,
    });
  }
}

console.error(`Total tokens loaded: ${allTokens.length}`);

// ── Section A: Short regexes (< 10 chars) ────────────────────────────────
console.error('Building Section A...');
const shortRegexes = allTokens
  .filter(t => t.regexLength < SHORT_THRESHOLD && t.regexLength > 0)
  .sort((a, b) => a.regexLength - b.regexLength);

let sectionA = `## Section A: Short regexes (< ${SHORT_THRESHOLD} chars)\n\n`;
sectionA += `Found ${shortRegexes.length} tokens with regex length < ${SHORT_THRESHOLD}:\n\n`;
sectionA += `| Length | Category | ID | rawText.ru (truncated) | regex.ru |\n`;
sectionA += `|--------|----------|----|------------------------|----------|\n`;

for (const t of shortRegexes) {
  const truncated = t.rawTextRu.length > 60 ? t.rawTextRu.slice(0, 57) + '...' : t.rawTextRu;
  sectionA += `| ${t.regexLength} | ${t.category} | ${t.id} | ${truncated} | \`${t.regexRu}\` |\n`;
}

// ── Section B: Cross-category conflicts (optimized) ─────────────────────
console.error('Building Section B: Cross-category conflicts...');

// Build: for each category, a concatenated string of all rawTexts with separators
// and an index mapping character positions back to token IDs
// Actually, simpler approach: get unique regexes per category, then check each
// unique regex against all rawTexts in OTHER categories.

// Step 1: Collect unique regexes with their source info
const regexByCategory = new Map<string, Map<string, string[]>>(); // category -> regex -> [ids]
for (const t of allTokens) {
  if (!t.regexRu) continue;
  if (!regexByCategory.has(t.category)) regexByCategory.set(t.category, new Map());
  const catMap = regexByCategory.get(t.category)!;
  if (!catMap.has(t.regexRu)) catMap.set(t.regexRu, []);
  catMap.get(t.regexRu)!.push(t.id);
}

// Step 2: For each category, build a flat array of {id, rawTextRu} for searching
const rawTextsByCategory = new Map<string, { id: string; rawTextRu: string }[]>();
for (const t of allTokens) {
  if (!rawTextsByCategory.has(t.category)) rawTextsByCategory.set(t.category, []);
  rawTextsByCategory.get(t.category)!.push({ id: t.id, rawTextRu: t.rawTextRu });
}

// Step 3: For each unique regex in each category, check against rawTexts in OTHER categories
const conflicts: Conflict[] = [];
const conflictKeys = new Set<string>();

for (const [srcCat, regexMap] of regexByCategory) {
  for (const [regex, srcIds] of regexMap) {
    for (const [tgtCat, entries] of rawTextsByCategory) {
      if (tgtCat === srcCat) continue;
      for (const entry of entries) {
        if (entry.rawTextRu.includes(regex)) {
          const cKey = `${regex}||${srcCat}||${tgtCat}||${entry.id}`;
          if (!conflictKeys.has(cKey)) {
            conflictKeys.add(cKey);
            conflicts.push({
              regex,
              sourceCategory: srcCat,
              sourceIds: srcIds,
              targetCategory: tgtCat,
              targetId: entry.id,
              targetRawText: entry.rawTextRu,
            });
          }
        }
      }
    }
  }
}

console.error(`Cross-category conflicts found: ${conflicts.length}`);

// Build a set of tokens that have cross-category conflicts (for stats)
const tokensWithConflicts = new Set<string>();
for (const c of conflicts) {
  for (const srcId of c.sourceIds) {
    tokensWithConflicts.add(`${c.sourceCategory}||${srcId}`);
  }
}

let sectionB = `## Section B: Cross-category conflicts\n\n`;
sectionB += `Found ${conflicts.length} cross-category conflict entries:\n\n`;

if (conflicts.length === 0) {
  sectionB += `No conflicts found.\n`;
} else {
  // Group by (regex, sourceCategory) for readability
  const grouped = new Map<string, Conflict[]>();
  for (const c of conflicts) {
    const key = `${c.regex}||${c.sourceCategory}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  let conflictNum = 0;
  for (const [key, entries] of grouped) {
    const [regex, srcCat] = key.split('||');
    conflictNum++;
    const ids = entries[0].sourceIds.slice(0, 3).join(', ') +
      (entries[0].sourceIds.length > 3 ? ` (+${entries[0].sourceIds.length - 3} more)` : '');
    sectionB += `**${conflictNum}.** regex \`${regex}\` (${srcCat}, ids: ${ids})\n`;
    // Show up to 5 target matches
    const shown = entries.slice(0, 5);
    for (const e of shown) {
      const truncated = e.targetRawText.length > 80 ? e.targetRawText.slice(0, 77) + '...' : e.targetRawText;
      sectionB += `  - also appears in rawText of (${e.targetCategory}, ${e.targetId}): "${truncated}"\n`;
    }
    if (entries.length > 5) {
      sectionB += `  - ... and ${entries.length - 5} more\n`;
    }
    sectionB += `\n`;
  }
}

// ── Section C: Within-category ambiguity ─────────────────────────────────
console.error('Building Section C...');
const ambiguities: Ambiguity[] = [];

const byCategory = new Map<string, FlatToken[]>();
for (const t of allTokens) {
  if (!byCategory.has(t.category)) byCategory.set(t.category, []);
  byCategory.get(t.category)!.push(t);
}

for (const [category, tokens] of byCategory) {
  const byRegex = new Map<string, FlatToken[]>();
  for (const t of tokens) {
    if (!t.regexRu) continue;
    if (!byRegex.has(t.regexRu)) byRegex.set(t.regexRu, []);
    byRegex.get(t.regexRu)!.push(t);
  }

  for (const [regex, group] of byRegex) {
    const familyKeys = [...new Set(group.map(t => t.familyKeyRu))];
    if (familyKeys.length > 1) {
      ambiguities.push({
        category,
        regex,
        familyKeys,
        ids: group.map(t => t.id),
      });
    }
  }
}

let sectionC = `## Section C: Within-category ambiguity\n\n`;
sectionC += `Found ${ambiguities.length} regexes shared by different familyKeys within the same category:\n\n`;

if (ambiguities.length === 0) {
  sectionC += `No within-category ambiguity found.\n`;
} else {
  sectionC += `| Category | regex.ru | # Tokens | # FamilyKeys | FamilyKeys (truncated) |\n`;
  sectionC += `|----------|----------|----------|--------------|------------------------|\n`;
  for (const a of ambiguities) {
    const fks = a.familyKeys
      .map(fk => fk.length > 50 ? fk.slice(0, 47) + '...' : fk)
      .join('; ');
    sectionC += `| ${a.category} | \`${a.regex}\` | ${a.ids.length} | ${a.familyKeys.length} | ${fks} |\n`;
  }
}

// ── Section D: Stats ─────────────────────────────────────────────────────
console.error('Building Section D...');
const categoryOrder = [
  'waystone', 'waystone-desecrated', 'tablet', 'jewel', 'jewel-desecrated',
  'jewel-corrupted', 'relic', 'belt', 'ring', 'amulet',
];

const stats: CategoryStats[] = [];

for (const category of categoryOrder) {
  const tokens = byCategory.get(category);
  if (!tokens) continue;

  const lengths = tokens.map(t => t.regexLength);
  const total = tokens.length;
  const sum = lengths.reduce((a, b) => a + b, 0);
  const avg = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;
  const min = total > 0 ? Math.min(...lengths) : 0;
  const max = total > 0 ? Math.max(...lengths) : 0;
  const shortCount = lengths.filter(l => l < SHORT_THRESHOLD).length;
  const conflictCount = tokens.filter(t => tokensWithConflicts.has(`${t.category}||${t.id}`)).length;

  stats.push({
    category,
    totalTokens: total,
    avgRegexLength: avg,
    minRegexLength: min,
    maxRegexLength: max,
    shortRegexCount: shortCount,
    crossCategoryConflictCount: conflictCount,
  });
}

let sectionD = `## Section D: Stats\n\n`;
sectionD += `| Category | Total Tokens | Avg Regex Len | Min Regex Len | Max Regex Len | Short (<${SHORT_THRESHOLD}) | Cross-Category Conflicts |\n`;
sectionD += `|----------|-------------|---------------|---------------|---------------|----------------|--------------------------|\n`;
for (const s of stats) {
  sectionD += `| ${s.category} | ${s.totalTokens} | ${s.avgRegexLength} | ${s.minRegexLength} | ${s.maxRegexLength} | ${s.shortRegexCount} | ${s.crossCategoryConflictCount} |\n`;
}

// ── Build final report ───────────────────────────────────────────────────
const timestamp = new Date().toISOString();
const report = `# Regex Analysis Report

Generated: ${timestamp}
Data source: ${GENERATED_DIR}
Total tokens: ${allTokens.length}
Categories: ${[...byCategory.keys()].join(', ')}

---

${sectionA}

---

${sectionB}

---

${sectionC}

---

${sectionD}
`;

// ── Output ───────────────────────────────────────────────────────────────
// Write to stdout
process.stdout.write(report);

// Save to file
const reportDir = path.dirname(REPORT_PATH);
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

fs.writeFileSync(REPORT_PATH, report, 'utf-8');
console.error(`\nReport saved to: ${REPORT_PATH}`);
