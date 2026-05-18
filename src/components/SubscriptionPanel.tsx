import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { chargilyAPI } from '@/services/api';
import { getMarketingPlanCards } from '@/lib/subscriptionPlans';

const SubscriptionPanel: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentState, setPaymentState] = useState<{ status: 'idle' | 'creating' | 'verifying' | 'success' | 'error'; message?: string }>({
    status: 'idle'
  });

  const popularPlanId = 'pro';
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const plans = useMemo(
    () => getMarketingPlanCards(language, billingPeriod),
    [billingPeriod, language]
  );

  const pendingCheckoutStorageKey = 'chargily_pending_checkout';
  const currentPlanId = user?.subscription?.plan || '';

  const readPendingCheckout = (): {
    checkoutId: string;
    planId: string;
    billingPeriod: 'monthly' | 'yearly';
  } | null => {
    try {
      const raw = localStorage.getItem(pendingCheckoutStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const checkoutId = String(parsed.checkoutId || '').trim();
      const planId = String(parsed.planId || '').trim().toLowerCase();
      const billingPeriod = parsed.billingPeriod === 'yearly' ? 'yearly' : 'monthly';
      if (!checkoutId || !planId) return null;
      return { checkoutId, planId, billingPeriod };
    } catch {
      return null;
    }
  };

  const clearPendingCheckout = () => {
    localStorage.removeItem(pendingCheckoutStorageKey);
  };

  const verifyChargilyPayment = async (
    checkoutId: string,
    planId: string,
    verifyBillingPeriod: 'monthly' | 'yearly'
  ) => {
    try {
      setPaymentState({ status: 'verifying', message: 'Verifying payment...' });
      const response = await chargilyAPI.verifyTransaction({
        checkoutId,
        planId,
        billingPeriod: verifyBillingPeriod
      });
      updateUser({
        isSubscribed: response.data.isSubscribed,
        subscription: response.data.subscription,
      });
      clearPendingCheckout();
      setPaymentState({ status: 'success', message: 'Payment verified. Subscription activated.' });
    } catch (error: any) {
      setPaymentState({
        status: 'error',
        message: error.response?.data?.message || 'Payment verification failed',
      });
    }
  };

  const startChargilyCheckout = async (planId: string) => {
    try {
      setPaymentState({ status: 'creating', message: 'Creating payment link...' });
      const buyerName = user?.name?.trim() || '';
      const firstName = buyerName.split(' ')[0] || '';
      const lastName = buyerName.split(' ').slice(1).join(' ');
      const response = await chargilyAPI.createCheckout({
        planId,
        billingPeriod,
        email: user?.email,
        firstName,
        name: lastName,
      });
      const checkoutId = String(response.data.checkoutId || '').trim();
      const checkoutUrl = String(response.data.checkoutUrl || response.data.paymentUrl || '').trim();
      if (!checkoutId || !checkoutUrl) {
        throw new Error('Invalid checkout response');
      }
      localStorage.setItem(
        pendingCheckoutStorageKey,
        JSON.stringify({
          checkoutId,
          planId,
          billingPeriod
        })
      );
      window.location.href = checkoutUrl;
    } catch (error: any) {
      setPaymentState({
        status: 'error',
        message: error.response?.data?.message || 'Failed to create payment link',
      });
    }
  };

  const handleUpgradePlan = async (plan: string) => {
    try {
      await startChargilyCheckout(plan);
    } catch (error) {
      console.error('Error upgrading plan:', error);
    }
  };

  useEffect(() => {
    const provider = String(searchParams.get('payment_provider') || '').toLowerCase();
    const status = String(
      searchParams.get('payment_status') ||
        searchParams.get('status') ||
        ''
    ).toLowerCase();
    const checkoutIdFromQuery = String(
      searchParams.get('checkout_id') ||
        searchParams.get('checkoutId') ||
        ''
    ).trim();

    const nextParams = new URLSearchParams(searchParams);
    const pendingCheckout = readPendingCheckout();

    const hasLegacyParams =
      nextParams.has('redirectionTag') ||
      nextParams.has('redirectiontag') ||
      nextParams.has('tag');
    const hasChargilyParams = Boolean(provider || status || checkoutIdFromQuery);

    if (!hasLegacyParams && !hasChargilyParams) return;
    if (!hasChargilyParams && hasLegacyParams && !pendingCheckout?.checkoutId) {
      nextParams.delete('redirectionTag');
      nextParams.delete('redirectiontag');
      nextParams.delete('tag');
      setSearchParams(nextParams, { replace: true });
      return;
    }

    if (status === 'failure') {
      clearPendingCheckout();
      setPaymentState({ status: 'error', message: 'Payment failed or was canceled.' });
    } else {
      const resolvedCheckoutId = checkoutIdFromQuery || pendingCheckout?.checkoutId || '';
      const resolvedPlan = pendingCheckout?.planId || 'basic';
      const resolvedBillingPeriod = pendingCheckout?.billingPeriod || billingPeriod;

      if (resolvedCheckoutId) {
        verifyChargilyPayment(resolvedCheckoutId, resolvedPlan, resolvedBillingPeriod);
      } else {
        setPaymentState({
          status: 'error',
          message: 'Missing checkout reference. Please start checkout again.'
        });
      }
    }

    nextParams.delete('payment_provider');
    nextParams.delete('payment_status');
    nextParams.delete('status');
    nextParams.delete('checkout_id');
    nextParams.delete('checkoutId');
    nextParams.delete('redirectionTag');
    nextParams.delete('redirectiontag');
    nextParams.delete('tag');

    setSearchParams(nextParams, { replace: true });
  }, [billingPeriod, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      {paymentState.status !== 'idle' && (
        <div className="mb-6 rounded-lg border border-[#CFCFCF] bg-[#F3F3F3] p-3 text-sm text-muted-foreground">
          {paymentState.message}
        </div>
      )}

      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-[#DADADA] bg-[#EFEFEF] p-1">
          <button
            type="button"
            onClick={() => setBillingPeriod('monthly')}
            className={`rounded-full px-5 py-1 text-[11px] font-semibold transition ${
              billingPeriod === 'monthly'
                ? 'bg-[#001EF4] text-white shadow-sm'
                : 'text-[#5F6372] hover:text-foreground'
            }`}
          >
            {t('settings.monthly', 'Monthly')}
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod('yearly')}
            className={`rounded-full px-5 py-1 text-[11px] font-semibold transition ${
              billingPeriod === 'yearly'
                ? 'bg-[#001EF4] text-white shadow-sm'
                : 'text-[#5F6372] hover:text-foreground'
            }`}
          >
            {t('settings.yearly', 'Yearly')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {plans.map((plan) => {
          const isPopular = plan.id === popularPlanId;
          const isCurrentPlan = currentPlanId === plan.id && user?.isSubscribed;
          const displayPrice = plan.visiblePrice;
          const actionLabel = isCurrentPlan
            ? t('plans.currentPlan', 'Current Plan')
            : t('plans.subscribeNow', 'Subscribe Now');

          return (
            <article
              key={plan.id}
              className="group flex min-h-[540px] flex-col overflow-hidden rounded-[12px] border border-[#D5D5D5] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-250 ease-out hover:-translate-y-1 hover:border-[#1D4BFF] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]"
            >
              <div className="mx-4 mt-4 mb-4 overflow-hidden rounded-[10px] border border-[#E0E0E0] shadow-[0_3px_4px_rgba(0,0,0,0.35)] transition-shadow duration-300 ease-out group-hover:shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
                <div
                  className={`flex min-h-[170px] flex-col items-start justify-between px-5 pt-6 pb-6 ${
                    isPopular ? 'bg-[#4458F7]' : 'bg-[#EBEBEB]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                        isPopular
                          ? 'border-[#6F7EFF] bg-[#5D6EF9] text-white'
                          : 'border-[#CFCFCF] bg-[#F5F5F5] text-[#4B4B4B]'
                      }`}
                    >
                      {plan.name}
                    </span>
                    {plan.badge ? (
                      <span className="rounded-full bg-[#F2700F] px-2 py-1 text-[10px] font-bold text-white">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className={`text-[24px] font-bold leading-snug ${isPopular ? 'text-white' : 'text-[#1F1F1F]'}`}>
                    {displayPrice}
                  </p>
                </div>

                <div className="bg-white px-5 pt-1 pb-2">
                  <p className={`text-[14px] text-[#3D3D3D] ${isArabic ? 'text-right' : ''}`}>
                    {plan.description}
                  </p>
                  <Button
                    type="button"
                    className={`mt-4 inline-flex h-10 w-[calc(100%+8px)] -mx-1 items-center justify-center rounded-[7px] px-5 text-[14px] font-semibold ${
                      isCurrentPlan
                        ? 'bg-[#D9D9D9] text-[#9A9A9A] hover:bg-[#D9D9D9]'
                        : 'bg-[#001EF4] text-white hover:bg-[#001EF4]/90'
                    }`}
                    onClick={() => {
                      if (!isCurrentPlan) {
                        void handleUpgradePlan(plan.id);
                      }
                    }}
                    disabled={isCurrentPlan || paymentState.status === 'creating'}
                  >
                    {actionLabel}
                  </Button>
                </div>
              </div>

              <div className="bg-white px-5 py-5">
                <ul className={`space-y-3 ${isArabic ? 'text-right' : ''}`}>
                  {plan.features.map((feature, idx) => (
                    <li
                      key={`${plan.id}-${idx}`}
                    className={`flex min-h-[26px] items-start gap-2.5 text-[14px] text-[#2E2E2E] ${
                        isArabic ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {feature.included ? (
                        <Check size={14} className="mt-[2px] shrink-0 text-[#1D4BFF]" />
                      ) : (
                        <X size={14} className="mt-[2px] shrink-0 text-[#B73232]" />
                      )}
                      <span className="leading-[1.2]">{feature.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionPanel;

