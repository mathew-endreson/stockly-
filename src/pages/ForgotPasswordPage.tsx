import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authAPI } from '@/services/api';

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await authAPI.forgotPassword(email);
      setIsSent(true);
    } catch (requestError: unknown) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        setError(
          requestError.response?.data?.message ||
            t(
              'auth.forgotPasswordError',
              'Failed to send password reset email. Please try again.'
            )
        );
      } else {
        setError(
          t('auth.forgotPasswordError', 'Failed to send password reset email. Please try again.')
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link to="/" className="inline-flex items-center">
            <BrandLogo
              markClassName="h-12 w-20"
              wordmarkClassName="text-5xl"
            />
          </Link>
        </div>

        <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-emerald-100 dark:border-emerald-900/50">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">
              {t('auth.forgotPasswordTitle', 'Forgot password')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t(
                'auth.forgotPasswordSubtitle',
                "Enter your email and we'll send you a reset link."
              )}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isSent ? (
            <Alert className="mb-4">
              <MailCheck className="h-4 w-4" />
              <AlertDescription>
                {t(
                  'auth.forgotPasswordEmailSent',
                  'If an account exists for this email, a password reset link has been sent.'
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('auth.emailPlaceholder', 'you@example.com')}
                required
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#001EF4] to-[#001EF4] hover:from-[#001EF4] hover:to-[#001EF4] text-white shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.sending', 'Sending...')}
                </>
              ) : (
                t('auth.sendResetLink', 'Send reset link')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t('auth.backTo', 'Back to')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('auth.signIn', 'Sign in')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
