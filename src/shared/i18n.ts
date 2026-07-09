import type { Locale } from './types';

const translations: Record<Locale, Record<string, string>> = {
  ru: {
    'waystone.title': 'Путевые камни',
    'relic.title': 'Реликвии',
    'jewel.title': 'Самоцветы',
    'vendor.title': 'Торговец',
    'belt.title': 'Пояса',
    'ring.title': 'Кольца',
    'amulet.title': 'Амулеты',
    'regex.title': 'Регулярное выражение',
    'regex.copy': 'Копировать',
    'regex.copied': 'Скопировано!',
    'regex.copy_error': 'Ошибка!',
    'regex.share': 'Поделиться',
    'regex.share_copied': 'Ссылка скопирована!',
    'regex.auto': 'Авто',
    'regex.overflow': 'ПЕРЕПОЛНЕНИЕ!',
    'regex.budget_warning': 'Осталось {chars} символов из 250 при {mods} аффиксах. Добавление новых условий может привести к переполнению!',
    'regex.overflow_detail': 'Строка превышает лимит 250 символов. Поиск не сработает!',
    'regex.part_label': 'Часть {n} из {total}',
    'regex.split_hint': 'Регулярка >250 символов — разбита на части. Копируйте каждую отдельно и ищите по очереди.',
    'regex.placeholder': 'Выберите аффиксы для генерации поисковой строки',
    // iter 167 (A3 Variant C): hint shown under the placeholder when regex
    // is empty — directs the user's attention back to the SelectedBasket /
    // ModList above. Pairs with the ↑ arrow icon rendered next to the
    // placeholder text.
    'regex.empty_hint': 'Выбор аффиксов выше построит строку здесь',
    'regex.copy_shortcut': 'Копировать (Ctrl+Shift+X)',
    'regex.share_title': 'Скопировать ссылку для обмена',
    'logic.label': 'Логика поиска',
    'logic.and': 'Все (И)',
    'logic.or': 'Любой (ИЛИ)',
    // iter 159: MIXED-mode toggle label. Combined AND+OR pattern:
    // MUST tokens (selectedIds) + OPT tokens (optionalIds) + !BAD (excludedIds).
    // Verified in-game iter 157 (KI#44 closed). Short label for the radio
    // button — full tooltip explains the semantics.
    'logic.mixed': 'Смешанный',
    // Tooltip / aria-description for the MIXED toggle button.
    // iter 181 (KI#56): updated to mention Ctrl+клик (added as alternative to
    // Shift+клик because Shift+клик triggers browser text selection) and the
    // new ⊕ button (mobile-friendly, no keyboard needed). Right-click stays
    // for EXCLUDE (also works on mobile as long-press).
    'logic.mixed_tooltip': 'Смешанный режим: обязательные аффиксы (И) + опциональные (ИЛИ). Клик по чипу — хочу, Ctrl+клик (или Shift+клик, или кнопка ⊕) — опционально, правый клик — исключить.',
    // iter 162: aria-label for the ⓘ icon next to the MIXED chip.
    // The ⓘ glyph opens a delayed tooltip (350ms hover) with the same
    // explanation as `logic.mixed_tooltip` — gives beginners a visible
    // cue that there's help available for the shift+click / right-click
    // gestures. Before iter 162, the gestures were hidden (only the
    // native `title` attribute on the chip showed the hint, which most
    // users never discovered).
    'logic.mixed_aria': 'Пояснение к смешанному режиму (Shift+клик и правый клик)',
    // iter 163: removed `logic.mixed_hint` (was an inline "Shift+клик" hint
    // in CategoryControlPanel). The always-visible ⓘ glyph next to the MIXED
    // chip (added iter 162) makes the inline hint redundant.
    'search.placeholder': 'Поиск аффиксов...',
    'filter.all_types': 'Все типы',
    'filter.all_origins': 'Все источники',
    'filter.clear': 'Очистить',
    'filter.no_results': 'Аффиксы не найдены',
    'filter.stats': 'Показано {shown} семейств из {total} аффиксов',
    'loading': 'Загрузка данных...',
    'load_error': 'Ошибка загрузки:',
    'no_data': 'Нет данных',
    'selected': 'выбрано',
    'mods_word': 'аффикс(ов)',
    'round10': 'Округлить до 10',
    'profile.label': 'Профиль',
    'profile.add': 'Добавить',
    'profile.delete': 'Удалить',
    'profile.rename': 'Переименовать',
    'profile.duplicate': 'Есть такое',
    'home.title': 'Генератор regex для PoE2',
    'home.subtitle': 'Выбирайте аффиксы — получайте готовую строку для вставки в игру',
    'home.description_full': 'Генератор поисковых строк для фильтра предметов Path of Exile 2. Автообновление с poe2db.tw, оптимизация под лимит 250 символов, сохранение фильтров в профилях и обмен ссылками.',
    'home.feature_data_title': 'Актуальные данные с poe2db',
    'home.feature_data_desc': 'Аффиксы и свойства автоматически загружаются с poe2db.tw — русские тексты, числовые диапазоны, склонения и формы слов. Данные всегда свежие.',
    'home.feature_optimize_title': 'Компактные regex',
    'home.feature_optimize_desc': 'Дедупликация, группировка семейств, ёфикация [её] и таблица оптимизаций — всё для максимально короткой строки в лимите 250 символов.',
    'home.feature_share_title': 'Профили и ссылки',
    'home.feature_share_desc': 'Сохраняйте фильтры в профили, делитесь настройками через сжатую ссылку. Копируйте строку прямо в поисковое окно игры одной кнопкой.',
    'home.nav_label': 'Главная',
    'home.footer': 'Данные с poe2db.tw · Не связано с Grinding Gear Games',
    'home.mods': 'аффиксов',
    'home.properties': 'свойств',
    'home.category_count': '8 категорий',
    'home.limit_250': 'Лимит 250 символов',
    'home.regex_optimization': 'Оптимизация regex',
    'home.seo_summary': 'Подробнее о регексах PoE2 — как пользоваться генератором, ёфикация, лимит 250 символов',
    'home.features_summary': 'Возможности генератора — актуальные данные, оптимизация regex, профили и ссылки',
    'health.green': 'Норма',
    'health.yellow': 'Много',
    'health.red': 'Критично',
    // iter 181: renamed 'Башни Предтеч' → 'Плитки Предтеч' per user feedback.
    // The category covers PoE2 "tablets" — flat tablet-like map modifiers
    // (Breach/Delirium/Ritual/Vaal/Expedition tablets), not "towers". The old
    // name «Башни» was a misleading translation; «Плитки» matches the actual
    // in-game item class semantics. NOTE: in-game individual item names like
    // «Башня Бездны Предтеч» (Breach Tablet) are NOT changed — those are
    // canonical PoE2 ru-client strings used in regex matching (see
    // tests/core/tablet-patterns.test.ts).
    'tablet.title': 'Плитки Предтеч',
    'chip.selected': 'выбрано',
    'chip.partial': 'частично выбрано',
    'chip.excluded': 'исключено',
    'chip.partial_excluded': 'частично исключено',
    'chip.unselected': 'не выбрано',
    // iter 159: OPT state labels for MIXED-mode 3-state chip.
    // 'optional' = full-optional (all members in optionalIds).
    // 'partial_optional' = some members in optionalIds.
    'chip.optional': 'опционально',
    'chip.partial_optional': 'частично опционально',
    'chip.levels': 'уровней',
    'chip.range': 'диапазон',
    'chip.dual_number': 'Двухчисловой аффикс',
    'chip.dual_number_tooltip': 'Аффикс содержит два числа (например "От X до Y"). Фильтр применяется к первому числу.',
    'chip.optimizer_collapsed': 'Оптимизатор: regex этого аффикса уже включён в общее выражение',
    'chip.exclude_tooltip': 'Исключить этот аффикс (не хочу)',
    'chip.unexclude_tooltip': 'Убрать из исключения',
    'chip.exclude_aria': 'Исключить аффикс',
    'chip.unexclude_aria': 'Убрать аффикс из исключения',
    // iter 181 (KI#56): OPT toggle button (⊕ / ⊖) on FilterChip.
    // Rendered ONLY in MIXED mode (mobile-friendly alternative to
    // shift+click / ctrl+click). Title + aria-label for the ⊕ button.
    'chip.opt_tooltip': 'Сделать аффикс опциональным (хотя бы 1 из группы)',
    'chip.unopt_tooltip': 'Убрать из опциональных',
    'chip.opt_aria': 'Сделать семейство опциональным',
    'chip.unopt_aria': 'Убрать семейство из опциональных',
    'vendor.verification': 'Требуется проверка: Regex строки для свойств торговца основаны на переводах русского клиента и ещё не проверены в игре. Если какая-то строка не работает, сообщите об этом для исправления.',
    'affix.prefix': 'Префикс',
    'affix.suffix': 'Суффикс',
    'affix.implicit': 'Имплисет',
    'origin.normal': 'Обычные',
    'origin.desecrated': 'Очернённые',
    'origin.corrupted': 'Осквернённые',
    'origin.essence': 'Сущность',
    'origin.breachborn': 'Разлом',
    'summary.selected': 'Выбрано',
    'summary.include': 'Включить',
    // iter 161: noun for the optional-affix counter in MIXED mode.
    // Displayed lowercase after the count: «N опц.»
    'summary.optional': 'Опц.',
    'summary.exclude': 'Исключить',
    'control.panel': 'Панель управления',
    'suffixes.label': 'суффиксы',
    'range.min': 'Мин',
    'range.max': 'Макс',
    'range.min_aria': 'Минимальное значение',
    'range.max_aria': 'Максимальное значение',
    'range.min_aria_dual_1': 'Минимальное значение первого числа',
    'range.max_aria_dual_1': 'Максимальное значение первого числа',
    'range.min_aria_dual_2': 'Минимальное значение второго числа',
    'range.max_aria_dual_2': 'Максимальное значение второго числа',
    'range.boundary_warning': 'Внимание: фильтр ≥40 может давать ложные срабатывания на однозначных числах в других аффиксах. Это ограничение поискового движка PoE2.',

    // TabletPage extraControls labels
    'tablet.type_label': 'Тип:',
    'tablet.rarity_label': 'Редкость:',
    'tablet.uses_label': 'Исп.:',
    'tablet.summary_types': '+ типы:',
    'tablet.summary_rarity': '+ редкость:',
    'tablet.summary_uses': '+ ≥{n} использ.',

    // WaystonePage checkbox labels
    'waystone.corrupted_label': 'Осквернён',
    'waystone.uncorrupted_label': 'Неосквернён',
    'waystone.delirious_label': 'Делириум',
    'waystone.summary_corrupted': '+ оскверн.',
    'waystone.summary_uncorrupted': '+ неоскверн.',
    'waystone.summary_delirious': '+ делириум',

    // JewelPage type filter
    'jewel.type_all': 'Все',
    'jewel.type_ruby': 'Рубин',
    'jewel.type_emerald': 'Изумруд',
    'jewel.type_sapphire': 'Сапфир',
    'jewel.type_label': 'Тип самоцвета:',
    'jewel.hidden_mods': '{n} скрытых аффиксов влияют на regex, но не видны',
    'jewel.deselect_hidden': 'Снять скрытые',

    // Range warnings
    'range.round10_and_warning': 'Округление расширяет диапазон при И-фальбэке (>50 значений)',
    'range.notation_fp_warning': 'Числа в диапазоне предмета (напр. 27 из «27-50») могут давать ложные совпадения',

    // Threshold mode
    'threshold.label': '≥Мин',
    'threshold.tooltip': 'Пороговый режим: RANGE(min,max) компилируется как ≥min только. Короче regex, без FP от диапазонной нотации, но без ограничения максимума.',

    // Within-block sort mode (iter 106 P4: alpha vs tier-first toggle)
    'sort.label': 'Сортировка:',
    'sort.alpha': 'По алфавиту',
    'sort.tier_first': 'По приоритету',
    // iter 148 (toolbar refactor): short label without trailing colon for
    // compact <select> variant. Used as aria-label on the select trigger.
    'sort.label_short': 'Сортировка',

    // Navigation
    'nav.categories': 'Категории',
    'nav.feedback': 'Баги и идеи → Discord: woonderdad',
    // iter 173: GitHub repository link, rendered in TopNav feedback area
    // next to the Discord hint. The ` ↗` arrow glyph is appended in JSX
    // (TopNav.tsx) — kept out of the i18n string so it can be swapped
    // (e.g. to an SVG icon) without touching translations.
    'nav.github': 'GitHub',

    // Phase 2 (iter 133): collapsible affix groups + sticky search
    'group.expand_all': 'Развернуть все',
    'group.collapse_all': 'Свернуть все',
    'group.collapse_btn_label': 'Свернуть группу',
    'group.expand_btn_label': 'Развернуть группу',

    // iter 170 (A4): L3-specific labels for the expand/collapse-all buttons.
    // Used when the page wires `onExpandAllSubGroups` / `onCollapseAllSubGroups`
    // (sub-group mode). The generic 'Развернуть все' / 'Свернуть все' labels
    // remain for legacy callers with only `onExpandAllGroups` (top-level L1).
    // Conditional rendering per A4 spec: expand-all-subgroups visible only when
    // ≥1 L3 collapsed; collapse-all-subgroups visible only when ≥1 L3 expanded.
    'group.expand_all_subgroups': 'Развернуть все подкатегории',
    'group.collapse_all_subgroups': 'Свернуть все подкатегории',

    // Phase 2.5 (iter 134): per-sub-group chip expander «+N ещё» / «свернуть».
    // {n} = number of chips hidden beyond the preview window (always ≥ 1).
    'chip.more': '+{n} ещё',
    // ARIA label for the «+N ещё» button — explicitly states the action verb
    // (Развернуть) + count + noun so screen reader users hear intent, not just
    // a bare «+10 ещё».
    'chip.more_aria': 'Развернуть оставшиеся {n} аффиксов',
    // Visible label for the «свернуть» button (shown when sub-group is expanded
    // via chipExpandState). Mirrors Phase 2 group.collapse_btn_label wording
    // but at chip-section granularity.
    'chip.collapse': 'свернуть',
    // ARIA label for the «свернуть» button — mirrors chip.more_aria pattern.
    'chip.collapse_aria': 'Свернуть оставшиеся аффиксы',

    // Phase 3 (iter 135): «Все / Мои» toggle in CategoryControlPanel
    // + SelectedBasket component in right aside.
    // iter 181 (KI#55): label renamed «Выбранные ({n})» → «Мои ({n})» — the
    // toggle filter keeps family groups that have at least one selected OR
    // excluded OR pinned (and optional in MIXED mode) member, so «Мои» is a
    // more honest description than «Выбранные» (which implied want-only).
    // {n} = totalVisibleCount (selected + excluded + optional + pinned family
    // groups). When 0 → button is disabled.
    'filter.show_all': 'Все',
    'filter.show_selected': 'Мои ({n})',
    // ARIA label for the show-selected-only radio group.
    'filter.show_mode_label': 'Режим отображения аффиксов',
    // iter 148 (toolbar refactor): short label for compact <select> variant.
    // Replaces the long «Режим отображения аффиксов» in the toolbar to
    // reduce visual noise. Used as aria-label on the select trigger.
    'filter.show_mode_label_short': 'Показывать',
    // SelectedBasket header: «Выбрано: N аффиксов»
    'basket.title': 'Выбрано: {n}',
    // SelectedBasket header noun suffix
    'basket.title_suffix': 'афф.',
    // iter 161: section headers for excluded and optional affixes.
    // Shown as small italic labels above the chip list when those sets
    // are non-empty. Lowercase to match the existing «Выбрано: N афф.» style.
    'basket.excluded_header': 'Исключено:',
    'basket.optional_header': 'Опционально (≥1 из группы):',
    // SelectedBasket empty state — shown when selectedIds is empty.
    'basket.empty': 'Выберите аффиксы',
    // SelectedBasket «Очистить все» link → calls clearSelections().
    'basket.clear': 'Очистить все',
    // SelectedBasket ARIA label for clear-all button.
    'basket.clear_aria': 'Очистить все выбранные аффиксы',
    // SelectedBasket «+N ещё» expander when selectedIds > SELECTED_BASKET_CAP.
    // {n} = number of chips hidden beyond the cap (always ≥ 1).
    'basket.more': '+{n} ещё',
    // SelectedBasket ARIA label for the «+N ещё» expander.
    'basket.more_aria': 'Развернуть оставшиеся {n} выбранных аффиксов',
    // SelectedBasket «свернуть» button after expansion.
    'basket.collapse': 'свернуть',
    // SelectedBasket ARIA label for the «свернуть» button.
    'basket.collapse_aria': 'Свернуть оставшиеся выбранные аффиксы',
    // SelectedBasket ARIA label for clicking a basket chip to deselect.
    // Appended after the chip's displayText in the aria-label string.
    'basket.unselect_aria': 'Снять выделение',
    // iter 161: ARIA label appended after displayText for excluded chips.
    'basket.unexclude_aria': 'Убрать из исключения',
    // iter 161: ARIA label appended after displayText for optional chips.
    'basket.unoptional_aria': 'Убрать из опциональных',
    // Affix-type badge labels prefixed to each basket chip (iter 130 visualization).
    'basket.badge_implicit': 'ИМПЛ',
    'basket.badge_prefix': 'ПРЕФ',
    'basket.badge_suffix': 'СУФ',
    // Right aside collapse toggle (chevron in header) — iter 131 §13.7 #2.
    'basket.collapse_panel': 'Свернуть панель',
    'basket.expand_panel': 'Развернуть панель',
    // iter 167 (A3 Variant C): aria-label for the visual connector between
    // SelectedBasket and RegexOutput. Rendered as a thin gold-gradient line
    // + ↓ arrow when the basket has at least one chip. Communicates the
    // «selection → result» flow to screen reader users.
    'basket.to_regex_flow_aria': 'Выбранные аффиксы передаются в регулярное выражение ниже',

    // Phase 5 (iter 136): Favorites i18n keys.
    // Keys kept for backward compat / future favorites UI.
    // {n} = number of pinned family groups (pinnedIds.size after grouping).
    'favorites.title': '⭐ Избранные: {n}',
    // Empty state — shown when pinnedIds is empty.
    'favorites.empty': 'Нажмите ★ на аффиксе, чтобы добавить в избранное',
    // «Очистить» link in favorites header → calls clearPinned().
    'favorites.clear': 'Очистить',
    // ARIA label for the «Очистить» button.
    'favorites.clear_aria': 'Очистить все избранные аффиксы',
    // ARIA label appended after chip's displayText for the ✗ (unpin) button.
    'favorites.unpin_aria': 'Убрать из избранного',
    // ARIA label for click-to-scroll on the chip body (label area).
    // Appended after the chip's displayText.
    'favorites.scroll_aria': 'Перейти к аффиксу в списке',

    // Phase 5 (iter 136): ⭐ pin/unpin icon button on FilterChip.
    // Title + aria-label text for the ⭐ icon button (left of label).
    // Visual: ⭐ filled (text-accent-amber-soft) when family is pinned;
    // ⭐ outline (text-muted) when not pinned.
    'chip.pin_tooltip': 'Добавить в избранное',
    'chip.unpin_tooltip': 'Убрать из избранного',
    'chip.pin_aria': 'Добавить семейство в избранное',
    'chip.unpin_aria': 'Убрать семейство из избранного',

    // Phase 4 (iter 137): Tooltips for affix column headers (ⓘ glyph).
    // Shown via the new Tooltip component when the user hovers/focuses the
    // ⓘ icon next to the top-level affix column header (ИМПЛИСЕТ/ПРЕФИКС/СУФФИКС).
    // Gives beginners a one-sentence explanation of what each affix type means
    // + how many slots the item has for that type.
    'tooltip.prefix_explanation': 'Один из основных модификаторов предмета. Максимум 3 префикса.',
    'tooltip.suffix_explanation': 'Один из основных модификаторов предмета. Максимум 3 суффикса.',
    'tooltip.implicit_explanation': 'Встроенное свойство предмета, не занимает слот префикса/суффикса.',
    // ARIA label for the ⓘ info icon button on affix column headers.
    'tooltip.info_aria': 'Показать пояснение к типу аффикса',

    // Phase 4.5 (iter 137): «Обозначения» icon legend in right panel.
    // Static 3-row legend rendered below ProfilePanel in the right aside.
    // Companion to Phase 4 tooltips — gives beginners a permanent reference,
    // not just hover hints.
    //
    // iter 140 (KI#21): icon prefix REMOVED from these strings. The IconLegend
    // component renders the icon separately as `<span class="icon-legend__icon">`
    // (gold color, fixed width 1.2em). Previously the strings contained the
    // icon AS WELL, producing double icons: `★ ★ — в избранное`. Now the string
    // contains ONLY the description text.
    'legend.title': 'Обозначения',
    'legend.star': 'в избранное',
    'legend.exclude': 'исключить аффикс (не хочу)',
    'legend.info': 'наведите для подсказки',
    // iter 161: shift+click hint for MIXED mode. Rendered only when
    // searchLogic==='mixed' (IconLegend accepts optional `showMixedHint`).
    // iter 181 (KI#56): updated to mention Ctrl+клик + ⊕ button alternatives.
    'legend.opt_shift_click': 'Ctrl/Shift+клик по чипу (или кнопка ⊕) — опционально (хотя бы 1)',
    // iter 140 (KI#25): tooltip text for show-selected-only radio toggle.
    // User asked: «кнопка режим отображения аффиксов и сама функция для чего
    // собственно?». Tooltip explains what the toggle does.
    'filter.show_mode_hint': 'Показывать все аффиксы или только выбранные, исключённые и избранные',
    // iter 140 (KI#24): FavoritesIndicator labels.
    // Compact `★ N` badge in page header showing pinned affix count.
    'favorites.indicator_label': 'Избранные аффиксы: {n}',
    'favorites.indicator_empty': 'Избранные: 0',
    // iter 144 (KI#31 variant d): quick-select panel — opened by clicking
    // the ★ N badge in the page header. Panel lists favorited families with
    // quick-select + range input + remove actions.
    // Title shown at the top of the panel.
    'favorites.panel_title': '⭐ Избранные аффиксы',
    // Empty state — shown when panel is open but pinnedIds is empty.
    // (User can still open the panel via the badge if it's already visible
    // — but typically the badge is hidden when empty, so this is a fallback.)
    'favorites.panel_empty': 'Нажмите ★ на аффиксе, чтобы добавить в избранное',
    // «Выбрать» button — adds all family member IDs to selectedIds.
    'favorites.panel_select': 'Выбрать',
    // «Убрать» button — removes family from favorites (toggles pinned off).
    'favorites.panel_remove': 'Убрать',
    // ARIA label for the «Убрать» button — appended after displayText.
    'favorites.panel_remove_aria': 'Убрать {name} из избранного',
    // Range input labels (for favorited families with ## placeholder).
    'favorites.panel_range_min': 'от',
    'favorites.panel_range_max': 'до',
    // ARIA label for the panel close (×) button.
    'favorites.panel_close_aria': 'Закрыть панель избранных аффиксов',
    // ARIA label for the ★ N badge button — opens the quick-select panel.
    'favorites.indicator_open_aria': 'Открыть панель избранных аффиксов ({n})',

    // ─── Timeless Jewel page (iter 176) ───────────────────────────────
    // Atlas-tree search regex generator for the 2 special jewels that
    // replace atlas passives: Вечная ненависть + Трагедия героев.
    // iter 178: title renamed 'Особые самоцветы' → 'Вневременные самоцветы'
    // (matches the in-game item class name for these jewels).
    'timeless_jewel.title': 'Вневременные самоцветы',
    'timeless_jewel.subtitle': 'Подсветка нод древа атласа',
    'timeless_jewel.selector_label': 'Самоцвет:',
    'timeless_jewel.undying_hate': 'Вечная ненависть',
    'timeless_jewel.heroic_tragedy': 'Трагедия героев',
    'timeless_jewel.nodes_word': 'нод',
    'timeless_jewel.search_placeholder': 'Поиск нод по названию или эффекту…',
    'timeless_jewel.select_all': 'Все',
    'timeless_jewel.clear_all': 'Сброс',
    'timeless_jewel.list_aria': 'Список нод древа атласа',
    'timeless_jewel.no_results': 'Ноды не найдены',
    'timeless_jewel.atlas_semantics_title': 'Atlas-семантика',
    'timeless_jewel.atlas_semantics_notice':
      'На древе атласа работают только OR-паттерны (подсветить любое из названий). AND и НЕ не поддерживаются — поэтому выбраны только имена нод, без их эффектов.',
  },
};

export function t(key: string, locale: Locale = 'ru'): string {
  return translations[locale]?.[key] ?? key;
}
