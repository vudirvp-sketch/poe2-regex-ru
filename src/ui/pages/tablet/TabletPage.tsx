import { t } from '@shared/i18n'

export function TabletPage() {
  return (
    <div>
      <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--poe-gold)' }}>
        {t('tablet.title')}
      </h2>
      <p style={{ color: 'var(--poe-text)' }}>
        Страница в разработке.
      </p>
    </div>
  )
}
