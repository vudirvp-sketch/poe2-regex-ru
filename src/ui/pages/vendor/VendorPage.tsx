/**
 * VendorPage — Vendor regex filter for the Russian game client.
 *
 * Layout v2 (iteration 4): Control panel (regex + mode + round10) sticky at top,
 * property chips in flex-wrap groups below, verification note at the bottom.
 *
 * The hardcoded Russian regex strings in VENDOR_PROPERTIES are OK —
 * vendor properties are NOT mod-based and don't come from ETL data.
 * The plan's invariant I4 targets mod strings from ETL, not vendor labels.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RegexOutput } from '@ui/components/RegexOutput';
import { VendorChip } from '@ui/components/VendorChip';
import { t } from '@shared/i18n';
import { MAX_CHARS } from '@shared/constants';
import { and, or, literal, exclude, range } from '@core/ast';
import { compile } from '@core/compiler';
import type { ASTNode } from '@shared/types';
import { createFilterStore } from '@store/filter-store';
import { syncFromUrl } from '@store/url-sync';

// ─── Vendor property definitions with Russian regex strings ───

interface VendorProperty {
  id: string;
  label: string;
  /** The regex string that matches this property in the RU game client */
  regex: string;
  /** Which group this property belongs to (for grouping in the UI) */
  group: string;
  /** Optional: requires a numeric input for threshold filtering */
  hasNumericInput?: boolean;
  /** Optional: for numeric inputs, the suffix to append after number regex */
  numericSuffix?: string;
}

/**
 * Russian vendor property regex strings.
 *
 * These are derived from the known Russian translations of item properties
 * in Path of Exile 2. Each regex is the shortest unique substring that
 * matches the corresponding property text in the RU client.
 *
 * Property text examples (RU client):
 *   "Качество" → regex: "качеств"
 *   "Гнёзда" → regex: "гнёзд"
 *   "Сопротивление огню" → regex: "огню"
 *   "Сопротивление холоду" → regex: "холоду"
 *   "Сопротивление молниям" → regex: "молни"
 *   "Сопротивление хаосу" → regex: "хаосу"
 *   "Физический урон" → regex: "физическ"
 *   "Урон от чар" → regex: "урон от чар"
 *   "Дух" → regex: "дух"
 *   "Скорость атаки" → regex: "скорость атаки"
 *   "Скорость сотворения" → regex: "сотворени"
 *   "Скорость передвижения" → regex: "передвижени"
 *   "Здоровье" → regex: "здоровь"
 *   "Мана" → regex: "ман"
 *   "Редкость предметов" → regex: "редкость"
 *   "Сила" → regex: "силе"
 *   "Ловкость" → regex: "ловкост"
 *   "Интеллект" → regex: "интеллект"
 */
const VENDOR_PROPERTIES: VendorProperty[] = [
  // ─── Item property ───
  { id: 'atr-quality', label: 'Качество', regex: 'качеств', group: 'Свойства предмета' },
  { id: 'atr-sockets', label: 'Гнёзда', regex: 'гнёзд', group: 'Свойства предмета' },

  // ─── Speed ───
  { id: 'mod-attack-speed', label: 'Скорость атаки', regex: 'скорость атаки', group: 'Скорость' },
  { id: 'mod-cast-speed', label: 'Скорость сотворения', regex: 'сотворени', group: 'Скорость' },

  // ─── Movement speed (with specific % thresholds) ───
  { id: '30ms', label: 'МС 30%', regex: '30)%.*передвижени', group: 'Скорость передвижения' },
  { id: '25ms', label: 'МС 25%', regex: '25)%.*передвижени', group: 'Скорость передвижения' },
  { id: '20ms', label: 'МС 20%', regex: '20)%.*передвижени', group: 'Скорость передвижения' },
  { id: '15ms', label: 'МС 15%', regex: '15)%.*передвижени', group: 'Скорость передвижения' },
  { id: '10ms', label: 'МС 10%', regex: '10)%.*передвижени', group: 'Скорость передвижения' },

  // ─── Resistances ───
  { id: 'res-fire', label: 'Сопр. огню', regex: 'огню', group: 'Сопротивления' },
  { id: 'res-cold', label: 'Сопр. холоду', regex: 'холоду', group: 'Сопротивления' },
  { id: 'res-lightning', label: 'Сопр. молниям', regex: 'молни', group: 'Сопротивления' },
  { id: 'res-chaos', label: 'Сопр. хаосу', regex: 'хаосу', group: 'Сопротивления' },

  // ─── Item modifiers ───
  { id: 'mod-physical', label: 'Физ. урон', regex: 'физическ', group: 'Модификаторы' },
  { id: 'mod-spellDamage', label: 'Урон от чар', regex: 'урон от чар', group: 'Модификаторы' },
  { id: 'mod-elemental', label: 'Стихийный урон', regex: 'стихийн', group: 'Модификаторы' },
  { id: 'mod-cold', label: 'Урон от холода', regex: 'урон от холода', group: 'Модификаторы' },
  { id: 'mod-fire', label: 'Урон от огня', regex: 'урон от огня', group: 'Модификаторы' },
  { id: 'mod-lightning', label: 'Урон от молний', regex: 'урон от молни', group: 'Модификаторы' },
  { id: 'mod-chaos', label: 'Урон хаосом', regex: 'урон хаосом', group: 'Модификаторы' },
  { id: 'mod-spirit', label: '+Дух', regex: 'дух', group: 'Модификаторы' },
  { id: 'mod-rarity', label: 'Редкость предм.', regex: 'редкость', group: 'Модификаторы' },
  { id: 'mod-max-life', label: 'Макс. здоровье', regex: 'здоровь', group: 'Модификаторы' },
  { id: 'mod-max-mana', label: 'Макс. мана', regex: 'ман', group: 'Модификаторы' },

  // ─── Item modifiers (skill) ───
  { id: 'mod-skill', label: '+Ур. умений (любых)', regex: 'уровень.*умени', group: 'Умения' },
  { id: 'mod-skill-minion', label: '+Ур. умений приспеш.', regex: 'приспешник.*умени', group: 'Умения' },
  { id: 'mod-skill-melee', label: '+Ур. умений ближ. боя', regex: 'ближнего боя.*умени', group: 'Умения' },
  { id: 'mod-skill-spell', label: '+Ур. умений чар', regex: 'чар.*умени', group: 'Умения' },
  { id: 'mod-skill-fire', label: '+Ур. огн. чар', regex: 'огнен.*чар', group: 'Умения' },
  { id: 'mod-skill-cold', label: '+Ур. лед. чар', regex: 'ледян.*чар', group: 'Умения' },
  { id: 'mod-skill-lightning', label: '+Ур. молн. чар', regex: 'молни.*чар', group: 'Умения' },
  { id: 'mod-skill-physical', label: '+Ур. физ. чар', regex: 'физическ.*чар', group: 'Умения' },
  { id: 'mod-skill-projectile', label: '+Ур. снарядов', regex: 'снаряд.*умени', group: 'Умения' },

  // ─── Item modifiers (attributes) ───
  { id: 'mod-str', label: 'Сила', regex: 'силе', group: 'Характеристики' },
  { id: 'mod-int', label: 'Интеллект', regex: 'интеллект', group: 'Характеристики' },
  { id: 'mod-dex', label: 'Ловкость', regex: 'ловкост', group: 'Характеристики' },

  // ─── Item level ───
  { id: 'atr-itemlevel', label: 'Ур. предмета ≥N', regex: '', group: 'Уровень',
    hasNumericInput: true, numericSuffix: 'уровень предмета' },
  { id: 'atr-charlevel', label: 'Треб. уровень ≥N', regex: '', group: 'Уровень',
    hasNumericInput: true, numericSuffix: 'требуемый уровень' },

  // ─── Item rarity ───
  { id: 'itemtype-rare', label: 'Редкий', regex: 'редк', group: 'Редкость предмета' },
  { id: 'itemtype-magic', label: 'Волшебный', regex: 'волшебн', group: 'Редкость предмета' },
  { id: 'itemtype-normal', label: 'Обычный', regex: 'обычн', group: 'Редкость предмета' },

  // ─── Item class — Jewellery ───
  { id: 'type-amulet', label: 'Амулеты', regex: 'амулет', group: 'Класс — Украшения' },
  { id: 'type-rings', label: 'Кольца', regex: 'кольц', group: 'Класс — Украшения' },
  { id: 'type-belts', label: 'Пояса', regex: 'пояс', group: 'Класс — Украшения' },

  // ─── Item class — 1H weapons ───
  { id: 'type-wands', label: 'Жезлы', regex: 'жезл', group: 'Класс — Оружие 1H' },
  { id: 'type-1h-maces', label: '1H Булавы', regex: 'одноручн.*булав', group: 'Класс — Оружие 1H' },
  { id: 'type-sceptres', label: 'Скипетры', regex: 'скипетр', group: 'Класс — Оружие 1H' },

  // ─── Item class — 2H weapons ───
  { id: 'type-bows', label: 'Луки', regex: 'лук', group: 'Класс — Оружие 2H' },
  { id: 'type-staves', label: 'Посохи', regex: 'посох', group: 'Класс — Оружие 2H' },
  { id: 'type-2h-maces', label: '2H Булавы', regex: 'двуручн.*булав', group: 'Класс — Оружие 2H' },
  { id: 'type-q-staves', label: 'Боевые посохи', regex: 'боевой посох', group: 'Класс — Оружие 2H' },
  { id: 'type-spears', label: 'Копья', regex: 'копь', group: 'Класс — Оружие 2H' },
  { id: 'type-crossbow', label: 'Арбалеты', regex: 'арбалет', group: 'Класс — Оружие 2H' },
  { id: 'type-talisman', label: 'Талисман', regex: 'талисман', group: 'Класс — Оружие 2H' },

  // ─── Item class — equipment ───
  { id: 'type-gloves', label: 'Перчатки', regex: 'перчатк', group: 'Класс — Экипировка' },
  { id: 'type-boots', label: 'Обувь', regex: 'обувь', group: 'Класс — Экипировка' },
  { id: 'type-body', label: 'Нагрудн. броня', regex: 'нагрудн', group: 'Класс — Экипировка' },
  { id: 'type-helm', label: 'Шлемы', regex: 'шлем', group: 'Класс — Экипировка' },

  // ─── Item class — offhand ───
  { id: 'type-quiver', label: 'Колчаны', regex: 'колчан', group: 'Класс — Оффхэнд' },
  { id: 'type-foci', label: 'Фокусы', regex: 'фокус', group: 'Класс — Оффхэнд' },
  { id: 'type-shields', label: 'Щиты', regex: 'щит', group: 'Класс — Оффхэнд' },
];

// ─── Group order for consistent display ───

const GROUP_ORDER = [
  'Свойства предмета',
  'Скорость',
  'Скорость передвижения',
  'Сопротивления',
  'Модификаторы',
  'Умения',
  'Характеристики',
  'Уровень',
  'Редкость предмета',
  'Класс — Украшения',
  'Класс — Оружие 1H',
  'Класс — Оружие 2H',
  'Класс — Экипировка',
  'Класс — Оффхэнд',
];

// ─── Group color config for visual differentiation ───

const GROUP_COLORS: Record<string, { header: string; border: string }> = {
  'Свойства предмета':    { header: 'text-gray-400',   border: 'border-l-gray-500' },
  'Скорость':             { header: 'text-yellow-400',  border: 'border-l-yellow-500' },
  'Скорость передвижения':{ header: 'text-yellow-400',  border: 'border-l-yellow-500' },
  'Сопротивления':        { header: 'text-blue-400',    border: 'border-l-blue-500' },
  'Модификаторы':         { header: 'text-red-400',     border: 'border-l-red-500' },
  'Умения':               { header: 'text-purple-400',  border: 'border-l-purple-500' },
  'Характеристики':       { header: 'text-green-400',   border: 'border-l-green-500' },
  'Уровень':              { header: 'text-cyan-400',    border: 'border-l-cyan-500' },
  'Редкость предмета':    { header: 'text-orange-400',  border: 'border-l-orange-500' },
  'Класс — Украшения':    { header: 'text-amber-400',   border: 'border-l-amber-500' },
  'Класс — Оружие 1H':   { header: 'text-red-400',     border: 'border-l-red-500' },
  'Класс — Оружие 2H':   { header: 'text-red-400',     border: 'border-l-red-500' },
  'Класс — Экипировка':  { header: 'text-sky-400',     border: 'border-l-sky-500' },
  'Класс — Оффхэнд':     { header: 'text-teal-400',    border: 'border-l-teal-500' },
};

export function VendorPage() {
  // Create a filter store for URL sharing
  const filterStore = useMemo(() => createFilterStore(), []);

  // Restore from URL on first render (synchronous, before any effects)
  const [urlRestored] = useState(() => syncFromUrl(filterStore.getState()));

  // Initialize vendor state from filter store (which may have URL data)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (urlRestored) {
      const extra = filterStore.getState().getExtraState('vendorSelectedIds');
      if (Array.isArray(extra)) return new Set(extra as string[]);
    }
    return new Set();
  });
  const [excludeMode, setExcludeMode] = useState(() => {
    if (urlRestored) {
      const extraMode = filterStore.getState().getExtraState('vendorExcludeMode');
      if (typeof extraMode === 'boolean') return extraMode;
    }
    return false;
  });
  const [numericInputs, setNumericInputs] = useState<Record<string, number>>(() => {
    if (urlRestored) {
      const extraNums = filterStore.getState().getExtraState('vendorNumericInputs');
      if (extraNums && typeof extraNums === 'object') return extraNums as Record<string, number>;
    }
    return {};
  });
  const [round10, setRound10] = useState(() => {
    if (urlRestored) {
      const extraR10 = filterStore.getState().getExtraState('vendorRound10');
      if (typeof extraR10 === 'boolean') return extraR10;
    }
    return true;
  });

  // Ref to skip the first sync-to-store cycle, preventing overwrite
  // of URL-restored extraState values before the restore effect has run.
  const syncReadyRef = useRef(false);

  // Sync vendor state to filter store for URL sharing.
  // Skips the first render to avoid overwriting URL-restored values.
  useEffect(() => {
    if (!syncReadyRef.current) {
      syncReadyRef.current = true;
      return;
    }
    filterStore.getState().setExtraState('vendorSelectedIds', [...selectedIds]);
    filterStore.getState().setExtraState('vendorExcludeMode', excludeMode);
    filterStore.getState().setExtraState('vendorNumericInputs', numericInputs);
    filterStore.getState().setExtraState('vendorRound10', round10);
  }, [selectedIds, excludeMode, numericInputs, round10, filterStore]);

  const toggleProperty = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear ghost numeric value when unchecking a numeric property
        setNumericInputs(prevNum => {
          const nextNum = { ...prevNum };
          delete nextNum[id];
          return nextNum;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setNumericValue = useCallback((id: string, value: number | null) => {
    setNumericInputs(prev => {
      const next = { ...prev };
      if (value === null) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
    setNumericInputs({});
    setExcludeMode(false);
  }, []);

  // Build regex using core AST + compiler (fixes 3-digit number bug,
  // ensures consistent quoting, correct AND/OR/EXCLUDE handling)
  const { regex, isRegexOverflow } = useMemo(() => {
    const selectedProps = VENDOR_PROPERTIES.filter(p => selectedIds.has(p.id));
    if (selectedProps.length === 0 && Object.keys(numericInputs).length === 0) {
      return { regex: '', isRegexOverflow: false };
    }

    const astNodes: ASTNode[] = [];
    const includeLiterals: ASTNode[] = [];
    const excludeLiterals: ASTNode[] = [];

    for (const prop of selectedProps) {
      if (prop.hasNumericInput) {
        const numValue = numericInputs[prop.id];
        if (numValue && numValue > 0 && prop.numericSuffix) {
          // Use core range() — generates correct number regex including 3-digit handling
          astNodes.push(range(numValue, undefined, prop.numericSuffix));
        }
        continue;
      }

      if (!prop.regex) continue;

      // Collect all non-numeric props and group them for efficiency
      // Using OR within one quoted group is more compact than separate quoted groups
      if (excludeMode) {
        excludeLiterals.push(literal(prop.regex));
      } else {
        includeLiterals.push(literal(prop.regex));
      }
    }

    // Also handle numeric-only properties that aren't in selectedIds
    for (const [id, value] of Object.entries(numericInputs)) {
      if (value <= 0) continue;
      const prop = VENDOR_PROPERTIES.find(p => p.id === id);
      if (prop?.hasNumericInput && !selectedIds.has(id) && prop.numericSuffix) {
        astNodes.push(range(value, undefined, prop.numericSuffix));
      }
    }

    // Add included properties as a single OR group (compact: "A|B|C")
    if (includeLiterals.length > 0) {
      if (includeLiterals.length === 1) {
        astNodes.push(includeLiterals[0]);
      } else {
        astNodes.push(or(...includeLiterals));
      }
    }

    // Add excluded properties as EXCLUDE(OR(...)) — compact: "!A|B|C"
    // Much more efficient than separate "!A" "!B" "!C" (saves 3+ chars per property)
    if (excludeLiterals.length > 0) {
      astNodes.push(exclude(or(...excludeLiterals)));
    }

    if (astNodes.length === 0) {
      return { regex: '', isRegexOverflow: false };
    }

    const ast = and(...astNodes);
    const result = compile(ast, { round10 });
    return { regex: result, isRegexOverflow: result.length > MAX_CHARS };
  }, [selectedIds, excludeMode, numericInputs, round10]);

  // Group properties for UI display (ordered by GROUP_ORDER)
  const groupedProperties = useMemo(() => {
    const groups = new Map<string, VendorProperty[]>();
    for (const prop of VENDOR_PROPERTIES) {
      const group = groups.get(prop.group) || [];
      group.push(prop);
      groups.set(prop.group, group);
    }
    // Sort groups by GROUP_ORDER
    const sorted = new Map<string, VendorProperty[]>();
    for (const groupName of GROUP_ORDER) {
      const props = groups.get(groupName);
      if (props) sorted.set(groupName, props);
    }
    // Add any groups not in GROUP_ORDER
    for (const [groupName, props] of groups) {
      if (!sorted.has(groupName)) sorted.set(groupName, props);
    }
    return sorted;
  }, []);

  const hasNumericSelected = Object.values(numericInputs).some(v => v > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--poe-gold)' }}>
          <img src={`${import.meta.env.BASE_URL}icons/vendor.png`} alt="" width={24} height={24} className="object-contain" />
          {t('vendor.title')}
        </h2>
        <span className="text-xs text-gray-500">
          {selectedIds.size} выбрано
        </span>
      </div>

      {/* Sticky top: Regex output + controls */}
      <div className="sticky top-0 z-10 -mx-1 px-1 -mt-1 pt-1 pb-3"
        style={{ background: 'var(--poe-bg, #0a0a0f)' }}
        role="toolbar"
        aria-label="Панель управления"
      >
        <RegexOutput regex={regex} isOverflow={isRegexOverflow} filterStore={filterStore.getState()} />

        {/* Controls row */}
        <div className="flex flex-wrap gap-2 items-center mt-2">
          {/* Mode toggle */}
          <div className="flex gap-1" role="radiogroup" aria-label={t('mode.want')}>
            <button
              onClick={() => setExcludeMode(false)}
              role="radio"
              aria-checked={!excludeMode}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                !excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {t('mode.want')}
            </button>
            <button
              onClick={() => setExcludeMode(true)}
              role="radio"
              aria-checked={excludeMode}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {t('mode.dont_want')}
            </button>
          </div>

          {/* Round10 toggle */}
          {hasNumericSelected && (
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={round10}
                onChange={(e) => setRound10(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-gray-700 border-gray-600 text-blue-500"
              />
              <span className="text-[10px] text-gray-400">{t('round10')}</span>
            </label>
          )}

          {/* Clear all */}
          {selectedIds.size > 0 && (
            <button
              onClick={clearAll}
              className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-300 hover:bg-gray-600 transition-colors"
            >
              {t('filter.clear')} ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Chip-based property groups */}
      <div className="flex flex-col gap-3">
        {Array.from(groupedProperties.entries()).map(([groupName, props]) => {
          const colors = GROUP_COLORS[groupName] ?? { header: 'text-gray-400', border: 'border-l-gray-500' };
          return (
            <div key={groupName}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${colors.header}`}>
                ── {groupName} ({props.length}) ──
              </div>
              <div className="flex flex-wrap gap-1.5">
                {props.map(prop => (
                  <VendorChip
                    key={prop.id}
                    prop={prop}
                    isSelected={selectedIds.has(prop.id)}
                    numericValue={numericInputs[prop.id] ?? null}
                    onToggle={toggleProperty}
                    onNumericChange={setNumericValue}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification note */}
      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-3 text-xs text-yellow-400/80" role="alert">
        <strong>Требуется проверка:</strong> Regex строки для свойств торговца основаны на
        переводах русского клиента и ещё не проверены в игре. Если какая-то строка не работает,
        сообщите об этом для исправления.
      </div>
    </div>
  );
}
