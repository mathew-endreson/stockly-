import { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Shirt,
  ShoppingCart,
  Globe,
  Pill,
  Paintbrush,
  Home,
  Gamepad2,
  BookOpen,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { nicheAPI } from '@/services/api';
import type { NicheType } from '@/types';
import { cn } from '@/lib/utils';

type QuestionOption = { value: string; labelKey: string; icon?: LucideIcon };

const Q_SHIPPING_OPTIONS: QuestionOption[] = [
  { value: 'shipping', labelKey: 'onboarding.qShippingDelivery' },
  { value: 'walkin',   labelKey: 'onboarding.qShippingWalkin'   },
  { value: 'both',     labelKey: 'onboarding.qShippingBoth'     },
];

const Q_UNITS_OPTIONS: QuestionOption[] = [
  { value: 'count',  labelKey: 'onboarding.qUnitCount' },
  { value: 'kg',     labelKey: 'onboarding.qUnitKg' },
  { value: 'litre',  labelKey: 'onboarding.qUnitLitre' },
  { value: 'metre',  labelKey: 'onboarding.qUnitMetre' },
];

const Q_EXPIRY_OPTIONS: QuestionOption[] = [
  { value: 'yes', labelKey: 'onboarding.qExpiryYes' },
  { value: 'no',  labelKey: 'onboarding.qExpiryNo' },
];

const Q_VARIANTS_OPTIONS: QuestionOption[] = [
  { value: 'yes', labelKey: 'onboarding.qVariantsYes' },
  { value: 'no',  labelKey: 'onboarding.qVariantsNo' },
];

const Q_NICHE_OPTIONS: QuestionOption[] = [
  { value: 'clothing_store',    labelKey: 'onboarding.nicheLabelRetail',              icon: Shirt          },
  { value: 'grocery',           labelKey: 'onboarding.nicheLabelSupermarket',         icon: ShoppingCart    },
  { value: 'electronics_shop',  labelKey: 'onboarding.nicheLabelEcommerce',           icon: Globe          },
  { value: 'pharmacy',          labelKey: 'onboarding.nicheLabelPharmacy',            icon: Pill           },
  { value: 'cosmetics',         labelKey: 'onboarding.nicheLabelCosmetics',           icon: Paintbrush     },
  { value: 'electromechanical', labelKey: 'onboarding.nicheLabelHouseholdAppliances', icon: Home           },
  { value: 'electronics_toys',  labelKey: 'onboarding.nicheLabelElectronicsToys',     icon: Gamepad2       },
  { value: 'library',           labelKey: 'onboarding.nicheLabelLibrary',             icon: BookOpen       },
  { value: 'other',             labelKey: 'onboarding.nicheLabelOther',               icon: MoreHorizontal },
];

const QUESTION_STEPS = [
  { key: 'niche',     titleKey: 'onboarding.qNicheTitle',    options: Q_NICHE_OPTIONS,    multi: false },
  { key: 'orderType', titleKey: 'onboarding.qShippingTitle', options: Q_SHIPPING_OPTIONS, multi: false },
  { key: 'units',     titleKey: 'onboarding.qUnitsTitle',    options: Q_UNITS_OPTIONS,    multi: true  },
  { key: 'expiry',    titleKey: 'onboarding.qExpiryTitle',   options: Q_EXPIRY_OPTIONS,   multi: false },
  { key: 'variants',  titleKey: 'onboarding.qVariantsTitle', options: Q_VARIANTS_OPTIONS, multi: false },
];

const STEP_NAME    = 0;
const STEP_Q_START = 1;
const STEP_Q_END   = 5;
const STEP_CONFIRM = 6;

export default function BranchNicheOnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { stockId } = useParams<{ stockId: string }>();
  const location = useLocation();
  const { refreshAccessibleStocks, switchStock } = useAuth();

  const isRTL = i18n.dir() === 'rtl';
  const passedBranchName = (location.state as { branchName?: string })?.branchName || '';

  const [step, setStep] = useState(STEP_NAME);
  const [businessName, setBusinessName] = useState(passedBranchName);
  const [businessNameError, setBusinessNameError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const questionIndex   = step - STEP_Q_START;
  const currentQuestion = step >= STEP_Q_START && step <= STEP_Q_END ? QUESTION_STEPS[questionIndex] : null;

  const totalSteps = STEP_CONFIRM + 1;
  const visualStep = step + 1;
  const progress = Math.round(((visualStep - 1) / Math.max(totalSteps - 1, 1)) * 100);

  function validateBusinessName() {
    const trimmed = businessName.trim();
    if (!trimmed) { setBusinessNameError(t('onboarding.businessNameRequired')); return false; }
    if (trimmed.length > 100) { setBusinessNameError(t('onboarding.businessNameTooLong')); return false; }
    setBusinessNameError('');
    return true;
  }

  function handleNext() {
    if (step === STEP_NAME) {
      if (!validateBusinessName()) return;
      setStep(STEP_Q_START);
      return;
    }
    if (step >= STEP_Q_START && step < STEP_CONFIRM) {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step === STEP_NAME) {
      navigate(-1);
      return;
    }
    if (step === STEP_Q_START) {
      setStep(STEP_NAME);
      return;
    }
    setStep((s) => s - 1);
  }

  function handleOptionSelect(key: string, value: string, multi: boolean) {
    setAnswers((prev) => {
      if (!multi) return { ...prev, [key]: value };
      const current = (prev[key] as string[] | undefined) ?? [];
      const already = current.includes(value);
      return { ...prev, [key]: already ? current.filter((v) => v !== value) : [...current, value] };
    });
  }

  function isOptionSelected(key: string, value: string, multi: boolean): boolean {
    if (!multi) return answers[key] === value;
    return ((answers[key] as string[] | undefined) ?? []).includes(value);
  }

  function isStepComplete(): boolean {
    if (step === STEP_NAME) return businessName.trim().length > 0;
    if (currentQuestion) {
      const val = answers[currentQuestion.key];
      if (!val) return false;
      if (currentQuestion.multi) return (val as string[]).length > 0;
      return (val as string).length > 0;
    }
    return true;
  }

  async function handleComplete() {
    if (!stockId) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        businessName: businessName.trim(),
        selectedNiche: (answers['niche'] ?? 'other') as NicheType,
        answers,
      };

      const res = await nicheAPI.completeBranchOnboarding(stockId, payload);
      if (res.success) {
        await refreshAccessibleStocks();
        await switchStock(stockId);
        window.location.href = '/dashboard';
      } else {
        setSubmitError(res.message ?? 'Failed to save. Please try again.');
      }
    } catch {
      setSubmitError('Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render helpers ──

  function renderProgressBar() {
    return (
      <div className="w-full mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{t('onboarding.stepOf', { current: visualStep, total: totalSteps })}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  function renderNavButtons(canProceed: boolean, onNext?: () => void) {
    return (
      <div className={cn('flex gap-3 mt-8', isRTL ? 'flex-row-reverse' : '')}>
        <Button variant="outline" onClick={handleBack} className="gap-1.5">
          {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {t('onboarding.back')}
        </Button>
        <Button onClick={onNext ?? handleNext} disabled={!canProceed} className="flex-1 gap-1.5">
          {t('onboarding.next')}
          {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  // ── Step 0: Branch name ──

  function renderStep0() {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">
            {t('branchOnboarding.title', 'Set Up Your Branch')}
          </h1>
          <p className="text-muted-foreground">
            {t('branchOnboarding.subtitle', 'Choose a name and customize the niche for this branch stock.')}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="branchBusinessName">{t('stockSwitcher.branchName', 'Branch name')}</Label>
          <Input
            id="branchBusinessName"
            value={businessName}
            onChange={(e) => { setBusinessName(e.target.value); if (businessNameError) setBusinessNameError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && businessName.trim()) handleNext(); }}
            placeholder={t('stockSwitcher.branchNamePlaceholder', 'e.g. Downtown Branch')}
            maxLength={100}
            autoFocus
            className={cn(businessNameError && 'border-destructive')}
          />
          {businessNameError
            ? <p className="text-sm text-destructive">{businessNameError}</p>
            : <p className="text-sm text-muted-foreground">{t('branchOnboarding.nameHelper', 'This will be the display name of the branch.')}</p>
          }
        </div>
        {renderNavButtons(businessName.trim().length > 0)}
      </div>
    );
  }

  // ── Niche selection step ──

  function renderNicheStep(q: typeof QUESTION_STEPS[0]) {
    const selectedNiche = answers['niche'] as string | undefined;
    const canProceed = !!selectedNiche;

    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t(q.titleKey)}</h2>
        </div>
        <div className="grid gap-3 grid-cols-3">
          {Q_NICHE_OPTIONS.map((opt) => {
            const selected = selectedNiche === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleOptionSelect('niche', opt.value, false)}
                className={cn(
                  'group relative flex flex-col items-center gap-2.5 rounded-xl border p-4 text-sm font-medium transition-all duration-300 ease-out',
                  'hover:-translate-y-0.5 hover:shadow-md',
                  selected
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-[#D6D6D6] bg-background hover:border-primary',
                )}
              >
                {selected && (
                  <div className="absolute top-2 ltr:right-2 rtl:left-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-300',
                  selected
                    ? 'border-primary/30 bg-primary/15 text-primary'
                    : 'border-[#DEE2EE] bg-white text-muted-foreground group-hover:border-primary/30 group-hover:text-primary',
                )}>
                  {Icon && <Icon className="h-5 w-5" />}
                </div>
                <span className={cn(
                  'text-xs font-semibold text-center leading-tight transition-colors duration-300',
                  selected ? 'text-primary' : 'text-foreground',
                )}>
                  {t(opt.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
        {renderNavButtons(canProceed)}
      </div>
    );
  }

  // ── Generic question step ──

  function renderQuestionStep(q: typeof QUESTION_STEPS[0]) {
    if (q.key === 'niche') return renderNicheStep(q);
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t(q.titleKey)}</h2>
          {q.multi && <p className="text-sm text-muted-foreground">{t('onboarding.selectAllThatApply')}</p>}
        </div>
        <div className={cn('grid gap-3', q.options.length <= 3 ? 'grid-cols-1' : 'grid-cols-2')}>
          {q.options.map((opt) => {
            const selected = isOptionSelected(q.key, opt.value, q.multi);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleOptionSelect(q.key, opt.value, q.multi)}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl border p-4 text-sm font-medium text-left transition-all duration-300 ease-out',
                  'hover:-translate-y-0.5 hover:shadow-md',
                  selected
                    ? 'border-primary bg-primary/10 text-primary shadow-md'
                    : 'border-[#D6D6D6] bg-background text-foreground hover:border-primary',
                )}
              >
                {q.multi && (
                  <div className={cn(
                    'h-4.5 w-4.5 shrink-0 rounded border-2 flex items-center justify-center transition-colors duration-200',
                    selected ? 'bg-primary border-primary' : 'border-muted-foreground',
                  )}>
                    {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                )}
                <span className="font-semibold">{t(opt.labelKey)}</span>
                {!q.multi && selected && <Check className="h-4 w-4 ml-auto text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        {renderNavButtons(isStepComplete())}
      </div>
    );
  }

  // ── Confirm step ──

  function renderConfirmStep() {
    const nicheValue  = (answers['niche'] as string | undefined) ?? 'other';
    const nicheOption = Q_NICHE_OPTIONS.find((o) => o.value === nicheValue);
    const nicheLabel  = nicheOption ? t(nicheOption.labelKey) : t('onboarding.nicheLabelOther');

    const orderType = answers['orderType'] as string | undefined;
    const featureTags: string[] = [];
    if (orderType === 'shipping' || orderType === 'both') featureTags.push(t('onboarding.confirmFeatureShipping'));
    if (orderType === 'walkin'   || orderType === 'both') featureTags.push(t('onboarding.confirmFeatureWalkin'));
    if (answers['expiry'] === 'yes') featureTags.push(t('onboarding.confirmFeatureExpiry'));
    if (answers['variants'] === 'yes') featureTags.push(t('onboarding.confirmFeatureVariants'));
    const units = answers['units'] as string[] | undefined;
    if (units && units.length > 0) {
      const unitLabels = units.map((u) => {
        const opt = Q_UNITS_OPTIONS.find((o) => o.value === u);
        return opt ? t(opt.labelKey) : u;
      });
      featureTags.push(unitLabels.join(' / '));
    }

    return (
      <div className="space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-semibold">{t('onboarding.confirmTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('branchOnboarding.confirmSubtitle', 'Review the setup for your branch stock.')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-8 py-5 w-full">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="text-lg font-semibold text-primary">{businessName.trim()}</span>
            <span className="text-sm text-primary/70">{nicheLabel}</span>
          </div>
          {featureTags.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center w-full">
              {featureTags.map((tag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Check className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {submitError && <p className="text-sm text-destructive text-center">{submitError}</p>}
        <div className={cn('flex gap-3', isRTL ? 'flex-row-reverse' : '')}>
          <Button variant="outline" onClick={handleBack} className="gap-1.5">
            {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {t('onboarding.back')}
          </Button>
          <Button onClick={handleComplete} disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? t('onboarding.completing')
              : t('branchOnboarding.completeBtn', 'Create Branch')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ──

  if (!stockId) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {renderProgressBar()}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {step === STEP_NAME    && renderStep0()}
          {currentQuestion       && renderQuestionStep(currentQuestion)}
          {step === STEP_CONFIRM && renderConfirmStep()}
        </div>
      </div>
    </div>
  );
}
