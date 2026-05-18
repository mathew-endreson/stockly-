import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import BrandLogo from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authAPI } from '@/services/api';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError(
        t(
          'auth.resetTokenMissing',
          'Reset token is missing. Please request a new reset link.'
        )
      );
      return;
    }
    if (formData.password.length < 6) {
      setError(t('auth.passwordMinLength', 'Password must be at least 6 characters'));
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordsDoNotMatch', 'Passwords do not match'));
      return;
    }

    setIsSubmitting(true);
    try {
      await authAPI.resetPassword({
        token,
        password: formData.password
      });
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (requestError: unknown) {
      if (axios.isAxiosError<{ message?: string }>(requestError)) {
        setError(
          requestError.response?.data?.message ||
            t(
              'auth.resetPasswordError',
              'Failed to reset password. Please request a new reset link.'
            )
        );
      } else {
        setError(
          t('auth.resetPasswordError', 'Failed to reset password. Please request a new reset link.')
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
              {t('auth.resetPasswordTitle', 'Set new password')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('auth.resetPasswordSubtitle', 'Enter your new password below.')}
            </p>
          </div>

          {!token && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {t(
                  'auth.resetTokenMissingInvalid',
                  'Reset token is missing or invalid. Please request a new reset link.'
                )}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isSuccess && (
            <Alert className="mb-4">
              <AlertDescription>
                {t(
                  'auth.resetPasswordSuccess',
                  'Password reset successful. Redirecting to sign in...'
                )}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">{t('auth.newPassword', 'New password')}</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="********"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">
                {t('auth.confirmNewPassword', 'Confirm new password')}
              </Label>
              <div className="relative mt-1">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  placeholder="********"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#001EF4] to-[#001EF4] hover:from-[#001EF4] hover:to-[#001EF4] text-white shadow-lg"
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('auth.resettingPassword', 'Resetting...')}
                </>
              ) : (
                t('auth.resetPasswordAction', 'Reset password')
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

export default ResetPasswordPage;
