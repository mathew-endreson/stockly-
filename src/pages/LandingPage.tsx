import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, LayoutDashboard, LogOut, Video, X } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getMarketingPlanCards } from '@/lib/subscriptionPlans';
import { contactAPI } from '@/services/api';

type BillingCycle = 'monthly' | 'yearly';
type LanguageValue = 'en' | 'ar' | 'fr';
type NavSection = 'features' | 'niches' | 'pricing' | 'contact';

const navSections: NavSection[] = ['features', 'niches', 'pricing', 'contact'];

const features = [
  {
    iconSrc: '/landing-page/feature-icon-smart.svg',
    title: 'Smart Inventory',
    description:
      'Track your stock in real-time with intelligent alerts and automated reordering.',
  },
  {
    iconSrc: '/landing-page/feature-icon-barcode.svg',
    title: 'Barcode Scanning',
    description:
      'Scan products instantly with your device camera for quick lookup and checkout.',
  },
  {
    iconSrc: '/landing-page/feature-icon-analytics.svg',
    title: 'Advanced Analytics',
    description:
      'Get insights into bestsellers, stock value, sales trends, and business growth.',
  },
  {
    iconSrc: '/landing-page/feature-icon-orders.svg',
    title: 'Orders Ready',
    description:
      'Manage orders, track shipments, and handle customer data seamlessly.',
  },
  {
    iconSrc: '/landing-page/feature-icon-team.svg',
    title: 'Team Collaboration',
    description:
      'Invite team members with customizable permissions and role-based access.',
  },
  {
    iconSrc: '/landing-page/feature-icon-secure.svg',
    title: 'Secure & Reliable',
    description:
      'Enterprise-grade security with data encryption and automatic backups.',
  },
];

const arabicFeatures = [
  {
    iconSrc: '/landing-page/feature-icon-smart.svg',
    title: 'إدارة المخزون الذكية',
    description: 'تابع مخزونك لحظيًا مع تنبيهات ذكية وإعادة طلب تلقائية.',
  },
  {
    iconSrc: '/landing-page/feature-icon-barcode.svg',
    title: 'مسح الباركود',
    description: 'امسح المنتجات فورًا بكاميرا جهازك للبحث السريع وإتمام البيع.',
  },
  {
    iconSrc: '/landing-page/feature-icon-analytics.svg',
    title: 'تحليلات متقدمة',
    description: 'احصل على رؤى حول المنتجات الأكثر مبيعًا وقيمة المخزون واتجاهات المبيعات ونمو الأعمال.',
  },
  {
    iconSrc: '/landing-page/feature-icon-orders.svg',
    title: 'إدارة الطلبات',
    description: 'أدِر الطلبات وتتبع الشحنات وتعامل مع بيانات العملاء بسهولة.',
  },
  {
    iconSrc: '/landing-page/feature-icon-team.svg',
    title: 'تعاون الفريق',
    description: 'ادعُ أعضاء الفريق مع صلاحيات قابلة للتخصيص ووصول حسب الدور.',
  },
  {
    iconSrc: '/landing-page/feature-icon-secure.svg',
    title: 'آمن وموثوق',
    description: 'أمان بمستوى المؤسسات مع تشفير البيانات والنسخ الاحتياطي التلقائي.',
  },
];

const operationalCards = [
  {
    iconSrc: '/landing-page/feature-icon-import-group114.svg',
    title: 'Importing Made Simple',
    description: 'Import files from your spreadsheet workflow with a clean setup process that keeps your catalog accurate.',
  },
  {
    iconSrc: '/landing-page/feature-icon-offline-group115.svg',
    title: 'No need for Internet',
    description: 'Keep sales moving in unstable networks. Your activity syncs cleanly as soon as connection is restored.',
    cta: 'Download App Now',
  },
  {
    iconSrc: '/landing-page/feature-icon-stok-group113.svg',
    title: 'STOK (Our AI Assistant)',
    description: 'Automate routine stock decisions and receive operational recommendations to improve efficiency each day.',
  },
];

const arabicOperationalCards = [
  {
    iconSrc: '/landing-page/feature-icon-import-group114.svg',
    title: 'استيراد الملفات بسهولة',
    description: 'استورد ملفات الجداول بخطوات إعداد واضحة تحافظ على دقة كتالوج المنتجات لديك.',
  },
  {
    iconSrc: '/landing-page/feature-icon-offline-group115.svg',
    title: 'لا حاجة للإنترنت',
    description: 'واصل البيع حتى مع ضعف الشبكة، وستتم مزامنة نشاطك تلقائيًا عند عودة الاتصال.',
    cta: 'حمّل التطبيق الآن',
  },
  {
    iconSrc: '/landing-page/feature-icon-stok-group113.svg',
    title: 'ستوك (مساعدنا بالذكاء الاصطناعي)',
    description: 'أتمت قرارات المخزون الروتينية واحصل على توصيات تشغيلية لتحسين الكفاءة يوميًا.',
  },
];
const arabicIndustries = [
  {
    title: 'التجارة الإلكترونية',
    copy: 'مزامنة رقمية سلسة. اربط متاجرك بمنصة موحدة. يقوم ستوكلي بأتمتة تحديثات المخزون متعدد القنوات، وإدارة تنفيذ الطلبات بسرعة عالية، والتكامل مباشرة مع شركات الشحن لمنع البيع الزائد.',
    image: '/landing-page/rectangle-415.svg',
  },
  {
    title: 'البيع بالتجزئة والبوتيكات',
    copy: 'دقة في المتجر. مصمم للتجربة المنسقة. أدِر مساحة الأرفف الفعلية، وتتبع معاملات نقاط البيع في الوقت الفعلي، وتعامل مع التحويلات بين المواقع المتعددة بواجهة نظيفة تبقي تركيزك على العميل.',
    image: '/landing-page/rectangle-416.svg',
  },
  {
    title: 'البيع بالجملة',
    copy: 'إدارة التدفق بالجملة. تشغيل اللوجستيات واسعة النطاق. تعامل مع الطلبات الضخمة المعقدة، وتتبع المخزون على مستوى المنصات، وأدِر أوقات تسليم الموردين بسير عمل مشتريات آلي مبني للتوزيع الكبير.',
    image: '/landing-page/rectangle-417.svg',
  },
  {
    title: 'السوبرماركت',
    copy: 'تتبع عالي السرعة. مبني للرف السريع. أدِر آلاف وحدات SKU، وراقب تواريخ الانتهاء بتنبيهات ذكية، وحسّن جداول إعادة التخزين لضمان توفر المنتجات الأساسية اليومية في الممرات عالية الحركة.',
    image: '/landing-page/rectangle-418.svg',
  },

];
const industries = [
  {
    title: 'E-commerce',
    copy:
      'Seamless Digital Sync. Connect your storefronts to a unified hub. Stockly automates multi-channel inventory updates, manages high-speed order fulfillment, and integrates directly with your shipping carriers to prevent overselling.',
    image: '/landing-page/rectangle-415.svg',
  },
  {
    title: 'Retail & Boutiques',
    copy:
      'Storefront Precision. Designed for the curated experience. Manage physical shelf space, track point-of-sale (POS) transactions in real-time, and handle multi-location transfers with a clean interface that keeps your focus on the customer.',
    image: '/landing-page/rectangle-416.svg',
  },
  {
    title: 'Wholesale',
    copy:
      'Bulk Flow Management. Powering large-scale logistics. Handle complex bulk orders, track pallet-level inventory, and manage supplier lead times with automated procurement workflows built for high-volume distribution.',
    image: '/landing-page/rectangle-417.svg',
  },
  {
    title: 'Supermarkets',
    copy:
      'High-Velocity Tracking. Built for the rapid shelf. Manage thousands of SKUs, monitor expiration dates with smart alerts, and optimize restocking schedules to ensure your daily essentials are always available for high-traffic aisles.',
    image: '/landing-page/rectangle-418.svg',
  },
];

const languageOptions: Array<{ value: LanguageValue; label: string; shortLabel: string }> = [
  { value: 'en', label: 'English', shortLabel: 'Eng' },
  { value: 'ar', label: 'العربية', shortLabel: 'Ar' },
  { value: 'fr', label: 'French', shortLabel: 'Fr' },
];

const landingCopy = {
  english: {
    stocklyHome: 'Stockly home',
    selectLanguage: 'Select language',
    nav: {
      features: 'Features',
      niches: 'Niches',
      pricing: 'Pricing',
      contact: 'Contact Us',
    },
    auth: {
      login: 'Log In',
      getStarted: 'Get Started Now',
      getStartedFree: 'Get Started Free',
      dashboard: 'Go to Dashboard',
    },
    hero: {
      highlightedTitle: 'Easy & Smart',
      titleRest: 'management',
      titleSecondLine: 'Better Growth',
      descriptionFirstLine: 'The complete stock management solution for modern businesses.',
      descriptionSecondLine: 'Track, analyze, sell, and grow with powerful tools designed for teams.',
      secondaryCta: 'See How It Works',
    },
    features: {
      heading: 'All the features you need',
      description: 'Powerful features designed to help you manage inventory, track sales, and grow your business.',
    },
    section: {
      headingFirstWord: 'Break',
      headingLines: ['free from', 'warehouse limits.'],
      descriptionLines: [
        'Manage your data center from anywhere, securely.',
        'Stockly is fully cloud-based, ensuring your',
        'inventory levels, tracking, and analytics data',
        'are always accurate and available in',
        'your mobile dashboard.',
      ],
    },
    contact: {
      titleHighlight: 'Contact',
      titleRest: 'Us',
      intro: 'Tell us about your business and we will help you pick the right plan.',
      emailLabel: 'Email Address',
      phoneLabel: 'Phone',
      description:
        'Whether you are setting up your first inventory workflow or scaling operations across multiple teams, our support team can help you choose the right plan and configuration for your business. Share your business type, current stock size, and the main challenge you want to solve first, and we will guide you with practical steps to get started quickly, avoid setup mistakes, and build a workflow that stays reliable as your orders, team, and product catalog grow over time every single day without stress.',
      followLabel: 'Follow Us',
      formTitle: 'Send us a message',
      formSubtitle: 'We usually reply within one business day.',
      fullNameLabel: 'Full Name',
      emailInputLabel: 'Email',
      messageLabel: 'Your message',
      submitLabel: 'Send the message',
      sendingLabel: 'Sending...',
      successLabel: 'Your message was sent successfully.',
      fallbackLabel: 'Your email app was opened so you can send the message directly to Stockly.',
      errorLabel: 'We could not send your message right now. Please try again.',
    },
  },
  arabic: {
    stocklyHome: 'الصفحة الرئيسية لستوكلي',
    selectLanguage: 'اختيار اللغة',
    nav: {
      features: 'الميزات',
      niches: 'المجالات',
      pricing: 'الأسعار',
      contact: 'تواصل معنا',
    },
    auth: {
      login: 'تسجيل الدخول',
      getStarted: 'ابدأ الآن',
      getStartedFree: 'ابدأ مجانًا',
      dashboard: 'اذهب إلى لوحة التحكم',
    },
    hero: {
      highlightedTitle: 'إدارة سهلة وذكية',
      titleRest: '',
      titleSecondLine: 'لنمو أفضل',
      descriptionFirstLine: 'الحل الكامل لإدارة المخزون والمبيعات والفواتير والموظفين للشركات الحديثة.',
      descriptionSecondLine: 'تتبّع، حلّل، بِع، وأدِر فريقك باستخدام أدوات قوية مصممة للفرق.',
      secondaryCta: 'شاهد كيف يعمل',
    },
    features: {
      heading: 'كل الميزات التي تحتاجها',
      description: 'ميزات قوية تساعدك على إدارة المخزون، وتتبع المبيعات، وتنظيم الفواتير والموظفين، وتنمية عملك.',
    },
    section: {
      headingFirstWord: 'تحرّر',
      headingLines: ['من قيود', 'المخزن.'],
      descriptionLines: [
        'ادِر مركز بياناتك من أي مكان بأمان.',
        'ستوكلي منصة سحابية بالكامل، تضمن أن',
        'مستويات مخزونك وتتبعك وبيانات التحليلات',
        'دائمًا دقيقة ومتاحة في',
        'لوحة التحكم المحمولة الخاصة بك.',
      ],
    },
    contact: {
      titleHighlight: 'تواصل',
      titleRest: 'معنا',
      intro: 'أخبرنا عن نشاطك وسنساعدك على اختيار الخطة المناسبة.',
      emailLabel: 'البريد الإلكتروني',
      phoneLabel: 'الهاتف',
      description:
        'سواء كنت تبدأ أول نظام لإدارة المخزون أو توسّع عملياتك عبر عدة فرق، يمكن لفريق الدعم مساعدتك على اختيار الخطة والإعداد المناسبين لنشاطك. شاركنا نوع نشاطك، حجم مخزونك الحالي، وأهم تحدٍّ تريد حله أولًا، وسنرشدك بخطوات عملية للبدء بسرعة وبناء سير عمل موثوق يدعم طلباتك وفريقك وكتالوج منتجاتك مع نمو عملك.',
      followLabel: 'تابعنا',
      formTitle: 'أرسل لنا رسالة',
      formSubtitle: 'نرد عادة خلال يوم عمل واحد.',
      fullNameLabel: 'الاسم الكامل',
      emailInputLabel: 'البريد الإلكتروني',
      messageLabel: 'رسالتك',
      submitLabel: 'إرسال الرسالة',
      sendingLabel: 'جاري الإرسال...',
      successLabel: 'تم إرسال رسالتك بنجاح.',
      fallbackLabel: 'تم فتح تطبيق البريد لديك لتتمكن من إرسال الرسالة مباشرة إلى Stockly.',
      errorLabel: 'تعذر إرسال رسالتك الآن. حاول مرة أخرى.',
    },
  },
} as const;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState<NavSection>('features');
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    message: '',
  });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({
    type: null,
    message: '',
  });
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const isArabic = language === 'ar';
  const copy = isArabic ? landingCopy.arabic : landingCopy.english;
  const landingFontFamily = isArabic ? 'Cairo, sans-serif' : 'Montserrat, sans-serif';
  const displayedFeatures = isArabic ? arabicFeatures : features;
  const displayedOperationalCards = isArabic ? arabicOperationalCards : operationalCards;
  const primaryCtaHref = isAuthenticated ? '/dashboard' : '/register';
  const pricingCtaHref = isAuthenticated ? '/subscribe' : '/register';
  const primaryCtaLabel = isAuthenticated ? copy.auth.dashboard : copy.auth.getStarted;
  const heroCtaLabel = isAuthenticated ? copy.auth.dashboard : copy.auth.getStartedFree;
  const dashboardMenuLabel = isArabic ? 'لوحة التحكم' : 'Dashboard';
  const logoutMenuLabel = isArabic ? 'تسجيل الخروج' : 'Log out';

  const displayPlans = useMemo(
    () => getMarketingPlanCards(language, billingCycle),
    [billingCycle, language]
  );
  const selectedLanguageOption = useMemo(
    () => languageOptions.find((option) => option.value === language) ?? languageOptions[0],
    [language]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!languageMenuRef.current || languageMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setIsLanguageMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    const readHashSection = (): NavSection | null => {
      const hash = window.location.hash.replace('#', '');
      if (navSections.includes(hash as NavSection)) {
        return hash as NavSection;
      }
      return null;
    };

    const updateActiveFromHash = () => {
      const hashSection = readHashSection();
      if (hashSection) {
        setActiveNavSection(hashSection);
      }
    };

    updateActiveFromHash();
    window.addEventListener('hashchange', updateActiveFromHash);

    return () => {
      window.removeEventListener('hashchange', updateActiveFromHash);
    };
  }, []);

  useEffect(() => {
    const updateActiveFromScroll = () => {
      const header = document.querySelector('header');
      const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 72;
      const triggerLine = headerHeight + 8;
      let currentSection: NavSection = 'features';
      let lastPassedSection: NavSection = 'features';

      for (const sectionId of navSections) {
        const section = document.getElementById(sectionId);
        if (!section) continue;

        const rect = section.getBoundingClientRect();

        if (rect.top <= triggerLine) {
          lastPassedSection = sectionId;
        }

        if (rect.top <= triggerLine && rect.bottom > triggerLine) {
          currentSection = sectionId;
          break;
        }
      }

      if (currentSection === 'features') {
        currentSection = lastPassedSection;
      }

      setActiveNavSection((prev) => (prev === currentSection ? prev : currentSection));
    };

    updateActiveFromScroll();
    window.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    window.addEventListener('resize', updateActiveFromScroll);

    return () => {
      window.removeEventListener('scroll', updateActiveFromScroll);
      window.removeEventListener('resize', updateActiveFromScroll);
    };
  }, []);

  const buildContactMailtoLink = () => {
    const trimmedName = contactForm.fullName.trim();
    const trimmedEmail = contactForm.email.trim();
    const trimmedMessage = contactForm.message.trim();
    const subject = trimmedName
      ? `Stockly contact form - ${trimmedName}`
      : 'Stockly contact form';
    const body = [
      trimmedName ? `Name: ${trimmedName}` : '',
      trimmedEmail ? `Email: ${trimmedEmail}` : '',
      '',
      trimmedMessage,
    ]
      .filter(Boolean)
      .join('\n');

    return `mailto:stocklydz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullName = contactForm.fullName.trim();
    const email = contactForm.email.trim();
    const message = contactForm.message.trim();

    if (!fullName || !email || !message) {
      setContactFeedback({
        type: 'error',
        message: copy.contact.errorLabel,
      });
      return;
    }

    setIsSubmittingContact(true);
    setContactFeedback({ type: null, message: '' });

    try {
      await contactAPI.sendMessage({ fullName, email, message });
      setContactForm({ fullName: '', email: '', message: '' });
      setContactFeedback({
        type: 'success',
        message: copy.contact.successLabel,
      });
    } catch (error: any) {
      const errorCode = String(error?.response?.data?.code || '').trim();
      if (!error?.response || errorCode === 'EMAIL_NOT_CONFIGURED') {
        window.location.href = buildContactMailtoLink();
        setContactFeedback({
          type: 'success',
          message: copy.contact.fallbackLabel,
        });
      } else {
        setContactFeedback({
          type: 'error',
          message: String(error?.response?.data?.message || copy.contact.errorLabel),
        });
      }
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleProfileLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FCFCFC] text-[#333333]" style={{ fontFamily: landingFontFamily }}>
      <header className="sticky top-0 z-50 border-b border-[#E2E2E2] bg-white/95 backdrop-blur" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="mx-auto flex h-[72px] w-[calc(100%-2rem)] items-center gap-6">
          <Link to="/" aria-label={copy.stocklyHome}>
            <BrandLogo markClassName="h-8 w-12" wordmarkClassName="h-8 w-28" />
          </Link>
          <div className={`${isArabic ? 'mr-auto' : 'ml-auto'} flex items-center gap-7`}>
            <nav className="hidden items-center gap-8 text-[16px] font-medium text-[#1F1F1F] md:flex">
              <a
                href="#features"
                onClick={() => setActiveNavSection('features')}
                aria-current={activeNavSection === 'features' ? 'page' : undefined}
                className="relative inline-flex items-center pb-1"
              >
                {copy.nav.features}
              </a>
              <a
                href="#niches"
                onClick={() => setActiveNavSection('niches')}
                aria-current={activeNavSection === 'niches' ? 'page' : undefined}
                className="relative inline-flex items-center pb-1"
              >
                {copy.nav.niches}
              </a>
              <a
                href="#pricing"
                onClick={() => setActiveNavSection('pricing')}
                aria-current={activeNavSection === 'pricing' ? 'page' : undefined}
                className="relative inline-flex items-center pb-1"
              >
                {copy.nav.pricing}
              </a>
              <a
                href="#contact"
                onClick={() => setActiveNavSection('contact')}
                aria-current={activeNavSection === 'contact' ? 'page' : undefined}
                className="relative inline-flex items-center pb-1"
              >
                {copy.nav.contact}
              </a>
              <div className="relative" ref={languageMenuRef}>
                <a
                  href="#"
                  aria-label={copy.selectLanguage}
                  aria-haspopup="menu"
                  aria-expanded={isLanguageMenuOpen}
                  onClick={(event) => {
                    event.preventDefault();
                    setIsLanguageMenuOpen((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5"
                >
                  <ChevronDown size={16} className={isLanguageMenuOpen ? 'rotate-180' : ''} />
                  {selectedLanguageOption.shortLabel}
                </a>
                {isLanguageMenuOpen ? (
                  <div className={`absolute top-full z-30 mt-2 w-[150px] rounded-[10px] border border-[#CFCFCF] bg-[#E8E8E8] p-2 shadow-[0_8px_20px_rgba(0,0,0,0.16)] ${isArabic ? 'right-0' : 'left-0'}`}>
                    {languageOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setLanguage(option.value);
                          setIsLanguageMenuOpen(false);
                        }}
                        className={`w-full rounded-[6px] px-3 py-2 text-[13px] ${isArabic ? 'text-right' : 'text-left'} ${
                          language === option.value ? 'bg-[#D3D3D3] font-semibold text-[#1F1F1F]' : 'font-medium text-[#2F2F2F] hover:bg-[#DCDCDC]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </nav>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <Link
                    to={primaryCtaHref}
                    className="inline-flex h-9 items-center justify-center rounded bg-[#001EF4] px-4 text-[12px] font-semibold text-white"
                  >
                    {primaryCtaLabel}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={user?.name || 'User dashboard'}
                        className="inline-flex items-center rounded-full"
                      >
                        <Avatar className="h-9 w-9 border border-[#DFDFDF]">
                          <AvatarImage src={user?.profileImageUrl || ''} alt={user?.name || 'User'} />
                          <AvatarFallback className="bg-[#495FFA] text-white">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={isArabic ? 'start' : 'end'}
                      className={`min-w-[170px] ${isArabic ? 'text-right [direction:rtl]' : ''}`}
                    >
                      <DropdownMenuItem
                        onClick={() => navigate('/dashboard')}
                        className={isArabic ? 'justify-start text-right' : ''}
                      >
                        <LayoutDashboard className={`h-4 w-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2'}`} />
                        {dashboardMenuLabel}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => void handleProfileLogout()}
                        className={isArabic ? 'justify-start text-right' : ''}
                      >
                        <LogOut className={`h-4 w-4 ${isArabic ? 'ml-2 mr-0' : 'mr-2'}`} />
                        {logoutMenuLabel}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex h-9 items-center justify-center rounded border border-[#DFDFDF] bg-white px-3 text-[12px] font-semibold text-[#222222]"
                  >
                    {copy.auth.login}
                  </Link>
                  <Link
                    to={primaryCtaHref}
                    className="inline-flex h-9 items-center justify-center rounded bg-[#001EF4] px-4 text-[12px] font-semibold text-white"
                  >
                    {primaryCtaLabel}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section
        id="hero"
        className="relative bg-cover bg-center"
        dir={isArabic ? 'rtl' : 'ltr'}
        style={{
          backgroundImage: "url('/landing-page/rectangle-31.svg')",
          height: 'clamp(520px, 72vh, 760px)',
        }}
      >
        <div className="relative flex h-full w-full items-start">
          <div className={`w-full max-w-[980px] px-4 pb-10 text-white sm:px-6 md:px-10 lg:px-16 xl:min-h-[401px] xl:max-w-none xl:px-0 xl:pb-0 ${isArabic ? 'pt-6 text-right md:pt-12 lg:pt-16 xl:mr-[8.33vw] xl:w-[calc(100%-16.66vw)] xl:pt-[64px]' : 'xl:w-[843px] pt-14 md:pt-20 lg:pt-24 xl:ml-[160px] xl:pt-[122px]'}`}>
            <h1 className={`leading-[1.06] text-[#FCFCFC] ${isArabic ? 'text-[48px] font-bold tracking-normal md:text-[66px] lg:text-[78px]' : 'text-[42px] font-extrabold tracking-[-0.02em] md:text-[58px] lg:text-[68px]'}`}>
              <span className="block md:whitespace-nowrap">
                <span className="text-[#001EF4]">{copy.hero.highlightedTitle}</span>
                {copy.hero.titleRest ? ` ${copy.hero.titleRest}` : null}
              </span>
              <span className="block">{copy.hero.titleSecondLine}</span>
            </h1>
            <p className={`mt-6 max-w-full font-bold text-[#F5F5F5] ${isArabic ? 'text-[21px] leading-[34px] md:text-[29px] md:leading-[46px]' : 'text-[18px] leading-[30px] tracking-[-0.01em] md:text-[24px] md:leading-[38px]'}`}>
              <span className={isArabic ? 'lg:whitespace-nowrap' : ''}>{copy.hero.descriptionFirstLine}</span>
              <br className="hidden md:block" />
              {copy.hero.descriptionSecondLine}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to={primaryCtaHref}
                className="inline-flex h-12 items-center justify-center rounded bg-[#001EF4] px-7 text-[16px] font-semibold leading-4 text-white"
              >
                {heroCtaLabel}
              </Link>
              <a
                href="https://www.youtube.com/@stocklydz"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded border border-[#D7D7D7] bg-[#FCFCFC] px-7 text-[16px] font-semibold leading-4 text-[#1F1F1F]"
              >
                <Video size={16} />
                {copy.hero.secondaryCta}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="h-[140px] bg-[#FCFCFC]" aria-hidden="true" />

      <section id="features" className="pt-0 pb-6 scroll-mt-[88px]" dir={isArabic ? 'rtl' : 'ltr'} style={{ marginTop: '0px' }}>
        <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-10">
          <div className="text-center">
            <h2
              className={`text-[36px] leading-[1.08] text-[#333333] ${isArabic ? 'font-bold tracking-normal' : 'font-semibold tracking-[-0.015em]'}`}
              style={{ fontFamily: landingFontFamily }}
            >
              {copy.features.heading}
            </h2>
            <p className={`mx-auto mt-4 max-w-[1320px] text-[clamp(1.05rem,1.4vw,1.55rem)] font-medium leading-[1.4] text-[#3F3F3F] ${isArabic ? 'tracking-normal' : 'tracking-[-0.01em]'}`}>
              {copy.features.description}
            </p>
          </div>
          <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:mt-6 xl:grid-cols-[repeat(3,360px)] xl:justify-center xl:gap-x-[110px]">
            {displayedFeatures.map((feature) => {
              return (
                <article
                  key={feature.title}
                  className="group flex w-full items-start gap-4 transition-transform duration-200 hover:-translate-y-0.5 xl:w-[360px]"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[6px] bg-[#E8E8E8] transition-all duration-200 group-hover:bg-white group-hover:shadow-[0_8px_16px_rgba(0,0,0,0.12)]">
                    <img src={feature.iconSrc} alt="" className="h-16 w-16 object-contain" />
                  </div>
                  <div className={`min-w-0 flex-1 xl:max-w-[280px] ${isArabic ? 'text-right' : 'text-left'}`}>
                    <h3 className="text-lg font-bold leading-[1.2] text-[#222222]">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-[1.45] text-[#3D3D3D]">{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12" dir={isArabic ? 'rtl' : 'ltr'} style={{ marginTop: '4px' }}>
        <div className={`grid w-full items-center gap-5 px-4 sm:px-6 ${isArabic ? 'lg:grid-cols-[1.18fr,0.82fr] lg:pr-10 lg:pl-0' : 'lg:grid-cols-[0.82fr,1.18fr] lg:pl-10 lg:pr-0'}`}>
          {isArabic && (
            <div className="overflow-hidden lg:rounded-r">
              <img
                src="/landing-page/rectangle-27.svg"
                alt="Stockly on tablet by the beach"
                className="block w-full object-cover lg:mr-auto lg:w-[120%] lg:max-w-none"
                style={{
                  WebkitMaskImage: 'linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.9) 34%, rgba(0, 0, 0, 1) 58%)',
                  maskImage: 'linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.9) 34%, rgba(0, 0, 0, 1) 58%)',
                  WebkitMaskSize: '100% 100%',
                  maskSize: '100% 100%',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                }}
              />
            </div>
          )}
          <div className={`relative z-10 max-w-[860px] ${isArabic ? 'pl-4 sm:pl-6 lg:-ml-28 lg:-translate-x-20 lg:pl-0 xl:-ml-40 xl:-translate-x-28 text-right' : 'pr-4 sm:pr-6 lg:-mr-28 lg:translate-x-20 lg:pr-0 xl:-mr-40 xl:translate-x-28'}`}>
            <h2
              className="text-[clamp(2.45rem,4.8vw,4.15rem)] font-bold leading-[0.98] tracking-[-0.02em] text-[#313131]"
              style={{ fontFamily: landingFontFamily }}
            >
              <span className="text-[#001EF4]">{copy.section.headingFirstWord}</span>{' '}
              {copy.section.headingLines[0]}
              <br />
              {copy.section.headingLines[1]}
            </h2>
            <p
              className="mt-6 max-w-[52rem] text-[clamp(1.08rem,1.75vw,1.9rem)] font-medium leading-[1.22] text-[#3A3A3A]"
              style={{ fontFamily: landingFontFamily }}
            >
              {copy.section.descriptionLines.map((line, index) => (
                <span key={index} className="block md:whitespace-nowrap">
                  {line}
                </span>
              ))}
            </p>
          </div>
          {!isArabic && (
            <div className="overflow-hidden lg:rounded-l">
              <img
                src="/landing-page/rectangle-27.svg"
                alt="Stockly on tablet by the beach"
                className="block w-full object-cover lg:ml-auto lg:w-[120%] lg:max-w-none"
                style={{
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.9) 34%, rgba(0, 0, 0, 1) 58%)',
                  maskImage: 'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.9) 34%, rgba(0, 0, 0, 1) 58%)',
                  WebkitMaskSize: '100% 100%',
                  maskSize: '100% 100%',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                }}
              />
            </div>
          )}
        </div>
      </section>
      <section className="py-6" dir={isArabic ? 'rtl' : 'ltr'} style={{ marginTop: '12px' }}>
        <div className="mx-auto grid w-[min(1320px,calc(100%-2rem))] gap-5 lg:grid-cols-3 lg:gap-[60px]">
          {displayedOperationalCards.map((card) => (
            <article
              key={card.title}
              className="group flex h-full cursor-default rounded-[8px] border border-[#D6D8E2] bg-[#F8F8FB] p-4 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className={`${isArabic ? 'ml-3' : 'mr-3'} mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-[#DEE2EE] bg-white`}>
                <img src={card.iconSrc} alt="" className="h-8 w-auto" />
              </div>
              <div className={`min-w-0 flex-1 ${isArabic ? 'text-right' : 'text-left'}`}>
                <h3 className="text-[1.38rem] font-bold leading-[1.18] text-[#1F1F1F]">{card.title}</h3>
                <p className="mt-1 text-[1.02rem] leading-[1.55] text-[#3A3A3A]">{card.description}</p>
                {card.cta ? (
                  <Link
                    to={primaryCtaHref}
                    className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-[6px] bg-[#001EF4] px-4 text-[13px] font-semibold text-white"
                  >
                    {card.cta}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

              <section id="niches" className="pt-12 pb-[10px] scroll-mt-[88px]" dir={isArabic ? 'rtl' : 'ltr'} style={{ marginTop: '12px' }}>
        <div className="mx-auto w-[min(1320px,calc(100%-2rem))]">
          <h2 className="text-center text-[clamp(1.6rem,3vw,2.3rem)] font-semibold text-[#222222]">
              {isArabic ? 'مصمم لحجم صناعتك' : 'Tailored for the Scale of Your Industry'}
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
           {(isArabic ? arabicIndustries : industries).map((industry) => (
              <article
                key={industry.title}
                className="group overflow-hidden rounded border border-[#D6D6D6] bg-[#FCFCFC] shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[#1D4BFF] hover:shadow-[0_12px_24px_rgba(0,0,0,0.14)]"
              >
                <div className="relative">
                  <img
                    src={industry.image}
                    alt={industry.title}
                    className="block aspect-square w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(12,15,22,0.3)_0%,rgba(12,15,22,0.65)_100%)] px-4 py-3">
                    <h3 className="text-2xl font-normal tracking-[-0.01em] text-white">{industry.title}</h3>
                  </div>
                </div>
                <div className="flex min-h-[190px] flex-col p-3">
                  <p className="flex-1 text-xs leading-[1.45] text-[#3C3C3C]">{industry.copy}</p>
                  <Link
                    to="/dashboard"
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded bg-[#495FFA] px-3 text-[11px] font-semibold text-white"
                  >
                    {isArabic ? 'احصل على حلك' : 'Claim Your Solution'}                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-[#DEDEDE] bg-[#F0F0F0] pt-[45px] pb-12 scroll-mt-[88px]" dir="ltr" style={{ marginTop: '45px' }}>        <div className="mx-auto w-[min(1320px,calc(100%-2rem))]">
          <div className="text-center">
            <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-semibold text-[#222222]" dir={isArabic ? 'rtl' : 'ltr'}>
  {isArabic ? 'أسعار بسيطة وشفافة' : 'Simple, Transparent Pricing'}
            </h2>
            <p className="mx-auto mt-2 max-w-3xl text-sm text-[#464646]" dir={isArabic ? 'rtl' : 'ltr'}>
  {isArabic ? 'اختر الخطة المناسبة لعملك. يمكنك الترقية في أي وقت مع نمو أعمالك.' : 'Choose the plan that fits your business. Upgrade anytime as you grow.'}
              </p>
            <div className="mx-auto mt-4 grid h-9 w-44 grid-cols-2 gap-1 rounded-full border border-[#D8D8D8] bg-[#F8F8F8] p-1">
              <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`rounded-full text-[11px] font-semibold ${billingCycle === 'monthly' ? 'bg-[#001EF4] text-white' : 'text-[#4B4B4B]'}`}
>
                  {isArabic ? 'شهري' : 'Monthly'}
                </button>
                <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={`rounded-full text-[11px] font-semibold ${billingCycle === 'yearly' ? 'bg-[#001EF4] text-white' : 'text-[#4B4B4B]'}`}
>
                      {isArabic ? 'سنوي' : 'Yearly'}
                </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-[40px]">
            {displayPlans.map((plan) => (
              <article
                key={plan.id}
                className={`group flex min-h-[540px] flex-col overflow-hidden rounded-[12px] border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-250 ease-out hover:-translate-y-1 hover:border-[#1D4BFF] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)] ${
                  'border-[#D5D5D5]'
                }`}
              >
                {/* Inner card - starts from very top, contains badge + price */}
                <div
                  className={`mx-4 mt-4 mb-4 overflow-hidden rounded-[10px] border shadow-[0_3px_4px_rgba(0,0,0,0.35)] transition-shadow duration-300 ease-out group-hover:shadow-[0_4px_6px_rgba(0,0,0,0.4)] ${
                    plan.highlighted ? 'border-[#E0E0E0]' : 'border-[#E0E0E0]'
                  }`}
                >
                  {/* Gray zone - badge + price */}
                  <div
                    className={`flex min-h-[170px] flex-col items-start justify-between px-4 pt-4 pb-5 ${
                      plan.highlighted ? 'bg-[#4458F7]' : 'bg-[#EBEBEB]'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                          plan.highlighted
                            ? 'border-[#6F7EFF] bg-[#5D6EF9] text-white'
                            : 'border-[#CFCFCF] bg-[#F5F5F5] text-[#4B4B4B]'
                        }`}
                        dir={isArabic ? 'rtl' : 'ltr'}
                      >
                        {plan.name}
                      </span>
                      {plan.badge ? (
                        <span className="rounded-full bg-[#F2700F] px-2 py-1 text-[10px] font-bold text-white" dir={isArabic ? 'rtl' : 'ltr'}>{plan.badge}</span>
                      ) : null}
                    </div>
                    <p
                      className={`text-[24px] font-bold leading-snug ${
                        plan.highlighted ? 'text-white' : 'text-[#1F1F1F]'
                      }`}
                      dir={isArabic ? 'rtl' : 'ltr'}
                    >
                      {plan.visiblePrice}
                    </p>
                  </div>
                  {/* White zone - description + button */}
                  <div className="bg-white px-4 pt-3 pb-4">
                    <p className="text-[14px] text-[#3D3D3D]" dir={isArabic ? 'rtl' : 'ltr'}>
                      {plan.description}
                    </p>
                    <Link
                      to={pricingCtaHref}
                      className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-[6px] bg-[#001EF4] px-4 text-[13px] font-semibold text-white"
                    >
                      {isArabic ? 'اشترك الآن' : 'Subscribe Now'}
                    </Link>
                  </div>
                </div>

                {/* Features list */}
                <div className="bg-white px-5 py-5">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.label}
                        className="flex min-h-[26px] items-start gap-2.5 text-[14px] text-[#2E2E2E]"
                      >
                        {feature.included ? (
                          <Check size={14} className="mt-[2px] shrink-0 text-[#1D4BFF]" />
                        ) : (
                          <X size={14} className="mt-[2px] shrink-0 text-[#B73232]" />
                        )}
                        <span className="leading-[1.2]" dir={isArabic ? 'rtl' : 'ltr'}>{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className="group mt-4 rounded-[12px] border border-[#D4D4D4] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-250 ease-out hover:-translate-y-1 hover:border-[#1D4BFF] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
            <div className="grid gap-4 lg:grid-cols-[1fr,auto] lg:items-center">
              <div className="overflow-hidden rounded-[10px] border border-[#E0E0E0] bg-white shadow-[0_3px_4px_rgba(0,0,0,0.18)] transition-shadow duration-300 ease-out group-hover:shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
                <div className="grid lg:grid-cols-[2fr,3fr]">
                  <div className="bg-[#EFEFEF] p-5 lg:min-h-[168px]">
                    <h3 className="text-[36px] font-bold text-[#252525]">
  <span className="text-[#001EF4]">{isArabic ? 'مخصص' : 'Custom'}</span> {isArabic ? 'خطة' : 'Plan'}
                  </h3>
                  <p className="mt-2 text-[18px] font-semibold text-[#2F2F2F] leading-[1.35]">
                    {isArabic ? (
    <>
      خطة مرنة مصممة حول
      <br />
      احتياجات عملك بالضبط.
    </>
  ) : (
    <>
      Flexible plan designed around
      <br />
      your exact business needs.
    </>
  )}
</p>
                  </div>
                  <div className="border-t border-[#E0E0E0] bg-white pl-4 pr-2 py-4 lg:min-h-[168px] lg:border-t-0 lg:border-l">
                  <ul className="space-y-2 text-[13px] text-[#2F2F2F]">
  <li className="flex items-center gap-2">
    <Check size={13} className="text-[#1D4BFF]" /> {isArabic ? 'إعداد مخصص مصمم لسير عمل عملك الفريد' : 'Custom setup designed for your unique business workflow'}
  </li>
  <li className="flex items-center gap-2">
    <Check size={13} className="text-[#1D4BFF]" /> {isArabic ? 'كل شيء مضمّن من خطط أساسي وبريميوم وبرو' : 'Everything fully included from Basic, Premium, and Pro plans'}
  </li>
  <li className="flex items-center gap-2">
    <Check size={13} className="text-[#1D4BFF]" /> {isArabic ? 'ميزات مرنة مصممة بعناية بناءً على احتياجاتك المحددة' : 'Flexible features carefully tailored based on your specific needs'}
  </li>
  <li className="flex items-center gap-2">
    <Check size={13} className="text-[#1D4BFF]" /> {isArabic ? 'دعم أولوي مع تأهيل وتدريب مخصص' : 'Priority support with dedicated onboarding and training'}
  </li>
</ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-end self-end">
                <a
                  href="#contact"
                  onClick={() => setActiveNavSection('contact')}
                  className="inline-flex h-9 w-[160px] items-center justify-center rounded bg-[#001EF4] text-[11px] font-semibold text-white"
                >
                  {isArabic ? 'تواصل معنا' : 'Contact Us'}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-[#F0F0F0] pb-12 pt-20 scroll-mt-[88px]" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="mx-auto grid w-[min(1240px,calc(100%-2rem))] gap-8 lg:grid-cols-[1fr,0.92fr]">
          <div className={isArabic ? 'text-right' : 'text-left'}>
            <h2 className={`text-[clamp(2rem,4vw,3.2rem)] text-[#1F1F1F] ${isArabic ? 'font-bold' : 'font-semibold'}`}>
              <span className="text-[#001EF4]">{copy.contact.titleHighlight}</span> {copy.contact.titleRest}
            </h2>
            <p className="mt-3 max-w-sm text-[clamp(1.2rem,2.2vw,1.5rem)] font-semibold leading-tight text-[#2F2F2F]">
              {copy.contact.intro}
            </p>
            <div className="mt-6 space-y-1">
              <p className="text-xs font-semibold text-[#3D3D3D]">{copy.contact.emailLabel}</p>
              <p className="text-xs text-[#3D3D3D]" dir="ltr">stocklydz@gmail.com</p>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-xs font-semibold text-[#3D3D3D]">{copy.contact.phoneLabel}</p>
              <p className="text-xs text-[#3D3D3D]" dir="ltr">+213 664 449 156</p>
            </div>
            <p className="mt-6 max-w-xl text-xs leading-relaxed text-[#3D3D3D]">
              {copy.contact.description}
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold text-[#3D3D3D] mb-2">{copy.contact.followLabel}</p>
              <div className="flex flex-wrap gap-2">
                <a href="https://www.facebook.com/share/18LMHg3d7h/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook" className="text-[#1F1F1F] hover:text-[#001EF4]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-1.57 19.88v-7.03H8.07v-2.85h2.36V9.71c0-2.33 1.39-3.62 3.53-3.62 1.02 0 2.08.18 2.08.18v2.3H15.86c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.85h-2.2v7.03A10 10 0 0 0 12 2Z"/></svg>
                </a>
                <a href="https://www.instagram.com/stockly.dz?igsh=MTR2MnN3amVrODdubA==" target="_blank" rel="noreferrer" aria-label="Instagram" className="text-[#1F1F1F] hover:text-[#001EF4]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="5" ry="5" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
                  </svg>
                </a>
                <a href="https://www.linkedin.com/company/stocklydz/" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="text-[#1F1F1F] hover:text-[#001EF4]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
                    <circle cx="8.6" cy="8.1" r="1.4" fill="white" />
                    <rect x="7.2" y="10.2" width="2.6" height="7.2" fill="white" />
                    <path
                      d="M12.2 10.2h2.4v1.2h.04c.34-.62 1.2-1.3 2.48-1.3 2.64 0 3.12 1.74 3.12 4.02V17.4h-2.6v-3.54c0-1.06-.02-2.42-1.48-2.42-1.48 0-1.7 1.15-1.7 2.34v3.62h-2.3v-7.2Z"
                      fill="white"
                    />
                  </svg>
                </a>
                <a href="https://www.youtube.com/@stocklydz" target="_blank" rel="noreferrer" aria-label="YouTube" className="text-[#1F1F1F] hover:text-[#001EF4]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M23.5 7.2a4 4 0 0 0-2.8-2.8C18.5 4 12 4 12 4s-6.5 0-8.7.4a4 4 0 0 0-2.8 2.8A41.2 41.2 0 0 0 0 12a41.2 41.2 0 0 0 .5 4.8 4 4 0 0 0 2.8 2.8c2.2.4 8.7.4 8.7.4s6.5 0 8.7-.4a4 4 0 0 0 2.8-2.8A41.2 41.2 0 0 0 24 12a41.2 41.2 0 0 0-.5-4.8ZM9.7 15.5V8.5l6.3 3.5-6.3 3.5Z"/></svg>
                </a>
                <a href="https://www.tiktok.com/@stocklydz" target="_blank" rel="noreferrer" aria-label="TikTok" className="text-[#1F1F1F] hover:text-[#001EF4]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M21 7.2a6.8 6.8 0 0 1-4.1-1.3v8.1a6 6 0 1 1-5.2-5.9v3.2a2.8 2.8 0 1 0 2 2.7V2h3.2a6.8 6.8 0 0 0 4.1 4.7Z"/></svg>
                </a>
              </div>
            </div>
          </div>

          <div className={`group rounded border border-[#DDDDDD] bg-[#FCFCFC] p-6 shadow-sm transition-all duration-250 ease-out hover:-translate-y-1 hover:border-[#1D4BFF] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)] ${isArabic ? 'text-right' : 'text-left'}`}>
            <h3 className="text-xl font-bold text-[#222222]">{copy.contact.formTitle}</h3>
            <p className="mt-1 text-xs text-[#4B4B4B]">{copy.contact.formSubtitle}</p>
            {contactFeedback.type ? (
              <div
                className={`mt-4 rounded border px-3 py-2 text-xs ${
                  contactFeedback.type === 'success'
                    ? 'border-[#B8DFC6] bg-[#F1FBF4] text-[#21633B]'
                    : 'border-[#E2B7B7] bg-[#FFF3F3] text-[#9A2F2F]'
                }`}
              >
                {contactFeedback.message}
              </div>
            ) : null}
            <form onSubmit={handleContactSubmit} className="mt-4 pb-16">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#2F2F2F]">
                  {copy.contact.fullNameLabel}
                  <input
                    type="text"
                    value={contactForm.fullName}
                    onChange={(event) =>
                      setContactForm((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    required
                    className="mt-1 w-full rounded border border-[#D2D2D2] bg-white px-3 py-2 text-sm outline-none focus:border-[#001EF4]"
                  />
                </label>
                <label className="text-xs font-semibold text-[#2F2F2F]">
                  {copy.contact.emailInputLabel}
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(event) =>
                      setContactForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    required
                    className="mt-1 w-full rounded border border-[#D2D2D2] bg-white px-3 py-2 text-sm outline-none focus:border-[#001EF4]"
                  />
                </label>
              </div>
              <label className="mt-3 block text-xs font-semibold text-[#2F2F2F]">
                {copy.contact.messageLabel}
                <textarea
                  rows={5}
                  value={contactForm.message}
                  onChange={(event) =>
                    setContactForm((prev) => ({ ...prev, message: event.target.value }))
                  }
                  required
                  className="mt-1 w-full rounded border border-[#D2D2D2] bg-white px-3 py-2 text-sm outline-none focus:border-[#001EF4]"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmittingContact}
                className="mt-16 inline-flex h-9 w-full items-center justify-center rounded bg-[#001EF4] px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingContact ? copy.contact.sendingLabel : copy.contact.submitLabel}
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer
        id="footer"
        className="border-t border-[#DCDCDC] bg-[#FCFCFC] pb-[72px] pt-[104px]"
        dir={isArabic ? 'rtl' : 'ltr'}
        style={{ backgroundColor: '#FCFCFC' }}
      >
        <div className="mx-auto w-[min(1240px,calc(100%-2rem))]">
          <BrandLogo markClassName="h-7 w-11" wordmarkClassName="h-7 w-24" />
          <p className="mt-3 text-[clamp(1.7rem,4vw,3rem)] font-semibold leading-tight text-[#262626]">
            <span className="text-[#001EF4]">{isArabic ? 'إدارة سهلة وذكية' : 'Easy & Smart'}</span>{' '}
            {isArabic ? '' : 'management'}
            <br />
            {isArabic ? 'لنمو أفضل' : 'Better Growth'}
          </p>
        </div>
        <div className="mx-auto mt-[55px] flex w-[min(1240px,calc(100%-2rem))] flex-col gap-3 text-[11px] text-[#5A5A5A] sm:flex-row sm:items-center sm:justify-between">
          <span>{isArabic ? '© 2026 ستوكلي. جميع الحقوق محفوظة.' : '© 2026 Stockly. All rights reserved.'}</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/privacy" className="hover:text-[#001EF4]">
              {isArabic ? 'الخصوصية' : 'Privacy'}
            </Link>
            <Link to="/terms" className="hover:text-[#001EF4]">
              {isArabic ? 'الشروط' : 'Terms'}
            </Link>
            <a
              href="#contact"
              onClick={() => setActiveNavSection('contact')}
              className="hover:text-[#001EF4]"
            >
              {isArabic ? 'الدعم' : 'Support'}
            </a>
          </div>
        </div>
      </footer>

      <div className="border-t border-[#DCDCDC] bg-[#F0F0F0] h-[72px]" />
    </div>
  );
};

export default LandingPage;
