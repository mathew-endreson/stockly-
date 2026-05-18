import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Building2, Boxes, CheckCircle2, Globe, Loader2, Moon, ShoppingBag, Store, Sun } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { BusinessType } from '@/types';
import { BUSINESS_TYPE_OPTIONS } from '@/constants/businessTypes';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface BusinessTypeSelectionGateProps {
  isSubUser: boolean;
  parentName?: string;
  selectedBusinessType: BusinessType | null;
  onSelectBusinessType: (businessType: BusinessType) => void;
  onConfirmSelection: () => void;
  isSubmitting: boolean;
  error: string | null;
}

const iconByBusinessType: Record<BusinessType, React.ComponentType<{ className?: string }>> = {
  standard: Boxes,
  ecommerce: ShoppingBag,
  clothing_retail: Building2,
  supermarket: Store,
  wholesale_importer: Boxes
};

const businessTypeTranslationKeyByValue: Record<
  BusinessType,
  { labelKey: string; descriptionKey: string; arabicLabel: string; arabicDescription: string }
> = {
  standard: {
    labelKey: 'settings.businessTypeOptionStandardLabel',
    descriptionKey: 'settings.businessTypeOptionStandardDesc',
    arabicLabel: 'قياسي',
    arabicDescription:
      'مساحة عمل متوازنة تشمل المخزون والمبيعات والتحليلات والفواتير والملاحظات والمساعد والنسخ الاحتياطي.'
  },
  ecommerce: {
    labelKey: 'settings.businessTypeOptionEcommerceLabel',
    descriptionKey: 'settings.businessTypeOptionEcommerceDesc',
    arabicLabel: 'تجارة إلكترونية',
    arabicDescription: 'الأنسب للمتاجر الرقمية، وعمليات تجهيز الطلبات، وإدارة الطلبات عبر الإنترنت.'
  },
  clothing_retail: {
    labelKey: 'settings.businessTypeOptionClothingRetailLabel',
    descriptionKey: 'settings.businessTypeOptionClothingRetailDesc',
    arabicLabel: 'ملابس / تجزئة',
    arabicDescription:
      'مناسب للمتاجر العامة مع إدارة المتغيرات ونقطة البيع والتحكم بالمخزون داخل المتجر.'
  },
  supermarket: {
    labelKey: 'settings.businessTypeOptionSupermarketLabel',
    descriptionKey: 'settings.businessTypeOptionSupermarketDesc',
    arabicLabel: 'سوبرماركت',
    arabicDescription: 'مهيأ للمنتجات السريعة الحركة، والتزويد المتكرر، وإدارة مخزون الأرفف بكميات كبيرة.'
  },
  wholesale_importer: {
    labelKey: 'settings.businessTypeOptionWholesaleImporterLabel',
    descriptionKey: 'settings.businessTypeOptionWholesaleImporterDesc',
    arabicLabel: 'Wholesale / Importer',
    arabicDescription: 'Legacy wholesale/importer workspace kept for existing accounts.'
  }
};

const BusinessTypeSelectionGate: React.FC<BusinessTypeSelectionGateProps> = ({
  isSubUser,
  parentName,
  selectedBusinessType,
  onSelectBusinessType,
  onConfirmSelection,
  isSubmitting,
  error
}) => {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { isRTL, language, setLanguage } = useLanguage();
  const isArabic = language === 'ar';
  const withArabicFallback = (englishText: string, arabicText: string) =>
    isArabic ? arabicText : englishText;

  if (isSubUser) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className={cn(
          'h-screen overflow-y-hidden bg-[#F0F0F0] dark:bg-[#333333] p-4 lg:p-[28px] font-sans text-[#333333] dark:text-[#FCFCFC]',
          isRTL && 'text-right',
          '[&_[data-slot=card]]:bg-[#FCFCFC] dark:[&_[data-slot=card]]:bg-[#5E5E5E]'
        )}
      >
        <div className="mx-auto w-full max-w-[1366px] space-y-[20px]">
          <div className={cn('flex items-center gap-2', isRTL ? 'justify-start' : 'justify-end')}>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#333333] dark:text-[#FCFCFC]"
              onClick={toggleTheme}
              aria-label={t('settings.theme', 'Theme')}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-[#333333] dark:text-[#FCFCFC]"
                  aria-label={t('settings.language', 'Language')}
                >
                  <Globe className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                <DropdownMenuItem onClick={() => setLanguage('en')}>
                  <span className={language === 'en' ? 'font-bold' : ''}>{t('settings.english', 'English')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('ar')}>
                  <span className={language === 'ar' ? 'font-bold' : ''}>{t('settings.arabic', 'Arabic')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('fr')}>
                  <span className={language === 'fr' ? 'font-bold' : ''}>{t('settings.french', 'French')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center justify-center">
            <Card className="w-full max-w-2xl rounded-md border-[#D0D0D0] dark:border-[#6E6E6E] py-4 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#222222] dark:text-[#FCFCFC]">
                  <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                  {t(
                    'settings.businessTypeNotSelected',
                    withArabicFallback('Business Type Not Selected', 'لم يتم اختيار نوع النشاط')
                  )}
                </CardTitle>
                <CardDescription className="text-[#4B5563] dark:text-[#D5D5D5]">
                  {parentName
                    ? t(
                        'settings.businessTypeOwnerNeedsSelection',
                        withArabicFallback(
                          '{{name}} must choose a business type before this dashboard can be accessed.',
                          'يجب على {{name}} اختيار نوع النشاط قبل الوصول إلى لوحة التحكم.'
                        ),
                        { name: parentName }
                      )
                    : t(
                        'settings.businessTypeOwnerMissingSelection',
                        withArabicFallback(
                          'The account owner must choose a business type before this dashboard can be accessed.',
                          'يجب على مالك الحساب اختيار نوع النشاط قبل الوصول إلى لوحة التحكم.'
                        )
                      )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#4B5563] dark:text-[#D5D5D5]">
                  {t(
                    'settings.businessTypeMandatorySetup',
                    withArabicFallback(
                      'This setup step is mandatory and cannot be skipped.',
                      'هذه الخطوة إلزامية ولا يمكن تخطيها.'
                    )
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className={cn(
        'h-screen overflow-y-hidden bg-[#F0F0F0] dark:bg-[#333333] px-4 py-3 lg:px-8 lg:py-5 font-sans text-[#333333] dark:text-[#FCFCFC]',
        isRTL && 'text-right',
        '[&_[data-slot=card]]:bg-[#FCFCFC] dark:[&_[data-slot=card]]:bg-[#5E5E5E]'
      )}
    >
      <div className="mx-auto w-full max-w-[1180px] space-y-5">
        <div className={cn('flex items-center gap-1.5', isRTL ? 'justify-start' : 'justify-end')}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-[#3A3A3A] hover:bg-transparent hover:text-[#111111] dark:text-[#FCFCFC] dark:hover:bg-transparent"
            onClick={toggleTheme}
            aria-label={t('settings.theme', 'Theme')}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-[#3A3A3A] hover:bg-transparent hover:text-[#111111] dark:text-[#FCFCFC] dark:hover:bg-transparent"
                aria-label={t('settings.language', 'Language')}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
              <DropdownMenuItem onClick={() => setLanguage('en')}>
                <span className={language === 'en' ? 'font-bold' : ''}>{t('settings.english', 'English')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('ar')}>
                <span className={language === 'ar' ? 'font-bold' : ''}>{t('settings.arabic', 'Arabic')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('fr')}>
                <span className={language === 'fr' ? 'font-bold' : ''}>{t('settings.french', 'French')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-0.5">
          <h1 className="text-[40px] leading-[1.15] font-semibold tracking-tight text-[#222222] dark:text-[#FCFCFC]">
            {t(
              'settings.chooseBusinessTypeTitle',
              withArabicFallback('Choose Your Business Type', 'اختر نوع نشاطك')
            )}
          </h1>
          <p className="text-lg text-[#4B5563] dark:text-[#D5D5D5]">
            {t(
              'settings.chooseBusinessTypeDesc',
              withArabicFallback(
                'Select one option to continue. You cannot access the dashboard until this is completed.',
                'اختر خيارًا واحدًا للمتابعة. لا يمكنك دخول لوحة التحكم قبل إكمال هذه الخطوة.'
              )
            )}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {BUSINESS_TYPE_OPTIONS.map((option) => {
            const Icon = iconByBusinessType[option.value];
            const isSelected = selectedBusinessType === option.value;
            const translationKeys = businessTypeTranslationKeyByValue[option.value];
            const translatedLabel = t(
              translationKeys.labelKey,
              withArabicFallback(option.label, translationKeys.arabicLabel)
            );
            const translatedDescription = t(
              translationKeys.descriptionKey,
              withArabicFallback(option.description, translationKeys.arabicDescription)
            );

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'min-h-[178px] rounded-md border bg-[#FCFCFC] p-6 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors dark:bg-[#5E5E5E]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A1DF5]/40',
                  'disabled:cursor-not-allowed disabled:opacity-70',
                  isSelected
                    ? 'border-[#7283FB] ring-1 ring-[#7283FB]/35 dark:border-[#8EA0FF] dark:ring-[#8EA0FF]/35'
                    : 'border-[#D0D0D0] dark:border-[#6E6E6E] hover:border-[#7283FB] dark:hover:border-[#7283FB]'
                )}
                onClick={() => onSelectBusinessType(option.value)}
                disabled={isSubmitting}
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0A1DF5]/8 text-[#0A1DF5] dark:bg-[#0A1DF5]/20 dark:text-[#9EABFF]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-xl font-semibold text-[#222222] dark:text-[#FCFCFC]">{translatedLabel}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0A1DF5] dark:text-[#9EABFF]" aria-label="Selected" />
                  )}
                </div>
                <p className="text-base leading-8 text-[#3F3F46] dark:text-[#D5D5D5]">{translatedDescription}</p>
              </button>
            );
          })}
        </div>

        {error && (
          <Card className="rounded-md border-red-200 dark:border-red-900/40 bg-[#FCFCFC] dark:bg-[#5E5E5E] py-4">
            <CardContent className="pt-0 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
          </Card>
        )}

        <div className={cn('flex', isRTL ? 'justify-start' : 'justify-end')}>
          <Button
            size="lg"
            className="min-w-[240px] rounded-lg bg-[#0A1DF5] text-white hover:bg-[#0918D4]"
            onClick={onConfirmSelection}
            disabled={!selectedBusinessType || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className={cn('w-4 h-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                {t('common.saving', 'Saving...')}
              </>
            ) : (
              t(
                'settings.continueToDashboard',
                withArabicFallback('Continue to Dashboard', 'المتابعة إلى لوحة التحكم')
              )
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BusinessTypeSelectionGate;
