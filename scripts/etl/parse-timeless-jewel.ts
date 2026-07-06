/**
 * parse-timeless-jewel.ts — One-off parser for Timeless Jewel atlas passives.
 *
 * iter 176 — NEW. NOT wired into `run-etl.ts`. Run manually:
 *
 *   npx tsx scripts/etl/parse-timeless-jewel.ts
 *
 * ## Why a separate script (not integrated into run-etl.ts)
 *
 *   1. Volume is tiny: 2 source pages, ~75 nodes total.
 *   2. The HTML structure (`<div class="col">…<a data-hover="?s=Data%5C…">…</a>…`)
 *      is different from the existing #ModsView / #RelicMods table parsers,
 *      so it would need a brand-new ETL type — overkill for a rarely-changing
 *      source.
 *   3. Output JSON is committed to the repo. Re-run only when GGG adds a new
 *      Timeless Jewel (then commit the regenerated file).
 *
 * ## What it does
 *
 *   For each of the 2 jewel pages on poe2db.tw:
 *     - Fetches the HTML (via the shared fetch-poe2db.ts cache).
 *     - Finds the `#ВневременнойсамоцветPassive` section.
 *     - Within the section, walks every `<div class="col">` block. Each block
 *       represents one atlas passive node and contains:
 *         • icon <img src="https://cdn.poe2db.tw/image/Art/2DArt/SkillIcons/passives/…">
 *         • name <a data-hover="?s=Data%5CAlternatePassiveSkills%2F<key>" href="/ru/<slug>">Russian name</a>
 *         • one or more effect lines <div class="implicitMod">…</div>
 *     - Extracts: sourceKey (URL-decoded from data-hover), slug, name, iconUrl,
 *       description (effect lines joined with `\n`, with HTML stripped and
 *       `<span class="mod-value">N</span>` collapsed to `N`).
 *
 *   Output: `public/generated/timeless-jewel.json` validated against
 *   `AtlasJewelCategoryDataSchema`.
 *
 * ## Manual review step
 *
 *   After running, open the JSON in a diff view and sanity-check:
 *     - Node count per jewel matches the source page header (35 / 40).
 *     - No empty descriptions.
 *     - Names match `регис/undying_hate_nodes.txt` and `регис/heroic_tragedy_nodes.txt`.
 */
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { fetchPage, hashContent } from './fetch-poe2db.js';
import { AtlasJewelCategoryDataSchema } from '../../src/shared/schemas.js';
import type { AtlasJewelCategoryData, AtlasJewelId, AtlasNodeToken } from '../../src/shared/types.js';

const OUT_PATH = path.resolve(process.cwd(), 'public/generated/timeless-jewel.json');

interface JewelSource {
  id: AtlasJewelId;
  /** Russian display name of the jewel itself (header on poe2db). */
  name: string;
  /** poe2db.tw URL (Russian locale). */
  url: string;
  /** Anchor id of the passives section on the page. */
  sectionAnchor: string;
}

const JEWEL_SOURCES: JewelSource[] = [
  {
    id: 'undying-hate',
    name: 'Вечная ненависть',
    url: 'https://poe2db.tw/ru/Undying_Hate',
    // poe2db generates anchor ids by transliterating the section heading
    // "Вневременной самоцвет Passive" → "ВневременнойсамоцветPassive"
    // (whitespace stripped, leading uppercase preserved).
    sectionAnchor: 'ВневременнойсамоцветPassive',
  },
  {
    id: 'heroic-tragedy',
    name: 'Трагедия героев',
    url: 'https://poe2db.tw/ru/Heroic_Tragedy',
    sectionAnchor: 'ВневременнойсамоцветPassive',
  },
];

/** Decode the `?s=Data%5CAlternatePassiveSkills%2F<key>` data-hover attribute. */
function decodeSourceKey(dataHover: string): string | null {
  // Format: "?s=Data%5CAlternatePassiveSkills%2Fabyss_notable_1"
  const match = dataHover.match(/\bs=([^&]+)/);
  if (!match) return null;
  const decoded = decodeURIComponent(match[1]);
  // Expect "Data\AlternatePassiveSkills\<key>"
  const keyMatch = decoded.match(/AlternatePassiveSkills[\\/](.+)$/);
  return keyMatch ? keyMatch[1] : null;
}

/** Strip HTML, collapse whitespace, keep numeric mod-values inline. */
function cleanText($: cheerio.CheerioAPI, el: cheerio.AnyNode): string {
  // Clone so we don't mutate the source DOM.
  const $clone = $(el).clone();
  // Replace <span class="mod-value">N</span> with the bare value (keeps "5%" readable).
  $clone.find('span.mod-value').each((_, span) => {
    const txt = $(span).text();
    $(span).replaceWith(txt);
  });
  const text = $clone.text().replace(/\s+/g, ' ').trim();
  return text;
}

function parseJewel(html: string, source: JewelSource): AtlasNodeToken[] {
  const $ = cheerio.load(html);

  // Find the section by anchor id. poe2db uses raw cyrillic in the id.
  const sectionHeader = $(`#${source.sectionAnchor}`);
  if (sectionHeader.length === 0) {
    throw new Error(
      `Section #${source.sectionAnchor} not found on ${source.url}. ` +
      `Page structure may have changed — inspect HTML manually.`,
    );
  }

  // The section header sits inside a container; sibling structure varies.
  // Strategy: walk up to the nearest .table-responsive / .row container,
  // then collect all `<div class="col">` blocks within it.
  const container = sectionHeader.closest('div').parent().find('.col');

  if (container.length === 0) {
    throw new Error(
      `No .col blocks found near #${source.sectionAnchor} on ${source.url}.`,
    );
  }

  const nodes: AtlasNodeToken[] = [];
  const seenKeys = new Set<string>();

  container.each((_, el) => {
    const $el = $(el);
    const $link = $el.find('a[data-hover]').first();
    if ($link.length === 0) return;

    const dataHover = $link.attr('data-hover') ?? '';
    const sourceKey = decodeSourceKey(dataHover);
    if (!sourceKey) return;

    // Slug from href: "/ru/Disciple_of_Darkness" → "Disciple_of_Darkness"
    const href = $link.attr('href') ?? '';
    const slug = href.split('/').filter(Boolean).pop() ?? sourceKey;

    const name = $link.text().trim();
    if (!name) return;

    // Icon URL — first <img> with cdn.poe2db.tw src inside the block.
    const $img = $el.find('img').first();
    const iconUrl = $img.attr('src') ?? '';
    if (!iconUrl.startsWith('http')) return; // skip placeholder/broken

    // Effects — every `.implicitMod` div under this block.
    const effectLines: string[] = [];
    $el.find('.implicitMod').each((_, modEl) => {
      const line = cleanText($, modEl);
      if (line) effectLines.push(line);
    });
    if (effectLines.length === 0) return; // skip nodes with no effects (data noise)
    const description = effectLines.join('\n');

    // Dedup by sourceKey — poe2db sometimes lists the same notable twice
    // (once per jewel socket variant).
    if (seenKeys.has(sourceKey)) return;
    seenKeys.add(sourceKey);

    nodes.push({
      id: `${source.id}.${sourceKey}`,
      jewel: source.id,
      name: { ru: name },
      description: { ru: description },
      iconUrl,
      slug,
      sourceKey,
    });
  });

  if (nodes.length === 0) {
    throw new Error(
      `Parsed 0 nodes from ${source.url}. Check HTML structure.`,
    );
  }

  console.log(`  [${source.id}] parsed ${nodes.length} nodes`);
  return nodes;
}

async function main(): Promise<void> {
  console.log('Timeless Jewel parser — iter 176');

  const jewels: AtlasJewelCategoryData['jewels'] = [];
  const sourceHashes: string[] = [];

  for (const source of JEWEL_SOURCES) {
    console.log(`\nFetching ${source.id} (${source.url})…`);
    const html = await fetchPage(source.url);
    sourceHashes.push(hashContent(html));
    const nodes = parseJewel(html, source);
    jewels.push({
      id: source.id,
      name: { ru: source.name },
      nodes,
    });
  }

  const output: AtlasJewelCategoryData = {
    version: new Date().toISOString(),
    category: 'timeless-jewel',
    source: 'poe2db.tw',
    sourceHash: hashContent(sourceHashes.join('|')),
    jewels,
  };

  // Validate against Zod schema before writing.
  const validated = AtlasJewelCategoryDataSchema.safeParse(output);
  if (!validated.success) {
    console.error('\nSchema validation FAILED:');
    console.error(JSON.stringify(validated.error.issues, null, 2));
    process.exit(1);
  }

  // Ensure output dir exists.
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');

  const totalNodes = jewels.reduce((s, j) => s + j.nodes.length, 0);
  console.log(
    `\n✓ Wrote ${OUT_PATH}\n  ${jewels.length} jewels, ${totalNodes} nodes total`,
  );
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
