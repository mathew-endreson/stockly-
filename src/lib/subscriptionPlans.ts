import type { User } from '@/types';

export type SubscriptionPlanId = User['subscription']['plan'];
export type AppLanguage = 'en' | 'ar' | 'fr';
export type BillingPeriod = 'monthly' | 'yearly';
export type SubscriptionFeatureKey =
  | 'backup'
  | 'invoicing'
  | 'expenses'
  | 'distributors'
  | 'surveillance';

type MarketingPlanFeature = {
  label: string;
  included: boolean;
};

export type MarketingPlanCard = {
  id: SubscriptionPlanId;
  name: string;
  description: string;
  prices: Record<BillingPeriod, string>;
  highlighted?: boolean;
  badge?: string;
  features: MarketingPlanFeature[];
};

const PLAN_ORDER: SubscriptionPlanId[] = ['basic', 'premium', 'pro', 'enterprise'];

const PLAN_LIMITS: Record<
  SubscriptionPlanId,
  {
    teamMembers: number | null;
    branchStocks: number | null;
    features: Record<SubscriptionFeatureKey, boolean>;
  }
> = {
  basic: {
    teamMembers: 5,
    branchStocks: 0,
    features: {
      backup: true,
      invoicing: false,
      expenses: false,
      distributors: false,
      surveillance: false,
    },
  },
  premium: {
    teamMembers: 10,
    branchStocks: 2,
    features: {
      backup: true,
      invoicing: true,
      expenses: true,
      distributors: false,
      surveillance: false,
    },
  },
  pro: {
    teamMembers: 50,
    branchStocks: 5,
    features: {
      backup: true,
      invoicing: true,
      expenses: true,
      distributors: true,
      surveillance: true,
    },
  },
  enterprise: {
    teamMembers: 100,
    branchStocks: 10,
    features: {
      backup: true,
      invoicing: true,
      expenses: true,
      distributors: true,
      surveillance: true,
    },
  },
};

const normalizePlan = (plan: SubscriptionPlanId | string | null | undefined): SubscriptionPlanId =>
  PLAN_ORDER.includes(plan as SubscriptionPlanId) ? (plan as SubscriptionPlanId) : 'basic';

export const getWorkspacePlanId = (user?: User | null): SubscriptionPlanId =>
  user?.subscription?.plan || 'basic';

export const getOwnerPlanId = (user?: User | null): SubscriptionPlanId =>
  user?.ownSubscription?.plan || user?.subscription?.plan || 'basic';

export const hasPlanFeature = (
  plan: SubscriptionPlanId | string | null | undefined,
  feature: SubscriptionFeatureKey
) => Boolean(PLAN_LIMITS[normalizePlan(plan)].features[feature]);

export const getRequiredPlanForFeature = (
  feature: SubscriptionFeatureKey
): SubscriptionPlanId =>
  PLAN_ORDER.find((plan) => hasPlanFeature(plan, feature)) || 'enterprise';

export const getTeamMemberLimit = (plan: SubscriptionPlanId | string | null | undefined) =>
  PLAN_LIMITS[normalizePlan(plan)].teamMembers;

export const getBranchStockLimit = (plan: SubscriptionPlanId | string | null | undefined) =>
  PLAN_LIMITS[normalizePlan(plan)].branchStocks;

export const getPlanLabel = (plan: SubscriptionPlanId, language: AppLanguage) => {
  const labels: Record<AppLanguage, Record<SubscriptionPlanId, string>> = {
    en: {
      basic: 'Basic',
      premium: 'Premium',
      pro: 'Pro',
      enterprise: 'Enterprise',
    },
    ar: {
      basic: 'أساسي',
      premium: 'بريميوم',
      pro: 'برو',
      enterprise: 'المؤسسات',
    },
    fr: {
      basic: 'Basique',
      premium: 'Premium',
      pro: 'Pro',
      enterprise: 'Entreprise',
    },
  };

  return labels[language][plan];
};

const getArabicPlans = (): MarketingPlanCard[] => [
  {
    id: 'basic',
    name: 'أساسي',
    description: 'للشركات الصغيرة',
    prices: { monthly: '1,500 دج /شهر', yearly: '15,000 دج /سنة' },
    features: [
      { label: '500 منتج', included: true },
      { label: '1,500 طلب', included: true },
      { label: '5 أعضاء فريق', included: true },
      { label: 'نظام النسخ الاحتياطي', included: true },
      { label: 'نظام الفواتير', included: false },
      { label: 'الذكاء الاصطناعي', included: false },
      { label: 'نظام المصاريف', included: false },
      { label: 'مخازن الفروع', included: false },
      { label: 'نظام الموزعين', included: false },
      { label: 'نظام المراقبة', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'بريميوم',
    description: 'للفرق المتنامية',
    prices: { monthly: '2,200 دج /شهر', yearly: '22,000 دج /سنة' },
    features: [
      { label: '1,000 منتج', included: true },
      { label: 'طلبات غير محدودة', included: true },
      { label: '10 أعضاء فريق', included: true },
      { label: 'نظام الفواتير', included: true },
      { label: 'ذكاء اصطناعي محدود الاستعمال', included: true },
      { label: 'نظام النسخ الاحتياطي', included: true },
      { label: 'نظام المصاريف', included: true },
      { label: 'مخزنان فرعيان', included: true },
      { label: 'نظام الموزعين', included: false },
      { label: 'نظام المراقبة', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'برو',
    description: 'للمستخدمين المحترفين',
    prices: { monthly: '3,500 دج /شهر', yearly: '35,000 دج /سنة' },
    highlighted: true,
    badge: 'موصى به',
    features: [
      { label: 'منتجات غير محدودة', included: true },
      { label: 'طلبات غير محدودة', included: true },
      { label: '50 عضو فريق', included: true },
      { label: 'نظام الفواتير', included: true },
      { label: 'ذكاء اصطناعي موسع الاستعمال', included: true },
      { label: 'نظام النسخ الاحتياطي', included: true },
      { label: 'نظام المصاريف', included: true },
      { label: '5 مخازن فروع', included: true },
      { label: 'نظام الموزعين', included: true },
      { label: 'نظام المراقبة', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'المؤسسات',
    description: 'للمنظمات الكبيرة',
    prices: { monthly: '4,900 دج /شهر', yearly: '49,000 دج /سنة' },
    features: [
      { label: 'كل شيء في برو', included: true },
      { label: '100 عضو فريق', included: true },
      { label: '10 مخازن فروع', included: true },
      { label: 'تكاملات مخصصة', included: true },
      { label: 'مدير مخصص', included: true },
      { label: 'ضمان SLA', included: true },
      { label: 'خيار محلي', included: true },
    ],
  },
];

const getEnglishPlans = (): MarketingPlanCard[] => [
  {
    id: 'basic',
    name: 'Basic',
    description: 'For small businesses',
    prices: { monthly: '1,500 DA /month', yearly: '15,000 DA /year' },
    features: [
      { label: '500 products', included: true },
      { label: '1,500 orders', included: true },
      { label: '5 team members', included: true },
      { label: 'Backup system', included: true },
      { label: 'Invoicing system', included: false },
      { label: 'AI daily text', included: false },
      { label: 'Expenses system', included: false },
      { label: 'Branch Stocks', included: false },
      { label: 'Distributor system', included: false },
      { label: 'Surveillance system', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For growing teams',
    prices: { monthly: '2,200 DA /month', yearly: '22,000 DA /year' },
    features: [
      { label: '1,000 products', included: true },
      { label: 'Unlimited orders', included: true },
      { label: '10 team members', included: true },
      { label: 'Invoicing system', included: true },
      { label: 'Limited AI daily text', included: true },
      { label: 'Backup system', included: true },
      { label: 'Expenses system', included: true },
      { label: '2 Branch Stocks', included: true },
      { label: 'Distributor system', included: false },
      { label: 'Surveillance system', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users',
    prices: { monthly: '3,500 DA /month', yearly: '35,000 DA /year' },
    highlighted: true,
    badge: 'Recommended',
    features: [
      { label: 'Unlimited products', included: true },
      { label: 'Unlimited orders', included: true },
      { label: '50 team members', included: true },
      { label: 'Invoicing system', included: true },
      { label: 'Extended AI daily text', included: true },
      { label: 'Backup system', included: true },
      { label: 'Expenses system', included: true },
      { label: '5 Branch Stocks', included: true },
      { label: 'Distributor system', included: true },
      { label: 'Surveillance system', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    prices: { monthly: '4,900 DA /month', yearly: '49,000 DA /year' },
    features: [
      { label: 'Everything in Pro', included: true },
      { label: '100 team members', included: true },
      { label: '10 Branch Stocks', included: true },
      { label: 'Custom integrations', included: true },
      { label: 'Dedicated manager', included: true },
      { label: 'SLA guarantee', included: true },
      { label: 'On-premise option', included: true },
    ],
  },
];

const getFrenchPlans = (): MarketingPlanCard[] => [
  {
    id: 'basic',
    name: 'Basique',
    description: 'Pour les petites entreprises',
    prices: { monthly: '1,500 DA /mois', yearly: '15,000 DA /an' },
    features: [
      { label: '500 produits', included: true },
      { label: '1 500 commandes', included: true },
      { label: '5 membres d\'equipe', included: true },
      { label: 'Systeme de sauvegarde', included: true },
      { label: 'Systeme de facturation', included: false },
      { label: 'Texte IA quotidien', included: false },
      { label: 'Systeme de depenses', included: false },
      { label: 'Stocks de branche', included: false },
      { label: 'Systeme de distributeurs', included: false },
      { label: 'Systeme de surveillance', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Pour les equipes en croissance',
    prices: { monthly: '2,200 DA /mois', yearly: '22,000 DA /an' },
    features: [
      { label: '1 000 produits', included: true },
      { label: 'Commandes illimitees', included: true },
      { label: '10 membres d\'equipe', included: true },
      { label: 'Systeme de facturation', included: true },
      { label: 'Texte IA quotidien limite', included: true },
      { label: 'Systeme de sauvegarde', included: true },
      { label: 'Systeme de depenses', included: true },
      { label: '2 stocks de branche', included: true },
      { label: 'Systeme de distributeurs', included: false },
      { label: 'Systeme de surveillance', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Pour les utilisateurs avances',
    prices: { monthly: '3,500 DA /mois', yearly: '35,000 DA /an' },
    highlighted: true,
    badge: 'Recommande',
    features: [
      { label: 'Produits illimites', included: true },
      { label: 'Commandes illimitees', included: true },
      { label: '50 membres d\'equipe', included: true },
      { label: 'Systeme de facturation', included: true },
      { label: 'Texte IA quotidien etendu', included: true },
      { label: 'Systeme de sauvegarde', included: true },
      { label: 'Systeme de depenses', included: true },
      { label: '5 stocks de branche', included: true },
      { label: 'Systeme de distributeurs', included: true },
      { label: 'Systeme de surveillance', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    description: 'Pour les grandes organisations',
    prices: { monthly: '4,900 DA /mois', yearly: '49,000 DA /an' },
    features: [
      { label: 'Tout du plan Pro', included: true },
      { label: '100 membres d\'equipe', included: true },
      { label: '10 stocks de branche', included: true },
      { label: 'Integrations personnalisees', included: true },
      { label: 'Manager dedie', included: true },
      { label: 'Garantie SLA', included: true },
      { label: 'Option sur site', included: true },
    ],
  },
];

export const getMarketingPlanCards = (
  language: AppLanguage,
  billingPeriod: BillingPeriod
): Array<MarketingPlanCard & { visiblePrice: string }> => {
  const plans =
    language === 'ar'
      ? getArabicPlans()
      : language === 'fr'
        ? getFrenchPlans()
        : getEnglishPlans();

  return plans.map((plan) => ({
    ...plan,
    visiblePrice: plan.prices[billingPeriod],
  }));
};
