import React from 'react';
import LandingPage from '@/pages/LandingPage';
import { useLanguage } from '@/context/LanguageContext';
import { getLocalizedSeo, useSeo } from '@/lib/seo';

const HomePage: React.FC = () => {
  const { language } = useLanguage();
  const seo = getLocalizedSeo('home', language);

  useSeo({
    ...seo,
    canonicalPath: '/',
    language,
  });

  return <LandingPage />;
};

export default HomePage;

