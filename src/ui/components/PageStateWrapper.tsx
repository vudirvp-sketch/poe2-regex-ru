/**
 * PageStateWrapper — Reusable loading/error/no-data state handler.
 *
 * Extracts the repeated pattern from 7+ category pages:
 *   if (loading) → spinner
 *   if (error) → error alert
 *   if (!data) → no-data message
 *   else → render children with data
 *
 * Usage:
 *   <PageStateWrapper loading={loading} error={error} data={data}>
 *     {(data) => <MyPageContent data={data} />}
 *   </PageStateWrapper>
 */
import React from 'react';
import { t } from '@shared/i18n';

interface PageStateWrapperProps<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  children: (data: T) => React.ReactNode;
}

export function PageStateWrapper<T>({ loading, error, data, children }: PageStateWrapperProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="text-muted">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mb-2" />
          <p className="text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4" role="alert">
        <div className="bg-section-red border border-danger rounded p-3 text-accent-red-soft text-sm">
          {t('load_error')} {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 text-dim" role="status">{t('no_data')}</div>;
  }

  return <>{children(data)}</>;
}
