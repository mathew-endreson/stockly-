import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { getLocalizedSeo, useSeo } from '@/lib/seo';
import { Button } from '@/components/ui/button';

const PrivacyPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const seo = getLocalizedSeo('privacy', language);

  useSeo({
    ...seo,
    canonicalPath: '/privacy',
    language,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-slate-900 dark:text-white">
            Stockly
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/contact">
              <Button variant="outline" size="sm">
                {t('common.contact', 'Contact')}
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm">{t('auth.signIn', 'Sign In')}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
          {t('legal.privacy.title', 'Privacy Policy')}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          {t(
            'legal.privacy.subtitle',
            'This page explains how Stockly collects, uses, and protects your data.'
          )}
        </p>

        <div className="mt-8 space-y-6 text-slate-700 dark:text-slate-200 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.privacy.collectTitle', 'Data We Collect')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.privacy.collectBody',
                'We collect account information you provide (such as your name and email) and business data you enter (such as products, sales, and invoices) to deliver the service.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.privacy.useTitle', 'How We Use Data')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.privacy.useBody',
                'We use your data to operate the app, provide analytics and features you request, and improve product performance and reliability.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.privacy.securityTitle', 'Data Security')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.privacy.securityBody',
                'We apply security controls to protect your data. You are responsible for keeping your login credentials secure and limiting access for team members.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.contactTitle', 'Contact')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.privacy.contactBodyPrefix',
                'If you have questions about privacy, contact us through the'
              )}{' '}
              <Link className="text-emerald-600 hover:underline" to="/contact">
                {t('legal.contactPage', 'contact page')}
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;

