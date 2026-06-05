/**
 * VendorPage — Vendor regex filter for the Russian game client.
 *
 * Based on poe2.re/vendor but with Russian regex strings that match
 * the Russian game client text. The vendor page filters items by
 * properties visible at the vendor (quality, sockets, resistances, etc.)
 *
 * Regex compilation uses the core AST + compiler to ensure:
 * - Correct quoting (each term wrapped in "...")
 * - Correct AND/OR combination
 * - Correct negation (! inside quotes when combined with |)
 * - Proper number regex via generateNumberRegex (handles 3-digit, round10)
 * - Consistent with the rest of the application
 *
 * The hardcoded Russian regex strings in VENDOR_PROPERTIES are OK —
 * vendor properties are NOT mod-based and don't come from ETL data.
 * The plan's invariant I4 targets mod strings from ETL, not vendor labels.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RegexOutput } from '@ui/components/RegexOutput';
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
  /** Which AND group this property belongs to (for grouping in the UI) */
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
  { id: '30ms', label: 'Скорость передвижения (30%)', regex: '30)%.*передвижени', group: 'Скорость передвижения' },
  { id: '25ms', label: 'Скорость передвижения (25%)', regex: '25)%.*передвижени', group: 'Скорость передвижения' },
  { id: '20ms', label: 'Скорость передвижения (20%)', regex: '20)%.*передвижени', group: 'Скорость передвижения' },
  { id: '15ms', label: 'Скорость передвижения (15%)', regex: '15)%.*передвижени', group: 'Скорость передвижения' },
  { id: '10ms', label: 'Скорость передвижения (10%)', regex: '10)%.*передвижени', group: 'Скорость передвижения' },

  // ─── Resistances ───
  { id: 'res-fire', label: 'Сопротивление огню', regex: 'огню', group: 'Сопротивления' },
  { id: 'res-cold', label: 'Сопротивление холоду', regex: 'холоду', group: 'Сопротивления' },
  { id: 'res-lightning', label: 'Сопротивление молниям', regex: 'молни', group: 'Сопротивления' },
  { id: 'res-chaos', label: 'Сопротивление хаосу', regex: 'хаосу', group: 'Сопротивления' },

  // ─── Item modifiers ───
  { id: 'mod-physical', label: 'Физический урон', regex: 'физическ', group: 'Модификаторы предмета' },
  { id: 'mod-spellDamage', label: 'Урон от чар', regex: 'урон от чар', group: 'Модификаторы предмета' },
  { id: 'mod-elemental', label: 'Стихийный урон', regex: 'стихийн', group: 'Модификаторы предмета' },
  { id: 'mod-cold', label: 'Урон от холода', regex: 'урон от холода', group: 'Модификаторы предмета' },
  { id: 'mod-fire', label: 'Урон от огня', regex: 'урон от огня', group: 'Модификаторы предмета' },
  { id: 'mod-lightning', label: 'Урон от молний', regex: 'урон от молни', group: 'Модификаторы предмета' },
  { id: 'mod-chaos', label: 'Урон хаосом', regex: 'урон хаосом', group: 'Модификаторы предмета' },
  { id: 'mod-spirit', label: '+Дух', regex: 'дух', group: 'Модификаторы предмета' },
  { id: 'mod-rarity', label: 'Редкость предметов', regex: 'редкость', group: 'Модификаторы предмета' },
  { id: 'mod-max-life', label: 'Максимум здоровья', regex: 'здоровь', group: 'Модификаторы предмета' },
  { id: 'mod-max-mana', label: 'Максимум маны', regex: 'ман', group: 'Модификаторы предмета' },

  // ─── Item modifiers (skill) ───
  { id: 'mod-skill', label: '+Уровень умений (любых)', regex: 'уровень.*умени', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-minion', label: '+Уровень умений приспешников', regex: 'приспешник.*умени', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-melee', label: '+Уровень умений ближнего боя', regex: 'ближнего боя.*умени', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-spell', label: '+Уровень умений чар', regex: 'чар.*умени', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-fire', label: '+Уровень огненных чар', regex: 'огнен.*чар', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-cold', label: '+Уровень ледяных чар', regex: 'ледян.*чар', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-lightning', label: '+Уровень молниевых чар', regex: 'молни.*чар', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-physical', label: '+Уровень физических чар', regex: 'физическ.*чар', group: 'Модификаторы (умения)' },
  { id: 'mod-skill-projectile', label: '+Уровень снарядов', regex: 'снаряд.*умени', group: 'Модификаторы (умения)' },

  // ─── Item modifiers (attributes) ───
  { id: 'mod-str', label: 'Сила', regex: 'силе', group: 'Характеристики' },
  { id: 'mod-int', label: 'Интеллект', regex: 'интеллект', group: 'Характеристики' },
  { id: 'mod-dex', label: 'Ловкость', regex: 'ловкост', group: 'Характеристики' },

  // ─── Item level ───
  { id: 'atr-itemlevel', label: 'Уровень предмета ≥N', regex: '', group: 'Уровень',
    hasNumericInput: true, numericSuffix: 'уровень предмета' },
  { id: 'atr-charlevel', label: 'Требуемый уровень ≥N', regex: '', group: 'Уровень',
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
  { id: 'type-1h-maces', label: 'Одноручные булавы', regex: 'одноручн.*булав', group: 'Класс — Оружие 1H' },
  { id: 'type-sceptres', label: 'Скипетры', regex: 'скипетр', group: 'Класс — Оружие 1H' },

  // ─── Item class — 2H weapons ───
  { id: 'type-bows', label: 'Луки', regex: 'лук', group: 'Класс — Оружие 2H' },
  { id: 'type-staves', label: 'Посохи', regex: 'посох', group: 'Класс — Оружие 2H' },
  { id: 'type-2h-maces', label: 'Двуручные булавы', regex: 'двуручн.*булав', group: 'Класс — Оружие 2H' },
  { id: 'type-q-staves', label: 'Боевые посохи', regex: 'боевой посох', group: 'Класс — Оружие 2H' },
  { id: 'type-spears', label: 'Копья', regex: 'копь', group: 'Класс — Оружие 2H' },
  { id: 'type-crossbow', label: 'Арбалеты', regex: 'арбалет', group: 'Класс — Оружие 2H' },
  { id: 'type-talisman', label: 'Талисман', regex: 'талисман', group: 'Класс — Оружие 2H' },

  // ─── Item class — equipment ───
  { id: 'type-gloves', label: 'Перчатки', regex: 'перчатк', group: 'Класс — Экипировка' },
  { id: 'type-boots', label: 'Обувь', regex: 'обувь', group: 'Класс — Экипировка' },
  { id: 'type-body', label: 'Нагрудная броня', regex: 'нагрудн', group: 'Класс — Экипировка' },
  { id: 'type-helm', label: 'Шлемы', regex: 'шлем', group: 'Класс — Экипировка' },

  // ─── Item class — offhand ───
  { id: 'type-quiver', label: 'Колчаны', regex: 'колчан', group: 'Класс — Оффхэнд' },
  { id: 'type-foci', label: 'Фокусы', regex: 'фокус', group: 'Класс — Оффхэнд' },
  { id: 'type-shields', label: 'Щиты', regex: 'щит', group: 'Класс — Оффхэнд' },
];

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

  // Group properties for UI display
  const groupedProperties = useMemo(() => {
    const groups = new Map<string, VendorProperty[]>();
    for (const prop of VENDOR_PROPERTIES) {
      const group = groups.get(prop.group) || [];
      group.push(prop);
      groups.set(prop.group, group);
    }
    return groups;
  }, []);

  const hasNumericSelected = Object.values(numericInputs).some(v => v > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
          {t('vendor.title')}
        </h2>
        <span className="text-xs text-gray-500">
          {selectedIds.size} выбрано
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from(groupedProperties.entries()).map(([groupName, props]) => (
              <div key={groupName}>
                <p className="text-xs font-medium text-gray-400/70 pb-2">{groupName}</p>
                {props.map(prop => (
                  <div key={prop.id} className="flex items-center space-x-2 p-2 pb-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selectedIds.has(prop.id)}
                      onClick={() => toggleProperty(prop.id)}
                      className={`peer shrink-0 rounded-sm border h-6 w-6 transition-colors ${
                        selectedIds.has(prop.id)
                          ? 'bg-slate-100 text-slate-900 border-slate-300'
                          : 'bg-gray-950 border-gray-600 hover:bg-gray-800'
                      }`}
                    >
                      {selectedIds.has(prop.id) && '✓'}
                    </button>
                    <label
                      className="text-sm font-light cursor-pointer font-medium leading-none text-gray-300"
                      onClick={() => toggleProperty(prop.id)}
                    >
                      {prop.label}
                    </label>
                    {prop.hasNumericInput && selectedIds.has(prop.id) && (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="≥N"
                        value={numericInputs[prop.id] ?? ''}
                        onChange={(e) => setNumericValue(prop.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Mode toggle */}
          <div className="bg-gray-900 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400 mb-2">Режим</div>
            <div className="flex gap-2">
              <button onClick={() => setExcludeMode(false)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${!excludeMode ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Хочу
              </button>
              <button onClick={() => setExcludeMode(true)}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${excludeMode ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                Не хочу
              </button>
            </div>
          </div>

          {/* Round10 toggle for numeric inputs */}
          {hasNumericSelected && (
            <div className="bg-gray-900 border border-gray-700 rounded p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={round10} onChange={(e) => setRound10(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500" />
                <span className="text-xs text-gray-300">{t('round10')}</span>
              </label>
            </div>
          )}

          {/* Clear all */}
          {selectedIds.size > 0 && (
            <button
              onClick={clearAll}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Очистить всё ({selectedIds.size})
            </button>
          )}

          <RegexOutput regex={regex} isOverflow={isRegexOverflow} filterStore={filterStore.getState()} />

          {/* Note about verification */}
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-3 text-xs text-yellow-400/80">
            <strong>⚠️ Требуется проверка:</strong> Regex строки для свойств торговца основаны на
            переводах русского клиента и ещё не проверены в игре. Если какая-то строка не работает,
            сообщите об этом для исправления.
          </div>
        </div>
      </div>
    </div>
  );
}
