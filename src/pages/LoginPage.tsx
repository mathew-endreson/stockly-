import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/services/api';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isLoading, error, clearError, updateUser, refreshAccessibleStocks } = useAuth();
  const invitationToken = searchParams.get('token');
  const invitationEmail = searchParams.get('email') || '';
  
  const [formData, setFormData] = useState({
    email: invitationEmail,
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
    if (invitationError) setInvitationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvitationError(null);
    try {
      const loggedInUser = await login({
        email: formData.email,
        password: formData.password,
      });
      if (invitationToken) {
        try {
          await authAPI.respondToInvitation(invitationToken, true);
          const response = await authAPI.getMe();
          updateUser(response.data.user);
          await refreshAccessibleStocks();
        } catch (inviteError: unknown) {
          const inviteMessage = axios.isAxiosError<{ message?: string }>(inviteError)
            ? inviteError.response?.data?.message
            : undefined;
          setInvitationError(
            inviteMessage || t('invitations.acceptFailed', 'Failed to accept invitation')
          );
          return;
        }
        navigate('/dashboard');
        return;
      }
      navigate(loggedInUser.isSubscribed ? '/dashboard' : '/subscribe');
    } catch {
      // Error is handled by auth context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="inline-flex items-center">
            <BrandLogo
              markClassName="h-12 w-20"
              wordmarkClassName="text-5xl"
            />
          </Link>
        </div>

        {/* Login Card */}
        <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-emerald-100 dark:border-emerald-900/50">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{t('auth.welcome')}</h1>
            <p className="text-muted-foreground mt-1">{t('auth.welcomeSubtitle')}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {invitationToken && (
            <Alert className="mb-4">
              <AlertDescription>
                {t(
                  'invitations.loginRequired',
                  'Please sign in with the invited email to accept this invitation.'
                )}
              </AlertDescription>
            </Alert>
          )}
          {invitationError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{invitationError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                disabled={Boolean(invitationToken && invitationEmail)}
                required
                className={`mt-1 ${invitationToken && invitationEmail ? 'bg-muted' : ''}`}
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
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={formData.rememberMe}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, rememberMe: checked as boolean }))
                  }
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                  {t('auth.rememberMe', 'Remember me')}
                </Label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                {t('auth.forgotPassword')}
              </Link>
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
                t('auth.signIn')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {invitationToken
                ? t(
                    'invitations.existingAccountOnly',
                    'This invitation can only be accepted with an existing account.'
                  )
                : (
                  <>
                    {t('auth.noAccount')}{' '}
                    <Link to="/register" className="text-primary hover:underline font-medium">
                      {t('auth.signUp')}
                    </Link>
                  </>
                )}
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            {t('common.backToHome', 'Back to home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

