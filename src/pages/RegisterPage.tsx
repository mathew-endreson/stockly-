import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { getOrCreateTrialDeviceId } from '@/lib/trialDevice';


const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
    if (validationError) setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (formData.password.length < 6) {
      setValidationError(t('auth.passwordMinLength', 'Password must be at least 6 characters'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setValidationError(t('auth.passwordsDoNotMatch', 'Passwords do not match'));
      return;
    }

    try {
      const registeredUser = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        trialDeviceId: getOrCreateTrialDeviceId(),
      });
      navigate(registeredUser?.isSubscribed ? '/dashboard' : '/subscribe');
    } catch {
      // Error is handled by auth context
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
            <h1 className="text-2xl font-bold">{t('auth.createAccount')}</h1>
            <p className="text-muted-foreground mt-1">{t('auth.registerSubtitle')}</p>
          </div>

          {(error || validationError) && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error || validationError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">{t('auth.name')}</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="********"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('auth.minimumSixChars', 'Minimum 6 characters')}
              </p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm Password')}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="********"
                required
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#001EF4] to-[#001EF4] hover:from-[#001EF4] hover:to-[#001EF4] text-white shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('auth.signUp')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t('auth.signIn')}
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('common.backToHome', 'Back to home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

