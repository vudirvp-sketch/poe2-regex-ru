/**
 * RegexOutput — Displays the generated regex string with copy and share buttons.
 *
 * Features (matching plan spec 9.2):
 * - Visual Character Health Bar (green/yellow/red) instead of poe2.re's invisible gray text
 * - Overflow protection: red notification + copy blocked when exceeding 250 chars
 * - Copy-to-clipboard and URL sharing functionality
 * - Sticky positioning so output is always visible while adjusting filters
 *
 * Health bar thresholds (from limits.ts):
 * - Green: 0-200 characters
 * - Yellow: 201-240 characters
 * - Red: 241-250 characters (approaching limit)
 * - Red + pulse: >250 characters (OVERFLOW — copy blocked)
 */
import React, { useState, useCallback } from 'react';
import { MAX_CHARS } from '@shared/constants';
import { getShareableUrl, type SerializableStore } from '@store/url-sync';

interface RegexOutputProps {
  regex: string;
  isOverflow: boolean;
  /** Optional filter store reference for URL sharing */
  filterStore?: SerializableStore | null;
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
    barBg: 'bg-emerald-900/40',
    text: 'text-emerald-400',
    label: 'Норма',
  },
  yellow: {
    bar: 'bg-yellow-500',
    barBg: 'bg-yellow-900/40',
    text: 'text-yellow-400',
    label: 'Много',
  },
  red: {
    bar: 'bg-red-500',
    barBg: 'bg-red-900/40',
    text: 'text-red-400',
    label: 'Критично',
  },
} as const;

export const RegexOutput: React.FC<RegexOutputProps> = ({ regex, isOverflow, filterStore }) => {
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!regex || isOverflow) return;
    try {
      await navigator.clipboard.writeText(regex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [regex, isOverflow]);

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
    <div className="regex-output sticky top-0 z-10 -mx-1 px-1 py-1 -mt-1 pt-1"
      style={{ background: 'var(--poe-bg, #0f0f1a)' }}
    >
      {/* Header row: title + buttons */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Регулярное выражение</h3>
        <div className="flex items-center gap-2">
          {/* Share button */}
          {filterStore && regex && (
            <button
              onClick={handleShare}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                shareCopied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
              title="Скопировать ссылку для обмена"
            >
              {shareCopied ? 'Ссылка скопирована!' : 'Поделиться'}
            </button>
          )}
          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!regex || isOverflow}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : isOverflow || !regex
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {copied ? 'Скопировано!' : 'Копировать'}
          </button>
        </div>
      </div>

      {/* Character Health Bar — visual green/yellow/red indicator */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-medium ${isOverflow ? 'text-red-400 animate-pulse' : healthConfig.text}`}>
            {isOverflow ? 'ПЕРЕПОЛНЕНИЕ!' : healthConfig.label}
          </span>
          <span className={`text-xs font-mono ${healthConfig.text}`}>
            {charCount}/{MAX_CHARS}
          </span>
        </div>
        <div className={`h-2 rounded-full overflow-hidden ${healthConfig.barBg}`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              isOverflow ? 'bg-red-500 animate-pulse' : healthConfig.bar
            }`}
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>

      {/* Overflow warning */}
      {isOverflow && (
        <div className="mb-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
          Строка превышает лимит 250 символов. Поиск не сработает!
        </div>
      )}

      {/* Regex display area */}
      <div
        className={`p-3 rounded font-mono text-sm break-all min-h-[60px] ${
          isOverflow
            ? 'bg-red-950/50 border border-red-800 text-red-300'
            : regex
              ? 'bg-gray-800 border border-gray-600 text-green-300'
              : 'bg-gray-900 border border-gray-700 text-gray-500'
        }`}
      >
        {regex || 'Выберите моды для генерации регулярного выражения'}
      </div>
    </div>
  );
};
