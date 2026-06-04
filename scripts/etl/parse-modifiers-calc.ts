/**
 * Type B page parser for poe2db.tw
 * Used for: Belts, Rings, Amulets, Relics
 *
 * These pages have mod data in ModifiersCalc section with summary cards + detail modals.
 */
import * as cheerio from 'cheerio';
import type { ModOrigin } from '../../src/shared/types.js';

export interface RawModGroupData {
  genGroup: string;
  origin: ModOrigin;
  tags: string[];
  maxLevel: number;
  tiers: RawModTier[];
}

export interface RawModTier {
  tier: string;
  nameHtml: string;
  level: number;
  descriptionHtml: string;
  weight: string;
  modCode: string;
}

/**
 * Parse a Type B page from poe2db.tw (ModifiersCalc structure)
 */
export function parseTypeBPage(html: string): RawModGroupData[] {
  const $ = cheerio.load(html);
  const results: RawModGroupData[] = [];

  // Find the ModifiersCalc tab pane
  const calcPane = $('div.tab-pane[id*="ModifiersCalc"], div.tab-pane[id*="Modifiers"]').first();
  if (calcPane.length === 0) {
    console.warn('  No ModifiersCalc pane found');
    return results;
  }

  // Extract summary cards -> groups
  calcPane.find('div.mod-title.explicitMod, div.mod-title').each((_, el) => {
    const $el = $(el);

    // Get genGroup from data attribute
    const genGroup = $el.attr('data-gengroup') ||
                     $el.closest('[data-gengroup]').attr('data-gengroup') ||
                     `group_${results.length}`;

    // Determine origin from CSS classes or badges
    let origin: ModOrigin = 'normal';
    const text = $el.text().toLowerCase();
    if (text.includes('desecrated') || text.includes('осквернён')) origin = 'desecrated';
    else if (text.includes('corrupted') || text.includes('оскверн')) origin = 'corrupted';
    else if (text.includes('essence') || text.includes('сущность')) origin = 'essence';
    else if (text.includes('breach') || text.includes('разлом')) origin = 'breachborn';

    // Extract tags from data-tag attributes
    const tags: string[] = [];
    const tagAttr = $el.attr('data-tag') || $el.closest('[data-tag]').attr('data-tag');
    if (tagAttr) {
      tags.push(...tagAttr.split(',').map(t => t.trim()).filter(Boolean));
    }

    // Extract max level from badge
    const levelBadge = $el.find('.badge.bg-secondary, .badge').first();
    const maxLevel = parseInt(levelBadge.text().trim(), 10) || 0;

    // Try to extract tiers from associated detail modal
    const tiers = extractTiersFromModal($, genGroup);

    if (tiers.length > 0) {
      results.push({ genGroup, origin, tags, maxLevel, tiers });
    }
  });

  // If no summary cards found, try extracting from modal tables directly
  if (results.length === 0) {
    const modalTiers = extractTiersFromAllModals($);
    if (modalTiers.length > 0) {
      results.push({
        genGroup: 'all_mods',
        origin: 'normal',
        tags: [],
        maxLevel: 0,
        tiers: modalTiers,
      });
    }
  }

  return results;
}

function extractTiersFromModal($: cheerio.CheerioAPI, genGroup: string): RawModTier[] {
  const tiers: RawModTier[] = [];

  // Find the modal associated with this genGroup
  const modal = $(`div.modal[id*="${genGroup}"], div.modal[data-gengroup="${genGroup}"]`).first();
  if (modal.length === 0) return tiers;

  // Parse the table inside the modal
  modal.find('table.orig tr, table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const tierText = $(cells[0]).text().trim();
    const nameHtml = $(cells[1]).html() || '';
    const descriptionHtml = $(cells[2]).html() || '';
    
    // Level might be in a badge or a specific cell
    const level = parseInt($(cells[0]).find('.badge').text().trim() || 
                          $(row).find('[data-level]').attr('data-level') || '0', 10) || 0;

    // Weight from bg-danger badge
    const weightBadge = $(row).find('.badge.bg-danger, .badge.bg-warning').first();
    const weight = weightBadge.text().trim() || '0';

    // Mod code from data attributes
    const modCode = $(cells[1]).find('[data-code]').attr('data-code') ||
                    $(cells[1]).find('[data-hover]').attr('data-hover') ||
                    $(row).attr('data-code') ||
                    genGroup;

    if (nameHtml || descriptionHtml) {
      tiers.push({
        tier: tierText || `T${tiers.length + 1}`,
        nameHtml,
        level,
        descriptionHtml,
        weight,
        modCode,
      });
    }
  });

  return tiers;
}

function extractTiersFromAllModals($: cheerio.CheerioAPI): RawModTier[] {
  const tiers: RawModTier[] = [];

  $('div.modal table.orig tr, div.modal table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const tierText = $(cells[0]).text().trim();
    const nameHtml = $(cells[1]).html() || '';
    const descriptionHtml = $(cells[2]).html() || '';
    const level = parseInt($(cells[0]).find('.badge').text().trim() || '0', 10) || 0;
    const weightBadge = $(row).find('.badge.bg-danger, .badge.bg-warning').first();
    const weight = weightBadge.text().trim() || '0';
    const modCode = $(cells[1]).find('[data-code]').attr('data-code') ||
                    $(cells[1]).find('[data-hover]').attr('data-hover') ||
                    $(row).attr('data-code') ||
                    `mod_${tiers.length}`;

    if (nameHtml || descriptionHtml) {
      tiers.push({
        tier: tierText || `T${tiers.length + 1}`,
        nameHtml,
        level,
        descriptionHtml,
        weight,
        modCode,
      });
    }
  });

  return tiers;
}
