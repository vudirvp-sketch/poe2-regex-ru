/**
 * RegexOutput — Displays the generated regex string with copy and share buttons.
 *
 * Features (matching plan spec 9.2):
 * - Visual Character Health Bar (green/yellow/red) instead of poe2.re's invisible gray text
 * - Overflow protection: red notification + copy blocked when exceeding 250 chars
 * - Split regex display: when regex > 250 chars and has top-level `|`, splits into
 *   multiple copyable parts that each fit within the PoE2 char limit (iter 50)
 * - Copy-to-clipboard and URL sharing functionality
 * - Sticky positioning so output is always visible while adjusting filters
 * - Auto-copy on regex generation (optional, toggled by checkbox)
 * - Keyboard shortcut: Ctrl+Shift+X to copy regex
 * - Level 1 visual frame (iter 55, UI redesign Phase 3): gold border + glow +
 *   corner accents via .regex-output CSS class — marks the primary output element.
 *
 * Health bar thresholds (from limits.ts):
 * - Green: 0-200 characters
 * - Yellow: 201-240 characters
 * - Red: 241-250 characters (approaching limit)
 * - Red + pulse: >250 characters (OVERFLOW — copy blocked for single regex)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MAX_CHARS } from '@core/limits';
import { getShareableUrl, type SerializableStore } from '@store/url-sync';
import { t } from '@shared/i18n';

interface RegexOutputProps {
  regex: string;
  isOverflow: boolean;
  /** Optional filter store reference for URL sharing */
  filterStore?: SerializableStore | null;
  /** Number of active (selected + excluded) tokens — for budget-aware warnings */
  activeTokenCount?: number;
  /** Split regex parts when the compiled regex exceeds 250 chars.
   *  Each part is a valid regex content (without outer quotes) that can be
   *  pasted separately in PoE2. Undefined when within limit or cannot split. */
  regexParts?: string[];
}

/** Get health level for character count */
function getHealthLevel(count: number): 'green' | 'yellow' | 'red' {
  if (count <= 200) return 'green';
  if (count <= 240) return 'yellow';
  return 'red';
}

/** Health bar color map */
const HEALTH_COLORS = {
  green: {
    bar: 'bg-emerald-500',
    barBg: 'bg-indicator-green',
    text: 'text-accent-emerald',
    label: t('health.green'),
  },
  yellow: {
    bar: 'bg-yellow-500',
    barBg: 'bg-indicator-yellow',
    text: 'text-accent-yellow',
    label: t('health.yellow'),
  },
  red: {
    bar: 'bg-red-500',
    barBg: 'bg-indicator-red',
    text: 'text-accent-red',
    label: t('health.red'),
  },
} as const;

/** Per-part copy button with its own copied/error state */
const PartCopyButton: React.FC<{ part: string; index: number; total: number }> = ({ part, index, total }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  // Wrap the part in quotes for PoE2 search
  const fullPart = `"${part}"`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPart);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, [fullPart]);

  const partLen = fullPart.length;
  const partHealth = getHealthLevel(partLen);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-dim font-medium">
          {t('regex.part_label').replace('{n}', String(index + 1)).replace('{total}', String(total))}
          <span className={`ml-1.5 font-mono ${partHealth === 'green' ? 'text-accent-emerald' : partHealth === 'yellow' ? 'text-accent-yellow' : 'text-accent-red'}`}>
            {partLen}/{MAX_CHARS}
          </span>
        </span>
        <button
          onClick={handleCopy}
          className={`px-2 py-0.5 text-[12px] rounded font-medium transition-all ${
            copyError
              ? 'btn-cta-error'
              : copied
                ? 'btn-cta-success'
                : 'btn-cta'
          }`}
        >
          {copyError ? t('regex.copy_error') : copied ? t('regex.copied') : t('regex.copy')}
        </button>
      </div>
      <div className="p-2 rounded font-mono text-sm break-all bg-surface border border-edge text-accent-green-soft">
        {fullPart}
      </div>
    </div>
  );
};

export const RegexOutput: React.FC<RegexOutputProps> = ({ regex, isOverflow, filterStore, activeTokenCount = 0, regexParts }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [autoCopy, setAutoCopy] = useState(() => {
    try {
      return localStorage.getItem('poe2-regex-auto-copy') === 'true';
    } catch {
      return false;
    }
  });
  const prevRegexRef = useRef<string>('');

  // Whether we're showing split parts (over-limit with top-level |)
  const showParts = isOverflow && regexParts && regexParts.length > 1;

  // Persist auto-copy preference
  useEffect(() => {
    try {
      localStorage.setItem('poe2-regex-auto-copy', String(autoCopy));
    } catch {
      // ignore
    }
  }, [autoCopy]);

  // Auto-copy regex when it changes (if enabled and not overflow)
  useEffect(() => {
    if (!autoCopy || !regex || isOverflow) return;
    if (regex === prevRegexRef.current) return;
    prevRegexRef.current = regex;

    navigator.clipboard.writeText(regex).catch(() => {
      // silently ignore clipboard errors
    });
  }, [regex, autoCopy, isOverflow]);

  const handleCopy = useCallback(async () => {
    if (!regex || isOverflow) return;
    try {
      await navigator.clipboard.writeText(regex);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }, [regex, isOverflow]);

  // Keyboard shortcut: Ctrl+Shift+X to copy regex
  // (Ctrl+Shift+C conflicts with browser DevTools)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'X' || e.key === 'x' || e.key === 'Ч' || e.key === 'ч')) {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleCopy]);

  const handleShare = useCallback(async () => {
    if (!filterStore) return;
    try {
      const url = getShareableUrl(filterStore);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share URL:', err);
    }
  }, [filterStore]);

  const charCount = regex.length;
  const healthLevel = isOverflow ? 'red' : getHealthLevel(charCount);
  const healthConfig = HEALTH_COLORS[healthLevel];
  const healthPercent = Math.min((charCount / MAX_CHARS) * 100, 100);

  return (
    <div className="regex-output"
      role="region"
      aria-label={t('regex.title')}
      aria-live="off"
    >
      {/* Header row: title + buttons */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-medium text-soft">{t('regex.title')}</h3>
        <div className="flex items-center gap-2">
          {/* Auto-copy toggle */}
          <label className="flex items-center gap-1 cursor-pointer" title={t('regex.auto')}>
            <input
              type="checkbox"
              checked={autoCopy}
              onChange={(e) => setAutoCopy(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-raised border-edge text-accent-amber"
            />
            <span className="text-[12px] text-dim font-medium">{t('regex.auto')}</span>
          </label>
          {/* Share button */}
          {filterStore && regex && (
            <button
              onClick={handleShare}
              className={`px-2.5 py-1 text-[13px] rounded font-medium transition-colors ${
                shareCopied
                  ? 'bg-btn-success text-bright'
                  : 'bg-raised text-soft hover:bg-chip-hover'
              }`}
              title={t('regex.share_title')}
            >
              {shareCopied ? t('regex.share_copied') : t('regex.share')}
            </button>
          )}
          {/* Copy button — disabled when overflow (unless showing split parts, each has its own copy).
              iter 65: swapped cold `bg-btn-primary` (#2563eb) for `.btn-cta` (warm metallic +
              crimson glow on hover). Success → `.btn-cta-success` (emerald-gold rim + green glow).
              Error → `.btn-cta-error` (red rim). Disabled → `.btn-cta:disabled` (warm-raised, dim).
              See Pitfall 28 (palette consistency) + Pitfall 29 (CTA state classes). */}
          <button
            onClick={handleCopy}
            disabled={!regex || isOverflow}
            className={`px-3 py-1.5 text-[13px] rounded font-medium transition-all ${
              copyError
                ? 'btn-cta-error'
                : copied
                  ? 'btn-cta-success'
                  : 'btn-cta'
            }`}
            title={t('regex.copy_shortcut')} // Ctrl+Shift+X
          >
            {copyError ? t('regex.copy_error') : copied ? t('regex.copied') : t('regex.copy')}
          </button>
        </div>
      </div>

      {/* Character Health Bar — visual green/yellow/red indicator */}
      <div className="mb-2" role="progressbar" aria-valuenow={Math.min(charCount, MAX_CHARS)} aria-valuemin={0} aria-valuemax={MAX_CHARS} aria-label={`Символов: ${charCount} из ${MAX_CHARS}${isOverflow ? ', переполнение' : ''}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[13px] font-medium ${isOverflow ? 'text-accent-red animate-pulse' : healthConfig.text}`}>
            {isOverflow ? t('regex.overflow') : healthConfig.label}
          </span>
          <span className={`text-[13px] font-mono ${healthConfig.text}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>
        <div className={`h-2.5 rounded-full overflow-hidden ${healthConfig.barBg}`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              isOverflow ? 'bg-red-500 animate-pulse' : healthConfig.bar
            }`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Budget-aware warning: approaching limit with 6+ mods */}
      {!isOverflow && charCount > 180 && activeTokenCount >= 6 && (
        <div className="mb-2 p-2 bg-section-amber border border-aborder-amber-strong rounded text-atext-amber text-[12px] flex items-center gap-1.5">
          <span>\u26A0</span>
          <span>{t('regex.budget_warning').replace('{chars}', String(MAX_CHARS - charCount)).replace('{mods}', String(activeTokenCount))}</span>
        </div>
      )}

      {/* Split regex parts display (iter 50 — over-limit with top-level |) */}
      {showParts && (
        <div className="mb-2 flex flex-col gap-1.5">
          <div className="p-2 bg-section-amber border border-aborder-amber rounded text-atext-amber text-[12px] flex items-center gap-1.5">
            <span>\u26A0</span>
            <span>{t('regex.split_hint')}</span>
          </div>
          {regexParts.map((part, i) => (
            <PartCopyButton key={i} part={part} index={i} total={regexParts.length} />
          ))}
        </div>
      )}

      {/* Overflow warning (no split available) */}
      {isOverflow && !showParts && (
        <div className="mb-2 p-2.5 bg-section-red border border-danger rounded text-accent-red-soft text-[13px]">
          {t('regex.overflow_detail')}
        </div>
      )}

      {/* Regex display area — single regex (or overflow without split) */}
      {!showParts && (
        <div
          className={`p-3 rounded font-mono text-base break-all min-h-[60px] ${
            isOverflow
              ? 'bg-indicator-red-deep border border-danger-strong text-accent-red-soft'
              : regex
                ? 'bg-surface border border-edge text-accent-green-soft'
                : 'bg-panel border border-edge-panel text-dim'
          }`}
          aria-label={regex || t('regex.title')}
        >
          {regex || t('regex.placeholder')}
        </div>
      )}
    </div>
  );
};
