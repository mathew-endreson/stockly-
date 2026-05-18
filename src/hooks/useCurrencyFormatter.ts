import { useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-DZ',
  fr: 'fr-DZ',
  ar: 'ar-DZ',
};

const DEFAULT_CURRENCY = 'DZD';

export const useCurrencyFormatter = () => {
  const { language } = useLanguage();
  const { user } = useAuth();

  const currency = user?.settings?.currency || DEFAULT_CURRENCY;
  const locale = LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE.en;
  const isDinar = currency === 'DZD';

  const formatter = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: isDinar ? 0 : 2,
    });
  }, [locale, currency, isDinar]);

  const formatCurrency = (value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    if (language === 'ar' && currency === 'DZD' && Math.abs(safeValue) < 1e-9) {
      return 'دج';
    }
    return formatter.format(safeValue);
  };

  return { currency, locale, formatCurrency };
};
