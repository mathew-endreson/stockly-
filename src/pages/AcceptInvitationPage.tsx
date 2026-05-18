import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/services/api';

const AcceptInvitationPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    error: authError,
    user,
    isAuthenticated,
    updateUser,
    refreshAccessibleStocks
  } = useAuth();

  const token = searchParams.get('token');

  const [invitationData, setInvitationData] = useState<{
    email: string;
    name: string;
    role: string;
    invitedBy: string;
  } | null>(null);

  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerificationError(t('invitations.noToken', 'No invitation token provided'));
        setIsVerifying(false);
        return;
      }

      try {
        const response = await authAPI.verifyInvitation(token);
        setInvitationData(response.data);
      } catch (error: unknown) {
        const message = axios.isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message
          : undefined;
        setVerificationError(
          message || t('invitations.invalidOrExpired', 'Invalid or expired invitation')
        );
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token, t]);

  const handleAcceptExisting = async () => {
    if (!token) {
      setValidationError(t('invitations.tokenMissing', 'Invitation token is missing'));
      return;
    }
    try {
      await authAPI.respondToInvitation(token, true);
      const response = await authAPI.getMe();
      updateUser(response.data.user);
      await refreshAccessibleStocks();
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setValidationError(message || t('invitations.acceptFailed', 'Failed to accept invitation'));
    }
  };

  const handleDeclineExisting = async () => {
    if (!token) {
      setValidationError(t('invitations.tokenMissing', 'Invitation token is missing'));
      return;
    }
    try {
      await authAPI.respondToInvitation(token, false);
      await refreshAccessibleStocks();
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      setValidationError(message || t('invitations.declineFailed', 'Failed to decline invitation'));
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'viewer':
        return t('invitations.roleViewer', 'Viewer (View Only)');
      case 'seller':
        return t('invitations.roleSeller', 'Seller (Orders Only)');
      case 'editor':
        return t('invitations.roleEditor', 'Editor (View & Edit)');
      case 'manager':
        return t('invitations.roleManager', 'Manager (Full Access)');
      default:
        return role;
    }
  };

  const loginUrl = token
    ? `/login?token=${encodeURIComponent(token)}${
      invitationData?.email ? `&email=${encodeURIComponent(invitationData.email)}` : ''
    }`
    : '/login';

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-muted-foreground">{t('invitations.verifying', 'Verifying invitation...')}</span>
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Link to="/" className="inline-flex items-center">
              <BrandLogo
                markClassName="h-12 w-20"
                wordmarkClassName="text-5xl"
              />
            </Link>
          </div>

          <div className="bg-background/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-emerald-100 dark:border-emerald-900/50 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('invitations.invalidTitle', 'Invalid Invitation')}</h1>
            <p className="text-muted-foreground mb-6">{verificationError}</p>
            <Link to="/">
              <Button className="w-full bg-gradient-to-r from-[#001EF4] to-[#001EF4] hover:from-[#001EF4] hover:to-[#001EF4] text-white shadow-lg">
                {t('common.goToHome', 'Go to Home')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold">{t('invitations.youAreInvited', "You're Invited!")}</h1>
            <p className="text-muted-foreground mt-1">
              {t('invitations.invitedToTeam', '{{name}} has invited you to join their team', {
                name: invitationData?.invitedBy || '',
              })}
            </p>
          </div>

          <div className="bg-muted/70 rounded-xl p-4 mb-6 border border-emerald-100/60 dark:border-emerald-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t('auth.email', 'Email')}</span>
              <span className="font-medium">{invitationData?.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('team.roleLabel', 'Role')}</span>
              <Badge variant="secondary">
                {getRoleLabel(invitationData?.role || '')}
              </Badge>
            </div>
          </div>

          {(authError || validationError) && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{authError || validationError}</AlertDescription>
            </Alert>
          )}

          {isAuthenticated ? (
            <div className="space-y-4">
              <div className="bg-muted/70 rounded-xl p-4 text-sm text-muted-foreground border border-emerald-100/60 dark:border-emerald-900/40">
                {t('invitations.signedInAs', 'Signed in as')} <span className="font-medium text-foreground">{user?.email}</span>
              </div>
              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleAcceptExisting}
                  className="flex-1 bg-gradient-to-r from-[#001EF4] to-[#001EF4] hover:from-[#001EF4] hover:to-[#001EF4] text-white shadow-lg"
                >
                  {t('invitations.accept', 'Accept Invitation')}
                </Button>
                <Button variant="outline" onClick={handleDeclineExisting} className="flex-1">
                  {t('common.decline', 'Decline')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/70 rounded-xl p-4 text-sm text-muted-foreground border border-emerald-100/60 dark:border-emerald-900/40">
                {t(
                  'invitations.loginRequired',
                  'Please sign in with the invited email to accept this invitation.'
                )}
              </div>
              <Link to={loginUrl}>
                <Button className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-lg">
                  {t('auth.signIn', 'Sign In')}
                </Button>
              </Link>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('auth.hasAccount', 'Already have an account?')}{' '}
              <Link
                to={loginUrl}
                className="text-primary hover:underline font-medium"
              >
                {t('auth.signIn', 'Sign In')}
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

export default AcceptInvitationPage;

