/**
 * Type A page parser for poe2db.tw
 * Used for: Waystones, Tablets, Jewels, Relics (#RelicMods tab)
 *
 * These pages have mod data in <table class="table ... filters"> tables.
 * All tab content is in HTML (no lazy loading).
 *
 * Column layouts vary by page:
 * - Waystones normal:     [Level, Pre/Suf, Description] (3 cols)
 * - Waystones desecrated: [Name, Pre/Suf, Description] (3 cols)
 * - Tablets:              [Level, Pre/Suf, Description] (3 cols)
 * - Jewels normal/desec:  [Name, Level, Pre/Suf, Description] (4 cols)
 * - Jewels corrupt:       [Level, Pre/Suf(Осквернено), Description] (3 cols)
 * - Relics #RelicMods:    [Name, Level, Pre/Suf, Description, Weight] (5 cols)
 */
import * as cheerio from 'cheerio';
import type { ModOrigin } from '../../src/shared/types.js';

export interface RawModData {
  level: number;
  nameHtml: string;
  affix: 'prefix' | 'suffix';
  descriptionHtml: string;
  secondaryText?: string;
  modCode?: string;
  tags: string[];
  origin: ModOrigin;
}

/**
 * Escape a string for use as a CSS ID selector.
 * Handles Unicode, colons, periods, and other special characters.
 * Replaces CSS.escape() which is not available in Node.js.
 */
function cssEscapeId(id: string): string {
  // CSS.escape algorithm (simplified for ID selectors):
  // If the first character is a digit or hyphen+digit, escape it
  // Escape special CSS characters: \0-\x1f, ., :, [, ], etc.
  let result = '';
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    if (ch === 0) {
      result += '\uFFFD';
    } else if (
      (i === 0 && ch >= 0x30 && ch <= 0x39) || // starts with digit
      (i === 1 && id[0] === '-' && ch >= 0x30 && ch <= 0x39) || // -digit
      ch === 0x2E || // .
      ch === 0x3A || // :
      ch === 0x5B || // [
      ch === 0x5D || // ]
      ch < 0x20       // control chars
    ) {
      result += '\\' + id[i];
    } else {
      result += id[i];
    }
  }
  return result;
}

/**
 * Determine column layout from thead headers.
 * Returns a mapping of column indices to their semantic roles.
 */
function detectColumnLayout($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): Map<string, number> {
  const layout = new Map<string, number>();
  const headers = $(table).find('thead th');

  headers.each((i, th) => {
    const text = $(th).text().trim().toLowerCase();
    if (text.includes('имя') || text.includes('name')) {
      layout.set('name', i);
    } else if (text.includes('уровень') || text.includes('level')) {
      layout.set('level', i);
    } else if (text.includes('pre') || text.includes('suf') || text.includes('affix')) {
      layout.set('affix', i);
    } else if (text.includes('description') || text.includes('описан')) {
      layout.set('description', i);
    } else if (text.includes('weight') || text.includes('вес')) {
      layout.set('weight', i);
    }
  });

  return layout;
}

/**
 * Parse affix type from Russian text or corrupted link.
 * - "Префикс" -> 'prefix'
 * - "Суффикс" -> 'suffix'
 * - "Осквернено" or link containing "Corrupted" -> 'corrupted'
 */
function parseAffixType($: cheerio.CheerioAPI, cell: cheerio.Cheerio<any>): 'prefix' | 'suffix' {
  const text = $(cell).text().trim().toLowerCase();

  // Check for corrupted link — treat as suffix for type purposes
  const corruptLink = $(cell).find('a[data-keyword="Corrupted"]');
  if (corruptLink.length > 0 || text.includes('осквернён') || text.includes('осквернен')) {
    return 'suffix'; // corrupted mods are stored with origin='corrupted' but affix='suffix'
  }

  if (text.includes('префикс') || text.includes('prefix') || text.includes('pre')) {
    return 'prefix';
  }

  return 'suffix';
}

/**
 * Extract tags from data-tag attributes within a cell.
 */
function extractTags($: cheerio.CheerioAPI, cell: cheerio.Cheerio<any>): string[] {
  const tags: string[] = [];
  $(cell).find('[data-tag]').each((_, el) => {
    const tag = $(el).attr('data-tag');
    if (tag) tags.push(tag);
  });
  return tags;
}

/**
 * Extract mod code from data-hover attribute on info icon or link.
 * The hover URL contains the mod code in the path, e.g.:
 *   ?s=Data%5CMods%2FStrength1  ->  Strength1
 *   https://cdn.poe2db.tw/cache2/ru/Poe_Data_Mods_hover/<hash>
 */
function extractModCode($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>): string | undefined {
  // Check for <i class="fas fa-info-circle" data-hover="..."> (relics and some pages)
  const infoIcon = $(row).find('i.fas.fa-info-circle[data-hover]');
  if (infoIcon.length > 0) {
    const hover = infoIcon.first().attr('data-hover') || '';
    const codeMatch = hover.match(/Mods%2F([^&"']+)|Mods\/([^&"']+)/);
    if (codeMatch) {
      return codeMatch[1] || codeMatch[2];
    }
  }

  // Check for data-hover on links in description cell
  const hoverLink = $(row).find('[data-hover]');
  if (hoverLink.length > 0) {
    const hover = hoverLink.first().attr('data-hover') || '';
    const codeMatch = hover.match(/Mods%2F([^&"']+)|Mods\/([^&"']+)/);
    if (codeMatch) {
      return codeMatch[1] || codeMatch[2];
    }
  }

  return undefined;
}

/**
 * Parse a Type A page from poe2db.tw
 * @param html The full HTML of the page
 * @param tabId The tab ID to extract mods from (e.g., "ПутевыекамниMods")
 * @param origin Override origin for all mods in this tab
 */
export function parseTypeAPage(
  html: string,
  tabId: string,
  origin: ModOrigin = 'normal'
): RawModData[] {
  const $ = cheerio.load(html);
  const results: RawModData[] = [];

  // Find the table within the specified tab
  const tabSelector = `#${cssEscapeId(tabId)}`;
  const tables = $(`${tabSelector} table.filters`);

  if (tables.length === 0) {
    // Fallback: try tablesorter (old poe2db format) or any table with tbody
    $(`${tabSelector} table`).each((_, table) => {
      const rows = $(table).find('tbody tr');
      rows.each((_, row) => {
        const mod = extractRow($, $(row), $(table), origin);
        if (mod) results.push(mod);
      });
    });
  } else {
    tables.each((_, table) => {
      const rows = $(table).find('tbody tr');
      rows.each((_, row) => {
        const mod = extractRow($, $(row), $(table), origin);
        if (mod) results.push(mod);
      });
    });
  }

  return results;
}

/**
 * Parse ALL Type A tabs from a page.
 * Returns a map of tabId -> RawModData[]
 */
export function parseAllTypeATabs(html: string): Record<string, RawModData[]> {
  const $ = cheerio.load(html);
  const results: Record<string, RawModData[]> = {};

  // Find all tab panes that contain tables
  $('div.tab-pane').each((_, pane) => {
    const paneId = $(pane).attr('id');
    if (!paneId) return;

    // Look for tables with filters class (primary) or any data table
    const tables = $(pane).find('table.filters');
    if (tables.length === 0) return;

    // Determine origin from tab ID
    let origin: 'normal' | 'desecrated' | 'corrupted' = 'normal';
    const idLower = paneId.toLowerCase();
    if (idLower.includes('desecrated')) origin = 'desecrated';
    else if (idLower.includes('corrupt')) origin = 'corrupted';

    const mods: RawModData[] = [];
    tables.each((_, table) => {
      const rows = $(table).find('tbody tr');
      rows.each((_, row) => {
        const mod = extractRow($, $(row), $(table), origin);
        if (mod) mods.push(mod);
      });
    });

    if (mods.length > 0) {
      results[paneId] = mods;
    }
  });

  return results;
}

/**
 * Extract a single mod from a table row.
 * Uses thead headers to determine column layout dynamically.
 */
function extractRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<any>,
  table: cheerio.Cheerio<any>,
  defaultOrigin: ModOrigin
): RawModData | null {
  const cells = row.find('td');
  if (cells.length < 3) return null;

  // Detect column layout from headers
  const layout = detectColumnLayout($, table);
  const numCells = cells.length;

  let level = 0;
  let nameHtml = '';
  let affix: 'prefix' | 'suffix' = 'suffix';
  let descriptionHtml = '';
  let secondaryText: string | undefined;
  let modCode: string | undefined;
  let tags: string[] = [];

  // Helper: get cell by semantic role or fallback to index
  const getCell = (role: string, fallbackIndex: number): any => {
    const idx = layout.get(role);
    if (idx !== undefined && idx < numCells) return cells[idx];
    if (fallbackIndex >= 0 && fallbackIndex < numCells) return cells[fallbackIndex];
    return null;
  };

  // Level
  const levelCell = getCell('level', 0);
  if (levelCell) {
    const levelText = $(levelCell).text().trim();
    level = parseInt(levelText, 10) || 0;
  }

  // Name
  const nameCell = getCell('name', -1);
  if (nameCell && layout.has('name')) {
    nameHtml = $(nameCell).html() || '';
  } else if (numCells >= 4 && !layout.has('name')) {
    // In 3-column layouts without a name column, nameHtml stays empty
    // In 4+ column layouts, try to find name from context
  }

  // Affix
  const affixCell = getCell('affix', 1);
  if (affixCell) {
    affix = parseAffixType($, $(affixCell));
  }

  // Description
  const descCell = getCell('description', 2);
  if (descCell) {
    descriptionHtml = $(descCell).html() || '';
    tags = extractTags($, $(descCell));
  }

  // If no explicit layout detected, use positional fallback
  if (layout.size === 0) {
    if (numCells === 3) {
      // [Level|Name, Pre/Suf, Description]
      const firstCellText = $(cells[0]).text().trim();
      const isFirstCellNumeric = /^\d+$/.test(firstCellText);

      if (isFirstCellNumeric) {
        level = parseInt(firstCellText, 10) || 0;
        nameHtml = '';
      } else {
        nameHtml = $(cells[0]).html() || '';
        level = 0;
      }

      affix = parseAffixType($, $(cells[1]));
      descriptionHtml = $(cells[2]).html() || '';
      tags = extractTags($, $(cells[2]));
    } else if (numCells === 4) {
      // [Name, Level, Pre/Suf, Description]
      nameHtml = $(cells[0]).html() || '';
      const levelText = $(cells[1]).text().trim();
      level = parseInt(levelText, 10) || 0;
      affix = parseAffixType($, $(cells[2]));
      descriptionHtml = $(cells[3]).html() || '';
      tags = extractTags($, $(cells[3]));
    } else if (numCells >= 5) {
      // [Name, Level, Pre/Suf, Description, Weight]
      nameHtml = $(cells[0]).html() || '';
      const levelText = $(cells[1]).text().trim();
      level = parseInt(levelText, 10) || 0;
      affix = parseAffixType($, $(cells[2]));
      descriptionHtml = $(cells[3]).html() || '';
      tags = extractTags($, $(cells[3]));
    }
  }

  // Skip empty description rows
  if (!descriptionHtml || $(descriptionHtml).text().trim().length === 0) {
    return null;
  }

  // Skip rows that only contain secondary/internal text
  const descText = $(`<div>${descriptionHtml}</div>`).text().trim();
  if (descText.length === 0) return null;

  // Extract mod code
  modCode = extractModCode($, row);

  // Extract secondary text (internal stat identifiers)
  const secondary = row.find('span.secondary');
  if (secondary.length > 0) {
    const secTexts: string[] = [];
    secondary.each((_, el) => {
      const t = $(el).text().trim();
      if (t) secTexts.push(t);
    });
    if (secTexts.length > 0) {
      secondaryText = secTexts.join('; ');
    }
  }

  // Determine origin based on Pre/Suf cell content
  let origin: ModOrigin = defaultOrigin;
  const affixCellForOrigin = getCell('affix', 1);
  if (affixCellForOrigin) {
    const affixCellText = $(affixCellForOrigin).text().trim().toLowerCase();
    if (affixCellText.includes('осквернён') || affixCellText.includes('осквернен')) {
      origin = 'corrupted';
    }
  }

  return {
    level,
    nameHtml,
    affix,
    descriptionHtml,
    secondaryText,
    modCode,
    tags,
    origin,
  };
}
