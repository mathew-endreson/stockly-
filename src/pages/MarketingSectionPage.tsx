import React, { useEffect } from 'react';
import LandingPage from '@/pages/LandingPage';
import { useLanguage } from '@/context/LanguageContext';
import { getLocalizedSeo, type SeoPageKey, useSeo } from '@/lib/seo';

type MarketingSectionPageProps = {
  sectionId: string;
  seoPage: SeoPageKey;
  canonicalPath: string;
};

const MarketingSectionPage: React.FC<MarketingSectionPageProps> = ({
  sectionId,
  seoPage,
  canonicalPath,
}) => {
  const { language } = useLanguage();
  const seo = getLocalizedSeo(seoPage, language);

  useSeo({ ...seo, canonicalPath, language });

  useEffect(() => {
    // Ensure we land on the right section even in SPA navigation.
    const t = window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 0);
    return () => window.clearTimeout(t);
  }, [sectionId]);

  return <LandingPage />;
};

export default MarketingSectionPage;

