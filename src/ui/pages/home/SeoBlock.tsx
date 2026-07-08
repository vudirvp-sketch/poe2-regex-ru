/**
 * SEO-текстовый блок для главной страницы.
 *
 * iter 57 (UI Phase 5): обёрнут в `<details>` с `<summary>` — свёрнут по
 * умолчанию, чтобы не перегружать главную. Контент остаётся в DOM (Google
 * индексирует `<details>` даже в закрытом состоянии), но визуально скрыт до
 * клика. Доступность нативная: keyboard-focusable, Enter/Space toggles,
 * ARIA-роли назначаются браузером автоматически.
 *
 * iter 71: декоративный силуэт `hero-demon-blue.webp` на правом краю блока,
 * появляется только при раскрытии `<details>` (CSS `[open]` селектор
 * переключает opacity 0 → 0.10). lg+ only — на мобильных нет горизонтального
 * места для silhouette. `pointer-events-none` + `aria-hidden` — декорация
 * не влияет на доступность и клики.
 *
 * iter 122: широкий ландшафтный backdrops `seo-atmosphere.webp` (1600x900,
 * исходник faf.png 1672x941 — dark-fantasy арт: воительница + череп/демоническая
 * структура). Виден только при раскрытии `<details>`, lg+ only. Сидит ПОЗАДИ
 * `.home-seo-content` (z-index: 0 vs content z-index: 1), а `.home-seo-demon`
 * (правый край) рисуется поверх этого backdrop'а (DOM order: atmosphere → demon
 * → content). `mix-blend-screen` + `mask-image` (fade bottom 40%) — мягкое
 * атмосферное наложение, не отвлекает от чтения SEO-текста.
 *
 * iter 180: добавлены FAQ-секция (соответствует FAQPage JSON-LD в index.html)
 * и синонимы в основном тексте — «лут-фильтр», «поиск в тайнике», «аффиксы
 * и моды», «макросы для PoE2» (без визуального изменения — всё внутри `<details>`).
 *
 * Ключевые поисковые запросы: регексы poe2, регулярное выражение poe2,
 * фильтрация предметов poe2, поиск предметов poe2, поисковые строки poe2,
 * лут-фильтр poe2, аффиксы и моды, путь exile 2 regex
 */

import { t } from '@shared/i18n'

export function SeoBlock() {
  return (
    <details className="home-seo-details">
      <summary className="home-seo-summary">
        <span className="home-seo-summary-text">{t('home.seo_summary')}</span>
      </summary>

      {/* iter 122: wide landscape atmospheric backdrop. Visible only when
          <details> is open (see .home-seo-details[open] .home-seo-atmosphere
          rule in index.css). lg+ only — mobile doesn't have horizontal room
          and performance matters more on small screens. Sits behind the SEO
          text content (z-index: 0 vs content's z-index: 1). DOM order:
          atmosphere → demon → content, so the right-edge demon accent paints
          ON TOP of this wide backdrop. `mix-blend-screen` + bottom mask
          gradient (fade bottom 40%) keeps the artwork subtle and the text
          readable. */}
      <img
        src={`${import.meta.env.BASE_URL}atmosphere/seo-atmosphere.webp`}
        alt=""
        aria-hidden="true"
        className="home-seo-atmosphere pointer-events-none absolute inset-0 hidden h-full w-full object-cover lg:block"
      />

      {/* iter 71: decorative demon-blue silhouette, right side, lg+ only.
          Visible only when <details> is open (see .home-seo-details[open]
          .home-seo-demon rule in index.css). `mix-blend-screen` lets the
          dark-blue demon face "etch" onto the warm bg without darkening it.
          iter 122: now sits ON TOP of .home-seo-atmosphere (DOM order). */}
      <img
        src={`${import.meta.env.BASE_URL}atmosphere/hero-demon-blue.webp`}
        alt=""
        aria-hidden="true"
        className="home-seo-demon pointer-events-none absolute right-0 top-0 hidden h-full w-auto max-w-[280px] object-contain object-top mix-blend-screen lg:block"
      />

      <section className="home-seo-content space-y-8 text-[14px] leading-relaxed" style={{ color: 'var(--poe-text)', opacity: 0.75 }}>
        {/* Что такое регексы в PoE2 */}
        <div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            Регексы PoE2 — поисковые строки для фильтра предметов
          </h2>
          <p>
            В Path of Exile 2 поисковая строка поддерживает упрощённый синтаксис регулярных выражений (regex).
            С его помощью можно фильтровать предметы прямо в игре — например, отобрать путевые камни
            с нужными модификаторами, найти кольца с конкретными свойствами или настроить лут-фильтр
            для быстрого поиска в тайнике. Поиск работает с логикой И/ИЛИ, отрицанием через &laquo;!&raquo;,
            группировкой кавычками и символьными классами. Однако строка ограничена 250 символами,
            что требует аккуратной оптимизации.
          </p>
          <p className="mt-2">
            Этот сервис автоматически создаёт компактные поисковые строки для русского клиента PoE2,
            учитывая все особенности диалекта игры: ёфикацию (объединение &laquo;е&raquo; и &laquo;ё&raquo; в&nbsp;[её]),
            склонения, числовые диапазоны и лимит 250 символов. Подходит для трейдеров и крафтеров,
            которые ищут предметы с конкретными аффиксами и модами на poe2db.tw и в самой игре.
          </p>
        </div>

        {/* Как пользоваться */}
        <div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            Как искать предметы через фильтр PoE2
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              <strong>Выберите категорию предметов</strong> на главной странице: путевые камни, башни предтеч,
              реликвии, самоцветы, вневременные самоцветы, торговец, пояса, кольца или амулеты.
            </li>
            <li>
              <strong>Отметьте нужные аффиксы</strong> в списке — клик по чипу включает свойство в поиск.
              Используйте логику &laquo;Все (И)&raquo;, если нужно найти предмет со всеми выбранными свойствами,
              или &laquo;Любой (ИЛИ)&raquo;, если достаточно хотя бы одного.
            </li>
            <li>
              <strong>Укажите числовые диапазоны</strong> — для аффиксов с числовыми значениями (например,
              &laquo;+#% к сопротивлению&raquo;) задайте минимальное и/или максимальное значение.
            </li>
            <li>
              <strong>Исключите ненужные свойства</strong> — нажмите кнопку ✗ на чипе, чтобы исключить
              предметы с этим аффиксом из результатов поиска.
            </li>
            <li>
              <strong>Скопируйте результат</strong> — нажмите кнопку &laquo;Копировать&raquo; или используйте
              сочетание Ctrl+Shift+X и вставьте строку в поисковое окно игры.
            </li>
          </ol>
        </div>

        {/* Ёфикация и лимит 250 */}
        <div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            Ёфикация и лимит 250 символов
          </h2>
          <p>
            Русский текст аффиксов в PoE2 может содержать как букву &laquo;е&raquo;, так и &laquo;ё&raquo;.
            Генератор автоматически применяет ёфикацию — объединяет оба варианта в символьный класс [её],
            что сокращает длину поисковой строки и гарантирует совпадение независимо от написания в конкретном предмете.
            Это особенно важно при выборе 6 и более аффиксов, когда суммарная длина регулярного выражения
            приближается к лимиту 250 символов.
          </p>
          <p className="mt-2">
            Если строка превышает 250 символов, генератор показывает предупреждение &laquo;ПЕРЕПОЛНЕНИЕ&raquo;.
            В этом случае попробуйте уменьшить количество выбранных аффиксов, сузить числовые диапазоны
            или исключить наименее важные свойства. Оптимизатор автоматически сокращает regex через
            дедупликацию, группировку и усечение слов, но иногда лимит невозможно обойти без
            сокращения числа условий.
          </p>
        </div>

        {/* Какие типы предметов поддерживаются */}
        <div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            Фильтрация предметов PoE2 — какие категории доступны
          </h2>
          <p>
            Генератор работает со всеми основными категориями предметов Path of Exile 2
            в русском клиенте:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li><strong>Путевые камни</strong> — аффиксы карт, включая осквернённые и очернённые варианты</li>
            <li><strong>Башни предтеч</strong> — свойства плиток: ритуал, бездна, делириум, ваал, экспедиция</li>
            <li><strong>Реликвии</strong> — префиксы и суффиксы реликвий</li>
            <li><strong>Самоцветы</strong> — характеристики самоцветов (рубин, изумруд, сапфир), включая осквернённые и очернённые</li>
            <li><strong>Вневременные самоцветы</strong> — Вечная ненависть и Трагедия героев: подсветка 75 нод древа атласа</li>
            <li><strong>Торговец</strong> — фильтр товаров торговца по свойствам и ценам</li>
            <li><strong>Пояса</strong> — атакующие, защитные и универсальные свойства поясов</li>
            <li><strong>Кольца</strong> — аффиксы колец всех типов и источников</li>
            <li><strong>Амулеты</strong> — полное покрытие префиксов и суффиксов амулетов</li>
          </ul>
        </div>

        {/* iter 180: FAQ-секция. Соответствует FAQPage JSON-LD в index.html.
            Когда SeoBlock раскрыт, контент видим пользователем и краулером,
            что валидирует FAQ rich results для Yandex (Google deprecated
            FAQ rich results в 2023, но схема не вредит). */}
        <div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--poe-gold)' }}>
            Частые вопросы о регексах PoE2
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-1 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                Что такое regex в PoE2 и зачем он нужен?
              </h3>
              <p>
                Regex (регулярное выражение) в Path of Exile 2 — это поисковая строка с упрощённым синтаксисом
                для фильтрации предметов прямо в игре. С его помощью можно отобрать путевые камни с нужными
                модификаторами, найти кольца с конкретными свойствами или отфильтровать товары торговца.
                Строка ограничена 250 символами, поэтому требуется оптимизация.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                Как работает ёфикация в PoE2?
              </h3>
              <p>
                Русский текст аффиксов может содержать как букву &laquo;е&raquo;, так и &laquo;ё&raquo;.
                Генератор автоматически применяет ёфикацию — объединяет оба варианта в символьный класс [её],
                что сокращает длину поисковой строки и гарантирует совпадение независимо от написания
                в конкретном предмете. Это особенно важно при выборе 6 и более аффиксов.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                Почему мой regex длиннее 250 символов?
              </h3>
              <p>
                Поисковая строка PoE2 имеет жёсткий лимит 250 символов. Если выбранных аффиксов слишком много,
                генератор показывает предупреждение &laquo;ПЕРЕПОЛНЕНИЕ&raquo;. В этом случае попробуйте уменьшить
                количество выбранных аффиксов, сузить числовые диапазоны или исключить наименее важные свойства.
                Оптимизатор автоматически сокращает regex через дедупликацию, группировку и усечение слов,
                но иногда лимит невозможно обойти без сокращения числа условий.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                Как поделиться фильтром с друзьями?
              </h3>
              <p>
                Нажмите кнопку &laquo;Поделиться&raquo; рядом с готовым регексом. Ссылка закодирует все выбранные
                аффиксы, числовые диапазоны и исключения в hash-части URL. Скопируйте ссылку и отправьте —
                открыв её, получатель увидит ваш фильтр в точно таком же виде. Также можно сохранить набор
                аффиксов в профиле (localStorage) для повторного использования.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-[15px] font-semibold" style={{ color: 'var(--poe-gold)' }}>
                Чем отличаются режимы «Все (И)», «Любой (ИЛИ)» и «Смешанный»?
              </h3>
              <p>
                &laquo;Все (И)&raquo; — поиск найдёт только предметы, у которых есть ВСЕ выбранные аффиксы.
                &laquo;Любой (ИЛИ)&raquo; — достаточно хотя бы одного. &laquo;Смешанный&raquo; — комбинирует оба:
                обязательные аффиксы (И) + опциональные (хотя бы один из группы). Клик по чипу — обязательный,
                Shift+клик — опциональный, правый клик — исключить.
              </p>
            </div>
          </div>
        </div>
      </section>
    </details>
  )
}
