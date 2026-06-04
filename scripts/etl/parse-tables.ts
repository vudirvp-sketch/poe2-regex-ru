/**
 * Type A page parser for poe2db.tw
 * Used for: Waystones, Tablets, Jewels
 * 
 * These pages have mod data in <table class="tablesorter"> tables.
 * All tab content is in HTML (no lazy loading).
 */
import * as cheerio from 'cheerio';

export interface RawModData {
  level: number;
  nameHtml: string;
  affix: 'prefix' | 'suffix';
  descriptionHtml: string;
  secondaryText?: string;
  modCode?: string;
}

/**
 * Parse a Type A page from poe2db.tw
 * @param html The full HTML of the page
 * @param tabId The tab ID to extract mods from (e.g., "ПутевыекамниMods")
 */
export function parseTypeAPage(html: string, tabId: string): RawModData[] {
  const $ = cheerio.load(html);
  const results: RawModData[] = [];

  // Find the table within the specified tab
  const tabSelector = `#${CSS.escape(tabId)}`;
  const tables = $(`${tabSelector} table.tablesorter`);

  if (tables.length === 0) {
    // Try without tab ID — some pages have the table directly
    $('table.tablesorter').each((_, table) => {
      const rows = $(table).find('tbody tr[role="row"]');
      rows.each((_, row) => {
        const mod = extractRow($, $(row));
        if (mod) results.push(mod);
      });
    });
  } else {
    tables.each((_, table) => {
      const rows = $(table).find('tbody tr[role="row"]');
      rows.each((_, row) => {
        const mod = extractRow($, $(row));
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

  // Find all tab panes that contain tablesorter tables
  $('div.tab-pane').each((_, pane) => {
    const paneId = $(pane).attr('id');
    if (!paneId) return;

    const tables = $(pane).find('table.tablesorter');
    if (tables.length === 0) return;

    const mods: RawModData[] = [];
    tables.each((_, table) => {
      const rows = $(table).find('tbody tr[role="row"]');
      rows.each((_, row) => {
        const mod = extractRow($, $(row));
        if (mod) mods.push(mod);
      });
    });

    if (mods.length > 0) {
      results[paneId] = mods;
    }
  });

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRow($: cheerio.CheerioAPI, row: cheerio.Cheerio<any>): RawModData | null {
  const cells = row.find('td');
  if (cells.length < 3) return null;

  // Column layout varies by page, but typically:
  // Waystones: [Level, Name, Affix, Description]
  // Tablets: [Level, Name, Affix, Description]
  // Some pages: [Name(contains level), Affix, Description]

  let level = 0;
  let nameHtml = '';
  let affix: 'prefix' | 'suffix' = 'suffix';
  let descriptionHtml = '';
  let secondaryText: string | undefined;
  let modCode: string | undefined;

  if (cells.length >= 4) {
    // Standard layout: Level | Name | Affix | Description
    const levelText = $(cells[0]).text().trim();
    level = parseInt(levelText, 10) || 0;
    nameHtml = $(cells[1]).html() || '';
    
    const affixText = $(cells[2]).text().trim().toLowerCase();
    affix = affixText.includes('pre') ? 'prefix' : 'suffix';
    
    descriptionHtml = $(cells[3]).html() || '';
  } else if (cells.length >= 3) {
    // Compact layout: Name(contains level) | Affix | Description
    nameHtml = $(cells[0]).html() || '';
    
    const affixText = $(cells[1]).text().trim().toLowerCase();
    affix = affixText.includes('pre') ? 'prefix' : 'suffix';
    
    descriptionHtml = $(cells[2]).html() || '';
  } else {
    return null;
  }

  // Extract mod code from data attributes
  const nameCell = cells.length >= 4 ? cells[1] : cells[0];
  modCode = $(nameCell).find('[data-code]').attr('data-code') ||
            $(nameCell).find('[data-hover]').attr('data-hover') ||
            undefined;

  // Extract secondary text
  const secondary = row.find('span.secondary');
  if (secondary.length > 0) {
    secondaryText = secondary.text().trim();
  }

  return {
    level,
    nameHtml,
    affix,
    descriptionHtml,
    secondaryText,
    modCode,
  };
}
