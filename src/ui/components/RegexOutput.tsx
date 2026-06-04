/**
 * RegexOutput — Displays the generated regex string with copy button.
 *
 * Shows the current regex with character count and overflow warning.
 * Supports copy-to-clipboard functionality.
 */
import React, { useState, useCallback } from 'react';
import { MAX_CHARS } from '@shared/constants';

interface RegexOutputProps {
  regex: string;
  isOverflow: boolean;
}

export const RegexOutput: React.FC<RegexOutputProps> = ({ regex, isOverflow }) => {
  const [copied, setCopied] = useState(false);

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

  const charCount = regex.length;
  const isNearLimit = charCount > MAX_CHARS * 0.8 && !isOverflow;

  return (
    <div className="regex-output">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Регулярное выражение</h3>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono ${
              isOverflow
                ? 'text-red-400'
                : isNearLimit
                  ? 'text-yellow-400'
                  : 'text-gray-400'
            }`}
          >
            {charCount}/{MAX_CHARS}
          </span>
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

      {isOverflow && (
        <div className="mb-2 p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
          ⚠ Превышен лимит символов! Уменьшите количество выбранных модов.
        </div>
      )}

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
