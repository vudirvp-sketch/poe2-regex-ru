/**
 * Analyze FN (false negative) cases across all categories.
 * Uses matchQuotedGroup from the PoE2 regex matcher to check each regex
 * against its own rawText.
 *
 * Usage: npx tsx scripts/analyze-fn.ts
 */
import { matchQuotedGroup } from '../src/core/poe2-regex-matcher.js';
import * as fs from 'fs';
import * as path from 'path';

const GENERATED_DIR = path.resolve(process.cwd(), 'public', 'generated');

interface Token {
  id: string;
  category: string;
  rawText: { ru: string };
  regex: { ru: string };
  rawTextTemplate: { ru: string };
}

interface DataFile {
  category: string;
  tokens: Token[];
}

let totalFN = 0;
let totalFP = 0;
let totalTokens = 0;

const jsonFiles = fs.readdirSync(GENERATED_DIR).filter(f => f.endsWith('.json'));

for (const file of jsonFiles) {
  const data: DataFile = JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, file), 'utf-8'));
  const tokens = data.tokens;

  let catFN = 0;
  let catFP = 0;

  for (const token of tokens) {
    const regex = token.regex?.ru || '';
    const rawText = token.rawText?.ru || '';
    if (!regex || !rawText) continue;

    // Bug #13 (closed iter 80): Removed skip for .* [0-9] [1-9] patterns.
    // token.regex.ru is always a literal suffix — see iterative-optimizer.ts line 469.

    // Check FN
    if (!matchQuotedGroup(regex, rawText)) {
      catFN++;
      console.log(`FN: ${token.id} (category: ${data.category})`);
      console.log(`  regex: "${regex}"`);
      console.log(`  rawText: "${rawText.substring(0, 80)}"`);
      console.log(`  template: "${token.rawTextTemplate?.ru || 'N/A'}"`);
      console.log();
    }

    // Check FP (within category)
    for (const other of tokens) {
      if (other.id === token.id) continue;
      const otherRaw = other.rawText?.ru || '';
      if (!otherRaw) continue;
      if (matchQuotedGroup(regex, otherRaw)) {
        catFP++;
      }
    }
  }

  totalFN += catFN;
  totalFP += catFP;
  totalTokens += tokens.length;

  if (catFN > 0 || catFP > 0) {
    console.log(`${data.category}: ${tokens.length} tokens, FN=${catFN}, FP=${catFP}`);
  } else {
    console.log(`${data.category}: ${tokens.length} tokens, all literal regexes valid`);
  }
}

console.log(`\nTotal: ${totalTokens} tokens, FN=${totalFN}, FP=${totalFP}`);
