// file: dashboard/src/components/LanguageSwitcher.tsx
// description: Two-state EN/中文 toggle. Compact button group, drops into the
//              sidebar footer or any layout corner.

import { Globe } from 'lucide-react';
import { useLocale, useT } from '@/lib/i18n';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, set_locale } = useLocale();
  const t = useT();

  const btn_base =
    'px-2 py-1 text-xs font-medium transition-colors rounded';
  const active = 'bg-primary text-primary-foreground';
  const inactive = 'text-muted-foreground hover:bg-muted';

  return (
    <div
      className="inline-flex items-center gap-1 rounded border bg-background p-1"
      title={t('common.language')}
      aria-label={t('common.language')}
    >
      {!compact && <Globe className="h-3.5 w-3.5 text-muted-foreground ml-1" />}
      <button
        type="button"
        className={`${btn_base} ${locale === 'en' ? active : inactive}`}
        onClick={() => set_locale('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={`${btn_base} ${locale === 'zh' ? active : inactive}`}
        onClick={() => set_locale('zh')}
      >
        中文
      </button>
    </div>
  );
}
