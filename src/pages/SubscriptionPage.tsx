import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Moon, Sun, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/BrandLogo';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import SubscriptionPanel from '@/components/SubscriptionPanel';

const SubscriptionPage: React.FC = () => {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#001EF4]/5 to-[#001EF4]/5 rounded-full blur-3xl" />
        </div>

        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Link to="/" className="inline-flex items-center">
                <BrandLogo
                  markClassName="h-7 w-12"
                  wordmarkClassName="text-3xl"
                />
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Globe className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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

              {isAuthenticated ? null : (
                <Link to="/login">
                  <Button variant="outline">{t('auth.signIn', 'Sign In')}</Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-12 sm:py-16 space-y-6">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              {t('subscription.upgradeAccess', 'Upgrade Access')}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              {t('settings.subscription', 'Subscription')}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              {t('settings.subscriptionRequiredMsg', 'Please upgrade your subscription to access this feature.')}
            </p>
          </div>

          <SubscriptionPanel />
        </main>
      </div>
    </div>
  );
};

export default SubscriptionPage;

