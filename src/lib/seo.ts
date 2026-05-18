import { useEffect } from 'react';

export const SITE_URL = 'https://stocklydz.com';
export const SITE_NAME = 'Stockly';
export type SeoLanguage = 'en' | 'ar' | 'fr';
export type SeoPageKey = 'home' | 'features' | 'pricing' | 'contact' | 'privacy' | 'terms';

const SITE_ALTERNATE_NAMES = ['Stocklydz', 'Stockly DZ', 'ستوكلي'];
const SITE_LOGO_PATH = '/landing-page/brand-logo-blue-full.png';
const DEFAULT_OG_IMAGE_PATH = '/landing-page/brand-logo-blue-full.png';
const SOCIAL_PROFILES = [
  'https://www.facebook.com/share/18LMHg3d7h/?mibextid=wwXIfr',
  'https://www.instagram.com/stockly.dz?igsh=MTR2MnN3amVrODdubA==',
  'https://www.linkedin.com/company/stocklydz/',
  'https://www.youtube.com/@stocklydz',
  'https://www.tiktok.com/@stocklydz',
];
const BRAND_KEYWORDS = ['Stockly', 'Stocklydz', 'Stockly DZ', 'stockly', 'stocklydz', 'ستوكلي'];
const LOCALE_BY_LANGUAGE: Record<SeoLanguage, string> = {
  en: 'en_US',
  ar: 'ar_DZ',
  fr: 'fr_FR',
};

type SeoPreset = {
  title: string;
  description: string;
  keywords: string[];
};

const SEO_COPY: Record<SeoLanguage, Record<SeoPageKey, SeoPreset>> = {
  en: {
    home: {
      title: 'Stockly DZ | Inventory & Stock Management Software',
      description:
        'Stockly is inventory and stock management software for businesses in Algeria. Stocklydz helps you track products, scan barcodes, manage orders, and monitor sales in real time.',
      keywords: [
        'inventory management software',
        'stock management software',
        'barcode inventory system',
        'order management software',
        'inventory software Algeria',
      ],
    },
    features: {
      title: 'Stockly Features | Barcode, Inventory, Orders & Analytics',
      description:
        'Explore Stockly features for barcode scanning, inventory tracking, order workflows, analytics, backups, and team collaboration.',
      keywords: [
        'stockly features',
        'barcode scanning software',
        'inventory tracking',
        'inventory analytics',
        'team inventory tools',
      ],
    },
    pricing: {
      title: 'Stockly Pricing | Inventory Plans for Stores and Teams',
      description:
        'Compare Stockly pricing plans for growing stores and teams. Start with flexible inventory, barcode, and order management tools.',
      keywords: [
        'stockly pricing',
        'inventory software pricing',
        'stock management plans',
        'barcode software plans',
      ],
    },
    contact: {
      title: 'Contact Stockly | Demo, Sales & Setup Help',
      description:
        'Contact Stocklydz for demos, onboarding, pricing questions, and setup help for your inventory and stock management workflow.',
      keywords: [
        'contact stockly',
        'stockly demo',
        'inventory software support',
        'stocklydz contact',
      ],
    },
    privacy: {
      title: 'Stockly Privacy Policy | Data Protection',
      description:
        'Read how Stockly collects, uses, and protects business and account data across the Stocklydz platform.',
      keywords: ['stockly privacy', 'stockly data protection', 'stocklydz privacy policy'],
    },
    terms: {
      title: 'Stockly Terms of Service',
      description:
        'Review the Stockly terms of service for using Stocklydz inventory, analytics, and order management tools.',
      keywords: ['stockly terms', 'stockly terms of service', 'stocklydz terms'],
    },
  },
  ar: {
    home: {
      title: 'Stockly | برنامج إدارة المخزون وتتبع المبيعات',
      description:
        'Stockly هو برنامج لإدارة المخزون وتتبع المبيعات ومسح الباركود للشركات في الجزائر. يساعد Stocklydz على تنظيم المنتجات والطلبات والتحليلات من أي مكان.',
      keywords: [
        'برنامج إدارة المخزون',
        'إدارة المخزون',
        'برنامج جرد',
        'برنامج باركود',
        'إدارة الطلبات',
        'الجزائر',
      ],
    },
    features: {
      title: 'ميزات Stockly | باركود ومخزون وطلبات وتحليلات',
      description:
        'اكتشف ميزات Stockly لإدارة المخزون، ومسح الباركود، وتتبع الطلبات، والتحليلات، والنسخ الاحتياطي، وتعاون الفريق.',
      keywords: [
        'ميزات ستوكلي',
        'مسح الباركود',
        'تتبع المخزون',
        'تحليلات المخزون',
        'برنامج إدارة الطلبات',
      ],
    },
    pricing: {
      title: 'أسعار Stockly | خطط مرنة لإدارة المخزون',
      description:
        'قارن خطط Stockly للشركات والمتاجر. ابدأ بخطة مناسبة واحصل على أدوات المخزون والباركود والطلبات حسب نمو عملك.',
      keywords: ['أسعار ستوكلي', 'خطط إدارة المخزون', 'برنامج مخزون الجزائر', 'أسعار برنامج باركود'],
    },
    contact: {
      title: 'تواصل مع Stockly | مبيعات ودعم وإعداد',
      description:
        'تواصل مع Stocklydz للحصول على عرض تجريبي، أو المساعدة في الإعداد، أو اختيار الخطة المناسبة لإدارة المخزون والطلبات.',
      keywords: ['التواصل مع ستوكلي', 'دعم ستوكلي', 'عرض تجريبي', 'مساعدة إعداد المخزون'],
    },
    privacy: {
      title: 'سياسة الخصوصية | Stockly',
      description:
        'اطلع على كيفية جمع Stockly واستخدامه وحمايته لبيانات الحسابات والأعمال داخل منصة Stocklydz.',
      keywords: ['سياسة الخصوصية ستوكلي', 'حماية البيانات', 'خصوصية stocklydz'],
    },
    terms: {
      title: 'شروط الاستخدام | Stockly',
      description:
        'اقرأ شروط استخدام Stocklydz الخاصة بإدارة المخزون والتحليلات والطلبات قبل استخدام المنصة.',
      keywords: ['شروط ستوكلي', 'شروط الاستخدام', 'شروط stocklydz'],
    },
  },
  fr: {
    home: {
      title: "Stockly | Logiciel de gestion de stock et d'inventaire",
      description:
        "Stockly est un logiciel de gestion de stock pour les entreprises en Algérie. Stocklydz vous aide à suivre les produits, scanner les codes-barres, gérer les commandes et analyser les ventes.",
      keywords: [
        'logiciel gestion stock',
        'gestion inventaire',
        'logiciel code-barres',
        'gestion commandes',
        'logiciel stock Algerie',
      ],
    },
    features: {
      title: 'Fonctionnalites Stockly | Stock, commandes, codes-barres et analyses',
      description:
        'Découvrez les fonctionnalités Stockly pour le suivi des stocks, le scan de codes-barres, les commandes, les analyses et la collaboration.',
      keywords: [
        'fonctionnalites stockly',
        'suivi des stocks',
        'lecture code-barres',
        'analyse inventaire',
        'outil gestion equipe',
      ],
    },
    pricing: {
      title: 'Tarifs Stockly | Offres flexibles pour vos équipes',
      description:
        "Comparez les tarifs Stockly pour les commerces et les équipes. Lancez votre gestion de stock avec des formules adaptées à votre croissance.",
      keywords: ['tarifs stockly', 'prix logiciel stock', 'forfaits gestion inventaire', 'stocklydz tarifs'],
    },
    contact: {
      title: 'Contacter Stockly | Démo, ventes et aide au démarrage',
      description:
        "Contactez Stocklydz pour une démo, l'onboarding, le choix du bon forfait ou l'aide à la configuration de votre gestion de stock.",
      keywords: ['contacter stockly', 'demo stockly', 'support gestion stock', 'stocklydz contact'],
    },
    privacy: {
      title: 'Politique de confidentialité | Stockly',
      description:
        'Consultez la façon dont Stockly collecte, utilise et protège les données de compte et de gestion dans la plateforme Stocklydz.',
      keywords: ['confidentialite stockly', 'protection des donnees', 'politique stocklydz'],
    },
    terms: {
      title: "Conditions d'utilisation | Stockly",
      description:
        "Lisez les conditions d'utilisation de Stocklydz pour la gestion de stock, les commandes et les analyses.",
      keywords: ['conditions stockly', 'conditions utilisation stockly', 'stocklydz conditions'],
    },
  },
};

type SeoConfig = {
  title: string;
  description: string;
  canonicalPath: string;
  noIndex?: boolean;
  ogType?: 'website' | 'article';
  keywords?: string[];
  ogImagePath?: string;
  ogImageAlt?: string;
  language?: SeoLanguage;
};

export const getLocalizedSeo = (page: SeoPageKey, language: SeoLanguage): SeoPreset => {
  return SEO_COPY[language]?.[page] ?? SEO_COPY.en[page];
};

const upsertMetaByName = (name: string, content: string) => {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const upsertMetaByProperty = (property: string, content: string) => {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const upsertLink = (rel: string, href: string) => {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const upsertStructuredData = (id: string, data: Record<string, unknown>) => {
  let el = document.querySelector(
    `script[type="application/ld+json"][data-seo-id="${id}"]`
  ) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-seo-id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
};

const toCanonicalUrl = (canonicalPath: string) => {
  // Allow passing a full URL, otherwise resolve against SITE_URL.
  if (/^https?:\/\//i.test(canonicalPath)) return canonicalPath;
  const normalizedPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  return new URL(normalizedPath, SITE_URL).toString();
};

const toAbsoluteUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, SITE_URL).toString();
};

const buildStructuredData = ({
  canonicalUrl,
  description,
  language,
  ogImageUrl,
  title,
}: {
  canonicalUrl: string;
  description: string;
  language: SeoLanguage;
  ogImageUrl: string;
  title: string;
}) => {
  const locale = LOCALE_BY_LANGUAGE[language] ?? LOCALE_BY_LANGUAGE.en;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: toAbsoluteUrl(SITE_LOGO_PATH),
        },
        image: ogImageUrl,
        email: 'stocklydz@gmail.com',
        telephone: '+213 664 449 156',
        sameAs: SOCIAL_PROFILES,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        inLanguage: locale,
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: {
          '@id': `${SITE_URL}/#website`,
        },
        about: {
          '@id': `${SITE_URL}/#organization`,
        },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: ogImageUrl,
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: SITE_URL,
        image: ogImageUrl,
        description,
        availableLanguage: ['en', 'ar', 'fr'],
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
    ],
  };
};

export const useSeo = (config: SeoConfig) => {
  const {
    title,
    description,
    canonicalPath,
    noIndex = false,
    ogType = 'website',
    keywords = [],
    ogImagePath = DEFAULT_OG_IMAGE_PATH,
    ogImageAlt = 'Stockly brand graphic',
    language = 'en',
  } = config;

  useEffect(() => {
    const canonicalUrl = toCanonicalUrl(canonicalPath);
    const ogImageUrl = toAbsoluteUrl(ogImagePath);
    const locale = LOCALE_BY_LANGUAGE[language] ?? LOCALE_BY_LANGUAGE.en;
    const mergedKeywords = Array.from(new Set([...BRAND_KEYWORDS, ...keywords]));

    document.title = title;

    upsertMetaByName('description', description);
    upsertMetaByName('keywords', mergedKeywords.join(', '));
    upsertMetaByName('robots', noIndex ? 'noindex,nofollow' : 'index,follow');
    upsertMetaByName('application-name', SITE_NAME);
    upsertMetaByName('apple-mobile-web-app-title', SITE_NAME);
    upsertMetaByName('theme-color', '#001EF4');
    upsertLink('canonical', canonicalUrl);

    // Open Graph
    upsertMetaByProperty('og:site_name', SITE_NAME);
    upsertMetaByProperty('og:type', ogType);
    upsertMetaByProperty('og:title', title);
    upsertMetaByProperty('og:description', description);
    upsertMetaByProperty('og:url', canonicalUrl);
    upsertMetaByProperty('og:locale', locale);
    upsertMetaByProperty('og:image', ogImageUrl);
    upsertMetaByProperty('og:image:alt', ogImageAlt);

    // Twitter
    upsertMetaByName('twitter:card', 'summary_large_image');
    upsertMetaByName('twitter:title', title);
    upsertMetaByName('twitter:description', description);
    upsertMetaByName('twitter:image', ogImageUrl);

    upsertStructuredData(
      'stockly-site',
      buildStructuredData({
        canonicalUrl,
        description,
        language,
        ogImageUrl,
        title,
      })
    );
  }, [title, description, canonicalPath, noIndex, ogType, keywords, ogImagePath, ogImageAlt, language]);
};

