/**
 * RegexOutput — Displays the generated regex string with copy and share buttons.
 *
 * Features (matching plan spec 9.2):
 * - Visual Character Health Bar (green/yellow/red) instead of poe2.re's invisible gray text
 * - Overflow protection: red notification + copy blocked when exceeding 250 chars
 * - Copy-to-clipboard and URL sharing functionality
 * - Sticky positioning so output is always visible while adjusting filters
 * - Auto-copy on regex generation (optional, toggled by checkbox)
 * - Keyboard shortcut: Ctrl+Shift+C to copy regex
 *
 * Health bar thresholds (from limits.ts):
 * - Green: 0-200 characters
 * - Yellow: 201-240 characters
 * - Red: 241-250 characters (approaching limit)
 * - Red + pulse: >250 characters (OVERFLOW — copy blocked)
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

export const RegexOutput: React.FC<RegexOutputProps> = ({ regex, isOverflow, filterStore, activeTokenCount = 0 }) => {
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
    <div className="regex-output -mx-1 px-1 py-1"
      style={{ background: 'var(--poe-bg, #0a0a0f)' }}
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
              className="w-3.5 h-3.5 rounded bg-raised border-edge text-blue-500"
            />
            <span className="text-[12px] text-dim">{t('regex.auto')}</span>
          </label>
          {/* Share button */}
          {filterStore && regex && (
            <button
              onClick={handleShare}
              className={`px-2.5 py-1 text-[13px] rounded font-medium transition-colors ${
                shareCopied
                  ? 'bg-btn-success text-bright'
                  : 'bg-gray-600 text-soft hover:bg-gray-500'
              }`}
              title={t('regex.share_title')}
            >
              {shareCopied ? t('regex.share_copied') : t('regex.share')}
            </button>
          )}
          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!regex || isOverflow}
            className={`px-3 py-1.5 text-[13px] rounded font-medium transition-colors ${
              copyError
                ? 'bg-btn-danger text-bright'
                : copied
                  ? 'bg-btn-success text-bright'
                  : isOverflow || !regex
                    ? 'bg-raised text-dim cursor-not-allowed'
                    : 'bg-btn-primary text-bright hover:bg-btn-primary-hover'
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

      {/* Overflow warning */}
      {isOverflow && (
        <div className="mb-2 p-2.5 bg-section-red border border-danger rounded text-accent-red-soft text-[13px]">
          {t('regex.overflow_detail')}
        </div>
      )}

      {/* Regex display area */}
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
    </div>
  );
};
