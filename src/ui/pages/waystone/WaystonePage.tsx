import { t } from '@shared/i18n'

export function WaystonePage() {
  return (
    <div>
      <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
        {t('waystone.title')}
      </h2>
      <p style={{ color: 'var(--poe-text)' }}>
        Страница в разработке. Фильтры и генерация regex будут добавлены в следующих итерациях.
      </p>
    </div>
  )
}
