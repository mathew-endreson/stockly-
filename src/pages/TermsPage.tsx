import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { getLocalizedSeo, useSeo } from '@/lib/seo';
import { Button } from '@/components/ui/button';

const TermsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const seo = getLocalizedSeo('terms', language);

  useSeo({
    ...seo,
    canonicalPath: '/terms',
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
            <Link to="/privacy">
              <Button variant="outline" size="sm">
                {t('common.privacy', 'Privacy')}
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
          {t('legal.terms.title', 'Terms of Service')}
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          {t('legal.terms.subtitle', 'These terms govern your access to and use of Stockly.')}
        </p>

        <div className="mt-8 space-y-6 text-slate-700 dark:text-slate-200 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.terms.usingServiceTitle', 'Using the Service')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.terms.usingServiceBody',
                'You agree to use Stockly responsibly and comply with applicable laws. You are responsible for the data you enter and for controlling access for your team.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.terms.accountsTitle', 'Accounts and Security')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.terms.accountsBody',
                'Keep your credentials secure. If you suspect unauthorized access, update your password and contact us.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.terms.availabilityTitle', 'Availability')}
            </h2>
            <p className="mt-2">
              {t(
                'legal.terms.availabilityBody',
                'We work to keep the service available, but outages can happen. Maintain backups of critical data.'
              )}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('legal.contactTitle', 'Contact')}
            </h2>
            <p className="mt-2">
              {t('legal.terms.contactBodyPrefix', 'Questions about these terms? Reach us via the')}{' '}
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

export default TermsPage;

