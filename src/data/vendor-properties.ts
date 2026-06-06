/**
 * Vendor property definitions with Russian regex strings.
 *
 * Extracted from VendorPage for shared access:
 * - VendorPage uses the array for chip rendering and regex compilation
 * - HomePage uses the count for the category card display
 *
 * These are derived from the known Russian translations of item properties
 * in Path of Exile 2. Each regex is the shortest unique substring that
 * matches the corresponding property text in the RU client.
 */

export interface VendorProperty {
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

export const VENDOR_PROPERTIES: VendorProperty[] = [
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
