import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Database,
  DollarSign,
  Globe,
  Moon,
  PackageCheck,
  Palette,
  Pencil,
  Shield,
  Sparkles,
  Store,
  Sun,
  Truck,
  UserRound,
  Mail,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SubscriptionPanel from '@/components/SubscriptionPanel';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { authAPI, backupAPI, integrationsAPI, nicheAPI } from '@/services/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { SHIPPING_PROVIDER_OPTIONS } from '@/constants/shippingProviders';
import { hasBusinessCapability } from '@/constants/businessCapabilities';
import { localBackupService, type LocalBackupResult, type LocalBackupSettings } from '@/shared/backup/localBackupService';
import { isDesktopRuntime } from '@/shared/platform/platform';
import type {
  ShopifyIntegrationStatus,
  ShopifyIntegrationSetupStatus,
  ShopifyProductMapping,
  ShopifyWebhookEvent,
  ShippingProviderConnectionStatus,
  ShippingProviderKey
} from '@/types';

type SettingsSectionKey = 'profile' | 'preferences' | 'niche' | 'backup' | 'notifications' | 'integrations' | 'subscription';
type IntegrationDialogKey = 'shopify' | ShippingProviderKey;

type ShippingProviderFormState = {
  accountName: string;
  apiBaseUrl: string;
  authId: string;
  ordersEndpointPath: string;
  apiToken: string;
  tokenHeaderName: string;
  tokenPrefix: string;
  customHeadersJson: string;
  defaultPayloadJson: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderCity: string;
  fromWilayaName: string;
  defaultStopdeskId: string;
  defaultProductList: string;
  defaultLength: string;
  defaultWidth: string;
  defaultHeight: string;
  defaultWeight: string;
  doInsurance: boolean;
  freeshipping: boolean;
  economic: boolean;
  hasExchange: boolean;
  notes: string;
};

const DEFAULT_PROVIDER_ENDPOINT_PATH = '/shipments';

const createDefaultShopifySetupStatus = (): ShopifyIntegrationSetupStatus => ({
  isAvailable: false,
  authMode: 'authorization_code_grant',
  shopDomainHint: '*.myshopify.com',
  scopes: 'read_orders,write_webhooks',
  apiVersion: '2024-10'
  // Removed: appConfigured, redirectUri, webhookUrl, warnings
});

const extractHostnameFromInput = (value: string) => {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).hostname.trim().toLowerCase();
    } catch {
      return raw;
    }
  }

  return raw;
};

const normalizeShopifyConnectionInput = (value: string) => {
  const hostname = extractHostnameFromInput(value);
  if (!hostname) return '';
  if (hostname.endsWith('.myshopify.com')) return hostname;
  if (/^[a-z0-9][a-z0-9-]*$/.test(hostname)) {
    return `${hostname}.myshopify.com`;
  }
  return hostname;
};

const isCustomShopifyStorefrontUrl = (value: string) => {
  const hostname = extractHostnameFromInput(value);
  return Boolean(hostname) && hostname.includes('.') && !hostname.endsWith('.myshopify.com');
};

const stringifyJsonField = (value: Record<string, unknown> | undefined) => {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
};

const createEmptyShippingProviderStatusMap = () =>
  SHIPPING_PROVIDER_OPTIONS.reduce((accumulator, option) => {
    accumulator[option.value] = null;
    return accumulator;
  }, {} as Record<ShippingProviderKey, ShippingProviderConnectionStatus | null>);

const createShippingProviderFormState = (
  provider?: ShippingProviderConnectionStatus | null
): ShippingProviderFormState => ({
  accountName: provider?.accountName || '',
  apiBaseUrl: provider?.apiBaseUrl || '',
  authId: provider?.authId || '',
  ordersEndpointPath: provider?.ordersEndpointPath || DEFAULT_PROVIDER_ENDPOINT_PATH,
  apiToken: '',
  tokenHeaderName: provider?.tokenHeaderName || 'Authorization',
  tokenPrefix: typeof provider?.tokenPrefix === 'string' ? provider.tokenPrefix : 'Bearer',
  customHeadersJson: stringifyJsonField(provider?.customHeaders),
  defaultPayloadJson: stringifyJsonField(provider?.defaultPayload),
  senderName: provider?.senderName || '',
  senderPhone: provider?.senderPhone || '',
  senderAddress: provider?.senderAddress || '',
  senderCity: provider?.senderCity || '',
  fromWilayaName: provider?.fromWilayaName || '',
  defaultStopdeskId:
    typeof provider?.defaultStopdeskId === 'number' && Number.isFinite(provider.defaultStopdeskId)
      ? String(provider.defaultStopdeskId)
      : '',
  defaultProductList: provider?.defaultProductList || '',
  defaultLength:
    typeof provider?.defaultLength === 'number' && Number.isFinite(provider.defaultLength)
      ? String(provider.defaultLength)
      : '15',
  defaultWidth:
    typeof provider?.defaultWidth === 'number' && Number.isFinite(provider.defaultWidth)
      ? String(provider.defaultWidth)
      : '10',
  defaultHeight:
    typeof provider?.defaultHeight === 'number' && Number.isFinite(provider.defaultHeight)
      ? String(provider.defaultHeight)
      : '5',
  defaultWeight:
    typeof provider?.defaultWeight === 'number' && Number.isFinite(provider.defaultWeight)
      ? String(provider.defaultWeight)
      : '1',
  doInsurance: Boolean(provider?.doInsurance),
  freeshipping: Boolean(provider?.freeshipping),
  economic: Boolean(provider?.economic),
  hasExchange: Boolean(provider?.hasExchange),
  notes: provider?.notes || '',
});

const createShippingProviderFormsState = (
  providerStatuses?: Record<ShippingProviderKey, ShippingProviderConnectionStatus | null>
) =>
  SHIPPING_PROVIDER_OPTIONS.reduce((accumulator, option) => {
    accumulator[option.value] = createShippingProviderFormState(
      providerStatuses?.[option.value] || null
    );
    return accumulator;
  }, {} as Record<ShippingProviderKey, ShippingProviderFormState>);

const mapShippingProvidersByKey = (
  providers: ShippingProviderConnectionStatus[]
) => {
  const nextStatuses = createEmptyShippingProviderStatusMap();
  providers.forEach((provider) => {
    nextStatuses[provider.provider] = provider;
  });
  return nextStatuses;
};

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, updateUser, isSubUser, canManageEcommerce } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, isRTL } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const locale = i18n.language || 'en';
  const isDesktop = isDesktopRuntime();
  const [backupEnabled, setBackupEnabled] = React.useState(false);
  const [backupFrequency, setBackupFrequency] = React.useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [backupLastRun, setBackupLastRun] = React.useState<string | null>(null);
  const [backupNextRun, setBackupNextRun] = React.useState<string | null>(null);
  const [availableBackups, setAvailableBackups] = React.useState<{ fileName: string; createdAt: string }[]>([]);
  const [selectedBackup, setSelectedBackup] = React.useState<string>('');
  const [backupLoading, setBackupLoading] = React.useState(false);
  const [localBackupSettings, setLocalBackupSettings] = React.useState<LocalBackupSettings>({});
  const [latestLocalBackup, setLatestLocalBackup] = React.useState<LocalBackupResult | null>(null);

  const [isCurrencyErrorOpen, setIsCurrencyErrorOpen] = React.useState(false);
  const [currencyErrorMessage, setCurrencyErrorMessage] = React.useState<string>('');
  const [currencyErrorSamples, setCurrencyErrorSamples] = React.useState<
    Array<{ name: string; price: number; secondPrice: number | null }>
  >([]);
  const [profileForm, setProfileForm] = React.useState({
    name: user?.name || '',
    email: user?.email || '',
    profileImageUrl: user?.profileImageUrl || '',
  });
  const [profileImagePreview, setProfileImagePreview] = React.useState<string>(user?.profileImageUrl || '');
  const [isProfileSaving, setIsProfileSaving] = React.useState(false);
  const avatarFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Email change state
  const [emailChangeDialogOpen, setEmailChangeDialogOpen] = React.useState(false);
  const [emailChangeStep, setEmailChangeStep] = React.useState<'input' | 'code'>('input');
  const [newEmailInput, setNewEmailInput] = React.useState('');
  const [emailChangeCode, setEmailChangeCode] = React.useState('');
  const [emailChangeMaskedEmail, setEmailChangeMaskedEmail] = React.useState('');
  const [isRequestingEmailCode, setIsRequestingEmailCode] = React.useState(false);
  const [isConfirmingEmailChange, setIsConfirmingEmailChange] = React.useState(false);
  const [emailChangeError, setEmailChangeError] = React.useState<string | null>(null);

  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordSaving, setIsPasswordSaving] = React.useState(false);
  const [passwordFeedback, setPasswordFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [businessProfileForm, setBusinessProfileForm] = React.useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    nif: '',
    rc: '',
    nis: '',
    ai: '',
  });
  const [isBusinessProfileSaving, setIsBusinessProfileSaving] = React.useState(false);
  const [smsAlertsEnabled, setSmsAlertsEnabled] = React.useState(false);
  const [shopifyStatus, setShopifyStatus] = React.useState<ShopifyIntegrationStatus | null>(null);
  const [shopifySetup, setShopifySetup] = React.useState<ShopifyIntegrationSetupStatus>(
    () => createDefaultShopifySetupStatus()
  );
  const [shopifyShopInput, setShopifyShopInput] = React.useState('');
  const [shopifyLoading, setShopifyLoading] = React.useState(false);
  const [shopifyActionLoading, setShopifyActionLoading] = React.useState(false);
  const [shopifySyncLoading, setShopifySyncLoading] = React.useState(false);
  const [shopifyTestLoading, setShopifyTestLoading] = React.useState(false);
  const [shopifyCatalogSyncLoading, setShopifyCatalogSyncLoading] = React.useState(false);
  const [shopifyAutoMapLoading, setShopifyAutoMapLoading] = React.useState(false);
  const [shopifyInventoryPushLoading, setShopifyInventoryPushLoading] = React.useState(false);
  const [shopifySettingsSaving, setShopifySettingsSaving] = React.useState(false);
  const [shopifyRecentEvents, setShopifyRecentEvents] = React.useState<ShopifyWebhookEvent[]>([]);
  const [shopifyEvents, setShopifyEvents] = React.useState<ShopifyWebhookEvent[]>([]);
  const [shopifyEventsLoading, setShopifyEventsLoading] = React.useState(false);
  const [shopifyMappings, setShopifyMappings] = React.useState<ShopifyProductMapping[]>([]);
  const [shopifyMappingsLoading, setShopifyMappingsLoading] = React.useState(false);
  const [shopifyMappingSearch, setShopifyMappingSearch] = React.useState('');
  const [shopifyMappingDrafts, setShopifyMappingDrafts] = React.useState<
    Record<string, { stocklySku: string; stocklyVariantSku: string }>
  >({});
  const [shopifyRetryingEventId, setShopifyRetryingEventId] = React.useState<string | null>(null);
  const [shopifySyncOptionsDraft, setShopifySyncOptionsDraft] = React.useState({
    autoImportOrders: true,
    failOnUnmappedItems: true,
    autoSyncStatusUpdates: true,
    allowManualInventoryPush: true,
  });
  const [shippingProviderStatuses, setShippingProviderStatuses] = React.useState<
    Record<ShippingProviderKey, ShippingProviderConnectionStatus | null>
  >(() => createEmptyShippingProviderStatusMap());
  const [shippingProviderForms, setShippingProviderForms] = React.useState<
    Record<ShippingProviderKey, ShippingProviderFormState>
  >(() => createShippingProviderFormsState());
  const [shippingProvidersLoading, setShippingProvidersLoading] = React.useState(false);
  const [shippingProviderActionKey, setShippingProviderActionKey] = React.useState<string | null>(null);
  const [activeIntegrationDialog, setActiveIntegrationDialog] = React.useState<IntegrationDialogKey | null>(null);
  const [activeSection, setActiveSection] = React.useState<SettingsSectionKey>('profile');
  const restoreLocalFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Niche reset state
  const [isNicheResetWarningOpen, setIsNicheResetWarningOpen] = React.useState(false);

  const currencies = [
    { code: 'DZD', symbol: 'DA', name: t('settings.currencies.dzd', 'Algerian Dinar') },
    { code: 'USD', symbol: '$', name: t('settings.currencies.usd', 'US Dollar') },
    { code: 'EUR', symbol: 'EUR', name: t('settings.currencies.eur', 'Euro') },
  ];
  const selectedCurrency = currencies.some((currency) => currency.code === user?.settings?.currency)
    ? user?.settings?.currency
    : 'DZD';
  const canManageEcommerceAccess = typeof canManageEcommerce === 'function' ? canManageEcommerce() : false;
  const hasShippingCapability = hasBusinessCapability(user?.businessType as import('@/types').BusinessType | null | undefined, 'ecommerce_shipping_pipeline');
  const canUseEcommerceIntegrations = canManageEcommerceAccess && hasShippingCapability;
  const canUseShopifyIntegrations = canUseEcommerceIntegrations;
  const canUseShippingIntegrations = canUseEcommerceIntegrations;


  React.useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      profileImageUrl: user?.profileImageUrl || '',
    });
    setProfileImagePreview(user?.profileImageUrl || '');
  }, [user?.name, user?.email, user?.profileImageUrl]);

  React.useEffect(() => {
    setBusinessProfileForm({
      businessName: user?.businessProfile?.businessName || '',
      contactName: user?.businessProfile?.contactName || '',
      email: user?.businessProfile?.email || '',
      phone: user?.businessProfile?.phone || '',
      address: user?.businessProfile?.address || '',
      nif: user?.businessProfile?.nif || '',
      rc: user?.businessProfile?.rc || '',
      nis: user?.businessProfile?.nis || '',
      ai: user?.businessProfile?.ai || '',
    });
  }, [user?.businessProfile]);

  React.useEffect(() => {
    setShopifySyncOptionsDraft({
      autoImportOrders: shopifyStatus?.syncOptions?.autoImportOrders ?? true,
      failOnUnmappedItems: shopifyStatus?.syncOptions?.failOnUnmappedItems ?? true,
      autoSyncStatusUpdates: shopifyStatus?.syncOptions?.autoSyncStatusUpdates ?? true,
      allowManualInventoryPush: shopifyStatus?.syncOptions?.allowManualInventoryPush ?? true,
    });
  }, [shopifyStatus?.syncOptions]);

  const loadShopifyStatus = React.useCallback(async () => {
    if (!canUseShopifyIntegrations) {
      setShopifyStatus(null);
      setShopifySetup(createDefaultShopifySetupStatus());
      setShopifyRecentEvents([]);
      return;
    }
    setShopifyLoading(true);
    try {
      const response = await integrationsAPI.getShopifyStatus();
      const status = response.data.shopify || null;
      const setup = response.data.setup || createDefaultShopifySetupStatus();
      setShopifyStatus(status);
      setShopifySetup(setup);
      setShopifyRecentEvents(response.data.recentEvents || []);
      if (status?.shop) {
        setShopifyShopInput(status.shop);
      }
    } catch (error) {
      console.error('Error loading Shopify status:', error);
    } finally {
      setShopifyLoading(false);
    }
  }, [canUseShopifyIntegrations]);

  const loadShippingProviderStatuses = React.useCallback(async () => {
    if (!canUseShippingIntegrations) {
      setShippingProviderStatuses(createEmptyShippingProviderStatusMap());
      setShippingProviderForms(createShippingProviderFormsState());
      return;
    }

    setShippingProvidersLoading(true);
    try {
      const response = await integrationsAPI.getShippingProviders();
      const providers = response.data.providers || [];
      const mappedStatuses = mapShippingProvidersByKey(providers);
      setShippingProviderStatuses(mappedStatuses);
      setShippingProviderForms(createShippingProviderFormsState(mappedStatuses));
    } catch (error) {
      console.error('Error loading shipping providers:', error);
    } finally {
      setShippingProvidersLoading(false);
    }
  }, [canUseShippingIntegrations]);

  const loadShopifyMappings = React.useCallback(async () => {
    if (!canUseShopifyIntegrations || !shopifyStatus?.isActive) {
      setShopifyMappings([]);
      setShopifyMappingDrafts({});
      return;
    }

    setShopifyMappingsLoading(true);
    try {
      const response = await integrationsAPI.getShopifyMappings({
        search: shopifyMappingSearch.trim() || undefined,
        limit: 25,
      });
      const mappings = response.data.mappings || [];
      setShopifyMappings(mappings);
      setShopifyMappingDrafts((prev) =>
        mappings.reduce((accumulator, mapping) => {
          accumulator[mapping.id] = prev[mapping.id] || {
            stocklySku: mapping.stocklyProduct?.sku || '',
            stocklyVariantSku: mapping.stocklyVariant?.sku || '',
          };
          return accumulator;
        }, {} as Record<string, { stocklySku: string; stocklyVariantSku: string }>)
      );
    } catch (error) {
      console.error('Error loading Shopify mappings:', error);
    } finally {
      setShopifyMappingsLoading(false);
    }
  }, [canUseShopifyIntegrations, shopifyStatus?.isActive, shopifyMappingSearch]);

  const loadShopifyEvents = React.useCallback(async () => {
    if (!canUseShopifyIntegrations || !shopifyStatus?.isActive) {
      setShopifyEvents([]);
      return;
    }

    setShopifyEventsLoading(true);
    try {
      const response = await integrationsAPI.getShopifyEvents({ limit: 12 });
      setShopifyEvents(response.data.events || []);
    } catch (error) {
      console.error('Error loading Shopify events:', error);
    } finally {
      setShopifyEventsLoading(false);
    }
  }, [canUseShopifyIntegrations, shopifyStatus?.isActive]);

  React.useEffect(() => {
    const status = searchParams.get('shopify');
    const statusMessage = searchParams.get('shopify_message');
    if (!status) return;
    if (status === 'connected') {
      toast.success(t('settings.shopifyConnected', 'Shopify connected successfully.'));
      void loadShopifyStatus();
    } else {
      toast.error(
        statusMessage
          ? t('settings.shopifyConnectFailedWithReason', 'Shopify connection failed: {{reason}}', {
              reason: statusMessage.replace(/_/g, ' ')
            })
          : t('settings.shopifyConnectFailed', 'Shopify connection failed.')
      );
    }
    const next = new URLSearchParams(searchParams);
    next.delete('shopify');
    next.delete('shopify_message');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, t, loadShopifyStatus]);

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    try {
      const response = await authAPI.updateSettings({ theme: newTheme });
      updateUser({ settings: response.data.settings });
    } catch (error) {
      console.error('Error updating theme:', error);
    }
  };

  const handleLanguageChange = async (newLanguage: 'en' | 'ar' | 'fr') => {
    setLanguage(newLanguage);
    try {
      const response = await authAPI.updateSettings({ language: newLanguage });
      updateUser({ settings: response.data.settings });
    } catch (error) {
      console.error('Error updating language:', error);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    try {
      const response = await authAPI.updateSettings({ currency: newCurrency });
      updateUser({ settings: response.data.settings });
    } catch (error: unknown) {
      const apiError = error as {
        response?: {
          data?: {
            code?: string;
            message?: string;
            details?: {
              conflictCount?: number;
              sampleProducts?: Array<{ name?: string; price?: number; secondPrice?: number | null }>;
            };
          };
        };
      };

      if (apiError?.response?.data?.code === 'DZD_INTEGER_PRICE_REQUIRED') {
        const conflictCount = Number(apiError.response.data.details?.conflictCount) || 0;
        const sampleProducts = Array.isArray(apiError.response.data.details?.sampleProducts)
          ? apiError.response.data.details?.sampleProducts
          : [];
        const normalizedSamples = sampleProducts
          .map((product) => ({
            name: String(product?.name || t('settings.unnamedProduct', 'Unnamed product')),
            price: Number(product?.price),
            secondPrice:
              product?.secondPrice === null || typeof product?.secondPrice === 'undefined'
                ? null
                : Number(product?.secondPrice),
          }))
          .filter(
            (product) =>
              Number.isFinite(product.price) ||
              (product.secondPrice !== null && Number.isFinite(product.secondPrice))
          );

        setCurrencyErrorMessage(
          t(
            'settings.dzdIntegerPriceError',
            'DZD does not support decimal product prices. Update decimal prices to whole numbers first, then switch to DZD. Affected products: {{count}}.',
            { count: conflictCount }
          )
        );
        setCurrencyErrorSamples(normalizedSamples);
        setIsCurrencyErrorOpen(true);
        return;
      }

      setCurrencyErrorMessage(
        apiError?.response?.data?.message ||
          t('settings.currencyUpdateFailed', 'Failed to update currency settings.')
      );
      setCurrencyErrorSamples([]);
      setIsCurrencyErrorOpen(true);
      console.error('Error updating currency:', error);
    }
  };

  const handleBusinessProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setIsBusinessProfileSaving(true);
      const response = await authAPI.updateSettings({ businessProfile: businessProfileForm });
      updateUser({ businessProfile: response.data.businessProfile });
      toast.success(t('settings.businessProfileSaved', 'Business profile saved successfully.'));
    } catch (error) {
      console.error('Error updating business profile:', error);
      toast.error(t('settings.businessProfileSaveFailed', 'Failed to save business profile.'));
    } finally {
      setIsBusinessProfileSaving(false);
    }
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    try {
      const notifications = {
        email: user?.settings?.notifications?.email ?? true,
        lowStock: user?.settings?.notifications?.lowStock ?? true,
        sales: user?.settings?.notifications?.sales ?? true,
        [key]: value,
      };
      const response = await authAPI.updateSettings({ notifications });
      updateUser({ settings: response.data.settings });
    } catch (error) {
      console.error('Error updating notifications:', error);
    }
  };

  const handlePasswordInputChange = (
    field: 'currentPassword' | 'newPassword' | 'confirmPassword',
    value: string
  ) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    if (passwordFeedback) {
      setPasswordFeedback(null);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordFeedback(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordFeedback({
        type: 'error',
        message: t('settings.passwordRequired', 'Current and new password are required.')
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        message: t('settings.passwordMinLength', 'New password must be at least 6 characters.')
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: t('settings.passwordMismatch', 'New password and confirmation do not match.')
      });
      return;
    }

    try {
      setIsPasswordSaving(true);
      const response = await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordFeedback({
        type: 'success',
        message: response.message || t('settings.passwordUpdated', 'Password updated successfully.')
      });
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setPasswordFeedback({
        type: 'error',
        message:
          apiError?.response?.data?.message ||
          t('settings.passwordUpdateFailed', 'Failed to update password.')
      });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  React.useEffect(() => {
    const loadBackupSettings = async () => {
      if (isDesktop) {
        try {
          const settings = await localBackupService.getSettings();
          setLocalBackupSettings(settings);
          setBackupEnabled(true);
          setBackupFrequency('daily');
          setBackupLastRun(settings.lastBackupAt || null);
          setBackupNextRun(settings.nextBackupAt || null);
        } catch {
          // Desktop backups are best-effort; the manual action will show errors.
        }
        return;
      }

      if (isSubUser()) return;
      try {
        const response = await backupAPI.getSettings();
        setBackupEnabled(response.data.enabled);
        setBackupFrequency(response.data.frequency);
        setBackupLastRun(response.data.lastRun);
        setBackupNextRun(response.data.nextRun);
        const listResponse = await backupAPI.listBackups();
        setAvailableBackups(listResponse.data.backups || []);
        if (listResponse.data.backups?.length) {
          setSelectedBackup(listResponse.data.backups[0].fileName);
        }
      } catch {
        // ignore for now
      }
    };
    loadBackupSettings();
  }, [isDesktop, isSubUser]);

  React.useEffect(() => {
    void loadShopifyStatus();
  }, [loadShopifyStatus]);

  React.useEffect(() => {
    void loadShippingProviderStatuses();
  }, [loadShippingProviderStatuses]);

  React.useEffect(() => {
    if (activeIntegrationDialog !== 'shopify') return;
    void loadShopifyMappings();
    void loadShopifyEvents();
  }, [activeIntegrationDialog, loadShopifyMappings, loadShopifyEvents]);

  const updateBackupSettings = async (payload: { enabled?: boolean; frequency?: 'daily' | 'weekly' | 'monthly' }) => {
    if (isDesktop) {
      setBackupEnabled(payload.enabled ?? true);
      setBackupFrequency('daily');
      toast.success(t('settings.backupUpdated', 'Backup settings updated.'));
      return;
    }

    setBackupLoading(true);
    try {
      const response = await backupAPI.updateSettings(payload);
      setBackupEnabled(response.data.enabled);
      setBackupFrequency(response.data.frequency);
      setBackupLastRun(response.data.lastRun);
      setBackupNextRun(response.data.nextRun);
      toast.success(t('settings.backupUpdated', 'Backup settings updated.'));
    } catch {
      toast.error(t('settings.backupUpdateFailed', 'Failed to update backup settings.'));
    } finally {
      setBackupLoading(false);
    }
  };

  const runBackupNow = async () => {
    setBackupLoading(true);
    try {
      if (isDesktop) {
        const result = await localBackupService.backupNow({
          chooseDirectory: true,
          reason: 'manual',
        });
        if (!result) return;
        setLatestLocalBackup(result);
        setLocalBackupSettings({
          backupDir: result.backupDir,
          lastBackupAt: result.createdAt,
          nextBackupAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        setBackupLastRun(result.createdAt);
        setBackupNextRun(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
        toast.success(t('settings.backupCreated', 'Backup created successfully.'));
        return;
      }

      const response = await backupAPI.runNow();
      setBackupLastRun(response.data.lastRun);
      setBackupNextRun(response.data.nextRun);
      const listResponse = await backupAPI.listBackups();
      setAvailableBackups(listResponse.data.backups || []);
      if (listResponse.data.backups?.length) {
        setSelectedBackup(listResponse.data.backups[0].fileName);
      }
      toast.success(t('settings.backupCreated', 'Backup created successfully.'));
    } catch {
      toast.error(t('settings.backupCreateFailed', 'Failed to create backup.'));
    } finally {
      setBackupLoading(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup) return;
    setBackupLoading(true);
    try {
      const response = await backupAPI.restoreBackup(selectedBackup);
      toast.success(
        t('settings.backupRestored', 'Backup restored. Products: {{products}}, Orders: {{sales}}.', {
          products: response.data.products,
          sales: response.data.sales,
        })
      );
    } catch {
      toast.error(t('settings.backupRestoreFailed', 'Failed to restore backup.'));
    } finally {
      setBackupLoading(false);
    }
  };

  const downloadBackup = async () => {
    if (!selectedBackup || typeof window === 'undefined') return;
    setBackupLoading(true);
    try {
      const blob = await backupAPI.downloadBackup(selectedBackup);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = selectedBackup;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('settings.backupDownloaded', 'Backup downloaded successfully.'));
    } catch {
      toast.error(t('settings.backupDownloadFailed', 'Failed to download backup.'));
    } finally {
      setBackupLoading(false);
    }
  };

  const restoreLocalBackupFromPc = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBackupLoading(true);
    try {
      const raw = await file.text();
      let parsedBackup: unknown = null;
      try {
        parsedBackup = JSON.parse(raw);
      } catch {
        toast.error(t('settings.backupInvalidJson', 'Selected file is not a valid backup JSON.'));
        return;
      }

      const response = await backupAPI.restoreBackupFromLocal(parsedBackup, file.name);
      toast.success(
        t(
          'settings.backupRestoredFromFile',
          'Backup restored from {{file}}. Products: {{products}}, Orders: {{sales}}.',
          {
            file: file.name,
            products: response.data.products,
            sales: response.data.sales,
          }
        )
      );
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.backupRestoreLocalFailed', 'Failed to restore local backup.')
      );
    } finally {
      setBackupLoading(false);
    }
  };

  const handleShopifyConnect = async () => {
    const shop = normalizeShopifyConnectionInput(shopifyShopInput);
    if (!shopifySetup.isAvailable) {
      toast.error(
        t(
          'settings.shopifyNotAvailable',
          'Shopify integration is not available. Please contact your administrator to enable it.'
        )
      );
      return;
    }
    if (!shop) {
      toast.error(t('settings.shopifyShopRequired', 'Enter your Shopify shop domain.'));
      return;
    }
    if (isCustomShopifyStorefrontUrl(shopifyShopInput)) {
      toast.error(
        t(
          'settings.shopifyShopMyshopifyRequired',
          'Use the Shopify admin domain like store-name.myshopify.com, not the public website link.'
        )
      );
      return;
    }
    setShopifyShopInput(shop);
    setShopifyActionLoading(true);
    try {
      const response = await integrationsAPI.connectShopify({ shop });
      if (response.data?.authUrl) {
        window.location.href = response.data.authUrl;
        return;
      }
      toast.error(t('settings.shopifyConnectFailed', 'Shopify connection failed.'));
    } catch (error: unknown) {
      console.error('Error connecting Shopify:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyConnectFailed', 'Shopify connection failed.')
      );
    } finally {
      setShopifyActionLoading(false);
    }
  };

  const handleShopifyDisconnect = async () => {
    setShopifyActionLoading(true);
    try {
      await integrationsAPI.disconnectShopify();
      setShopifyStatus(null);
      toast.success(t('settings.shopifyDisconnected', 'Shopify disconnected.'));
    } catch (error) {
      console.error('Error disconnecting Shopify:', error);
      toast.error(t('settings.shopifyDisconnectFailed', 'Failed to disconnect Shopify.'));
    } finally {
      setShopifyActionLoading(false);
    }
  };

  const handleShopifySync = async () => {
    setShopifySyncLoading(true);
    try {
      const response = await integrationsAPI.syncShopifyOrders();
      if (response.data?.lastSyncedAt) {
        setShopifyStatus((prev) =>
          prev ? { ...prev, lastSyncedAt: response.data.lastSyncedAt } : prev
        );
      }
      toast.success(t('settings.shopifySyncSuccess', 'Shopify orders synced.'));
    } catch (error) {
      console.error('Error syncing Shopify orders:', error);
      toast.error(t('settings.shopifySyncFailed', 'Failed to sync Shopify orders.'));
    } finally {
      setShopifySyncLoading(false);
    }
  };

  const handleShopifyTestConnection = async () => {
    setShopifyTestLoading(true);
    try {
      await integrationsAPI.testShopifyConnection();
      await loadShopifyStatus();
      toast.success(t('settings.shopifyTestSuccess', 'Shopify connection is working.'));
    } catch (error: unknown) {
      console.error('Error testing Shopify connection:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyTestFailed', 'Shopify connection test failed.')
      );
    } finally {
      setShopifyTestLoading(false);
    }
  };

  const handleShopifyCatalogSync = async () => {
    setShopifyCatalogSyncLoading(true);
    try {
      const response = await integrationsAPI.syncShopifyCatalog();
      await loadShopifyStatus();
      await loadShopifyMappings();
      toast.success(
        t(
          'settings.shopifyCatalogSyncSuccess',
          'Shopify catalog synced. {{mapped}} variants auto-mapped.',
          { mapped: response.data.autoMapped || 0 }
        )
      );
    } catch (error: unknown) {
      console.error('Error syncing Shopify catalog:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyCatalogSyncFailed', 'Failed to sync the Shopify catalog.')
      );
    } finally {
      setShopifyCatalogSyncLoading(false);
    }
  };

  const handleShopifyAutoMap = async () => {
    setShopifyAutoMapLoading(true);
    try {
      const response = await integrationsAPI.autoMapShopifyMappings();
      await loadShopifyStatus();
      await loadShopifyMappings();
      toast.success(
        t('settings.shopifyAutoMapSuccess', 'Rechecked Shopify mappings. {{count}} items matched.', {
          count: response.data.mappedCount || 0,
        })
      );
    } catch (error: unknown) {
      console.error('Error auto-mapping Shopify catalog:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyAutoMapFailed', 'Failed to recheck Shopify mappings.')
      );
    } finally {
      setShopifyAutoMapLoading(false);
    }
  };

  const handleShopifyInventoryPush = async () => {
    setShopifyInventoryPushLoading(true);
    try {
      const response = await integrationsAPI.pushShopifyInventory();
      await loadShopifyStatus();
      toast.success(
        t('settings.shopifyInventoryPushSuccess', 'Pushed {{count}} stock levels to Shopify.', {
          count: response.data.pushed || 0,
        })
      );
    } catch (error: unknown) {
      console.error('Error pushing Shopify inventory:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyInventoryPushFailed', 'Failed to push Stockly inventory to Shopify.')
      );
    } finally {
      setShopifyInventoryPushLoading(false);
    }
  };

  const handleShopifySettingsSave = async () => {
    setShopifySettingsSaving(true);
    try {
      await integrationsAPI.updateShopifySettings({ syncOptions: shopifySyncOptionsDraft });
      await loadShopifyStatus();
      toast.success(t('settings.shopifySettingsSaved', 'Shopify sync settings saved.'));
    } catch (error: unknown) {
      console.error('Error saving Shopify settings:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifySettingsSaveFailed', 'Failed to save Shopify sync settings.')
      );
    } finally {
      setShopifySettingsSaving(false);
    }
  };

  const handleShopifyMappingDraftChange = (
    mappingId: string,
    field: 'stocklySku' | 'stocklyVariantSku',
    value: string
  ) => {
    setShopifyMappingDrafts((prev) => ({
      ...prev,
      [mappingId]: {
        stocklySku: prev[mappingId]?.stocklySku || '',
        stocklyVariantSku: prev[mappingId]?.stocklyVariantSku || '',
        [field]: value,
      }
    }));
  };

  const handleShopifyMappingSave = async (mappingId: string) => {
    const draft = shopifyMappingDrafts[mappingId] || { stocklySku: '', stocklyVariantSku: '' };
    try {
      await integrationsAPI.updateShopifyMapping(mappingId, draft);
      await loadShopifyMappings();
      await loadShopifyStatus();
      toast.success(t('settings.shopifyMappingSaved', 'Shopify mapping saved.'));
    } catch (error: unknown) {
      console.error('Error saving Shopify mapping:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyMappingSaveFailed', 'Failed to save this Shopify mapping.')
      );
    }
  };

  const handleShopifyRetryEvent = async (eventId: string) => {
    setShopifyRetryingEventId(eventId);
    try {
      await integrationsAPI.retryShopifyEvent(eventId);
      await loadShopifyEvents();
      toast.success(t('settings.shopifyEventRetried', 'Shopify event queued for retry.'));
    } catch (error: unknown) {
      console.error('Error retrying Shopify event:', error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t('settings.shopifyEventRetryFailed', 'Failed to retry this Shopify event.')
      );
    } finally {
      setShopifyRetryingEventId(null);
    }
  };

  const handleShippingProviderFormChange = (
    provider: ShippingProviderKey,
    field: keyof ShippingProviderFormState,
    value: string
  ) => {
    setShippingProviderForms((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      }
    }));
  };

  const handleShippingProviderConnect = async (provider: ShippingProviderKey) => {
    const form = shippingProviderForms[provider];
    const providerStatus = shippingProviderStatuses[provider];
    const isYalidineProvider = provider === 'yalidine_express';
    const isZrExpressProvider = provider === 'zr_express';
    const isNoestProvider = provider === 'noest_express';
    const isWorldExpressProvider = provider === 'world_express';
    const providerLabel =
      SHIPPING_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ||
      provider;
    const authIdFieldLabel = isNoestProvider
      ? 'user_guid'
      : isZrExpressProvider
        ? t('settings.shippingProviderApiKey', 'API key')
        : t('settings.shippingProviderApiId', 'API ID');
    const tokenFieldLabel = isNoestProvider
      ? 'api_token'
      : t('settings.shippingProviderApiToken', 'API token');

    if (!isWorldExpressProvider && !form.authId.trim()) {
      toast.error(
        t(
          'settings.shippingProviderAuthIdRequired',
          '{{provider}} {{field}} is required.',
          {
            provider: providerLabel,
            field: authIdFieldLabel
          }
        )
      );
      return;
    }

    if (isYalidineProvider && !form.fromWilayaName.trim()) {
      toast.error(
        t(
          'settings.shippingProviderFromWilayaRequired',
          '{{provider}} sender wilaya is required.',
          { provider: providerLabel }
        )
      );
      return;
    }

    if (!form.apiToken.trim() && !providerStatus?.isActive) {
      toast.error(
        t(
          'settings.shippingProviderTokenRequired',
          '{{provider}} API token is required.',
          { provider: `${providerLabel} ${tokenFieldLabel}` }
        )
      );
      return;
    }

    let payload:
      | {
          authId?: string;
          apiToken?: string;
          fromWilayaName?: string;
          defaultStopdeskId?: number | null;
        };

    if (isYalidineProvider) {
      payload = {
        authId: form.authId.trim(),
        apiToken: form.apiToken.trim(),
        fromWilayaName: form.fromWilayaName.trim(),
        defaultStopdeskId: form.defaultStopdeskId.trim()
          ? Number(form.defaultStopdeskId)
          : null,
      };
    } else if (isZrExpressProvider) {
      payload = {
        authId: form.authId.trim(),
        apiToken: form.apiToken.trim(),
      };
    } else if (isNoestProvider || isWorldExpressProvider) {
      payload = {
        authId: form.authId.trim(),
        apiToken: form.apiToken.trim(),
      };
    } else {
      toast.error(
        t(
          'settings.shippingProviderUnsupported',
          'This shipping provider is not supported yet.'
        )
      );
      return;
    }

    setShippingProviderActionKey(`connect:${provider}`);
    try {
      const response = await integrationsAPI.connectShippingProvider(provider, payload);

      const nextProvider = response.data.provider;
      setShippingProviderStatuses((prev) => ({
        ...prev,
        [provider]: nextProvider,
      }));
      setShippingProviderForms((prev) => ({
        ...prev,
        [provider]: createShippingProviderFormState(nextProvider),
      }));
      toast.success(
        t(
          'settings.shippingProviderConnected',
          '{{provider}} connected successfully.',
          { provider: providerLabel }
        )
      );
    } catch (error: unknown) {
      console.error(`Error connecting ${provider}:`, error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t(
            'settings.shippingProviderConnectFailed',
            'Failed to connect {{provider}}.',
            { provider: providerLabel }
          )
      );
    } finally {
      setShippingProviderActionKey(null);
    }
  };

  const handleShippingProviderDisconnect = async (provider: ShippingProviderKey) => {
    const providerLabel =
      SHIPPING_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ||
      provider;

    setShippingProviderActionKey(`disconnect:${provider}`);
    try {
      const response = await integrationsAPI.disconnectShippingProvider(provider);
      const nextProvider = response.data.provider;
      setShippingProviderStatuses((prev) => ({
        ...prev,
        [provider]: nextProvider,
      }));
      setShippingProviderForms((prev) => ({
        ...prev,
        [provider]: createShippingProviderFormState(nextProvider),
      }));
      toast.success(
        t(
          'settings.shippingProviderDisconnected',
          '{{provider}} disconnected.',
          { provider: providerLabel }
        )
      );
    } catch (error: unknown) {
      console.error(`Error disconnecting ${provider}:`, error);
      const apiError = error as { response?: { data?: { message?: string } } };
      toast.error(
        apiError?.response?.data?.message ||
          t(
            'settings.shippingProviderDisconnectFailed',
            'Failed to disconnect {{provider}}.',
            { provider: providerLabel }
          )
      );
    } finally {
      setShippingProviderActionKey(null);
    }
  };

  const sectionItems: Array<{
    key: SettingsSectionKey;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'profile',
      title: t('settings.profile', 'Profile'),
      subtitle: t('settings.profileDesc', 'Account info, password, and business details'),
      icon: UserRound,
    },
    {
      key: 'preferences',
      title: t('settings.preferences', 'Preferences'),
      subtitle: t('settings.preferencesDesc', 'Theme, language, and currency'),
      icon: Palette,
    },
    {
      key: 'niche',
      title: t('settings.nicheTitle', 'Business Niche'),
      subtitle: t('settings.nicheDesc', 'Your selected specialization and personalization'),
      icon: Sparkles,
    },
    {
      key: 'backup',
      title: t('settings.backupSystem', 'Backup System'),
      subtitle: t('settings.backupDesc', 'Run, download, and restore backups'),
      icon: Database,
    },
    {
      key: 'notifications',
      title: t('settings.notifications', 'Notifications'),
      subtitle: t('settings.notificationsDesc', 'Control alerts and updates'),
      icon: Bell,
    },
    {
      key: 'integrations',
      title: t('settings.integrations', 'Integrations'),
      subtitle: t(
        'settings.integrationsDesc',
        'Connect Shopify and shipping providers for ecommerce orders'
      ),
      icon: Globe,
    },
    {
      key: 'subscription',
      title: t('settings.subscription', 'Subscription'),
      subtitle: t('settings.subscriptionDesc', 'Manage your plan'),
      icon: CreditCard,
    },
  ];

  const activeSectionItem =
    sectionItems.find((section) => section.key === activeSection) || sectionItems[0];
  const switchRowClassName = 'flex items-center justify-between gap-3';
  const switchTextBlockClassName = `space-y-0.5 ${isRTL ? 'text-right' : 'text-left'}`;
  const displayedShopifyEvents = shopifyEvents.length > 0 ? shopifyEvents : shopifyRecentEvents;

  const passwordCardText = {
    changePassword: t('settings.changePassword', 'Change Password'),
    currentPassword: t('settings.currentPassword', 'Current Password'),
    newPassword: t('settings.newPassword', 'New Password'),
    confirmNewPassword: t('settings.confirmNewPassword', 'Confirm New Password'),
    updatingPassword: t('settings.updatingPassword', 'Updating Password...'),
    updatePassword: t('settings.updatePassword', 'Update Password'),
    minimumSixChars: t('settings.passwordMinHint', 'Minimum 6 characters'),
  };

  const renderYalidineProviderFields = (
    provider: ShippingProviderKey,
    providerForm: ShippingProviderFormState,
    providerStatus: ShippingProviderConnectionStatus | null,
    isProviderBusy: boolean
  ) => (
    <>
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        {t(
          'settings.yalidineHelper',
          'Enter your Yalidine API ID, API token, and the sender wilaya used for parcel creation. Stockly fills the customer, address, COD amount, and product list from each order automatically.'
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label>{t('settings.shippingProviderApiId', 'API ID')}</Label>
          <Input
            value={providerForm.authId}
            onChange={(event) => handleShippingProviderFormChange(provider, 'authId', event.target.value)}
            placeholder="123456"
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('settings.shippingProviderApiToken', 'API token')}</Label>
          <Input
            type="password"
            value={providerForm.apiToken}
            onChange={(event) => handleShippingProviderFormChange(provider, 'apiToken', event.target.value)}
            placeholder={t('settings.shippingProviderTokenPlaceholder', 'Paste a fresh token')}
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
          {providerStatus?.isActive && (
            <p className="text-xs text-muted-foreground">
              {t(
                'settings.shippingProviderTokenHidden',
                'Stored tokens stay hidden after save. Leave this blank to keep the current token, or enter a new token to replace it.'
              )}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('settings.shippingProviderFromWilaya', 'Sender wilaya')}</Label>
          <Input
            value={providerForm.fromWilayaName}
            onChange={(event) => handleShippingProviderFormChange(provider, 'fromWilayaName', event.target.value)}
            placeholder="Alger"
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 p-4 space-y-3">
        <div className="space-y-1">
          <p className="font-medium">
            {t('settings.shippingProviderStopdeskId', 'Default stop desk ID')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              'settings.yalidineStopdeskHelper',
              'Only fill this if your Stockly orders use Stop Desk delivery and Yalidine expects a fixed stop desk ID.'
            )}
          </p>
        </div>
        <Input
          value={providerForm.defaultStopdeskId}
          onChange={(event) =>
            handleShippingProviderFormChange(provider, 'defaultStopdeskId', event.target.value)
          }
          placeholder="123"
          disabled={!canUseShippingIntegrations || isProviderBusy}
        />
      </div>
    </>
  );

  const renderZrExpressProviderFields = (
    provider: ShippingProviderKey,
    providerForm: ShippingProviderFormState,
    providerStatus: ShippingProviderConnectionStatus | null,
    isProviderBusy: boolean
  ) => (
    <>
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        {t(
          'settings.zrHelper',
          'Enter your ZR Express API key and token. Stockly sends the customer name, phone, address, commune, wilaya, amount to collect, and product list from each order.'
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('settings.shippingProviderApiKey', 'API key')}</Label>
          <Input
            value={providerForm.authId}
            onChange={(event) => handleShippingProviderFormChange(provider, 'authId', event.target.value)}
            placeholder="key"
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('settings.shippingProviderApiToken', 'API token')}</Label>
          <Input
            type="password"
            value={providerForm.apiToken}
            onChange={(event) => handleShippingProviderFormChange(provider, 'apiToken', event.target.value)}
            placeholder={t('settings.shippingProviderTokenPlaceholder', 'Paste a fresh token')}
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
          {providerStatus?.isActive && (
            <p className="text-xs text-muted-foreground">
              {t(
                'settings.shippingProviderTokenHidden',
                'Stored tokens stay hidden after save. Leave this blank to keep the current token, or enter a new token to replace it.'
              )}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
        {t(
          'settings.zrAddressHint',
          'For the best ZR match, store the customer city as "Commune, Wilaya" or fill the customer state with the wilaya name.'
        )}
      </div>
    </>
  );

  const renderNoestProviderFields = (
    provider: ShippingProviderKey,
    providerForm: ShippingProviderFormState,
    providerStatus: ShippingProviderConnectionStatus | null,
    isProviderBusy: boolean
  ) => (
    <>
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        {t(
          'settings.noestHelper',
          'Enter the exact NOEST credentials from Ecotrack: api_token and user_guid. Stockly creates the order from your customer, address, wilaya, amount, products, and quantities, then validates it automatically.'
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>user_guid</Label>
          <Input
            value={providerForm.authId}
            onChange={(event) =>
              handleShippingProviderFormChange(provider, 'authId', event.target.value)
            }
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
        </div>
        <div className="space-y-2">
          <Label>api_token</Label>
          <Input
            type="password"
            value={providerForm.apiToken}
            onChange={(event) =>
              handleShippingProviderFormChange(provider, 'apiToken', event.target.value)
            }
            placeholder={t('settings.shippingProviderTokenPlaceholder', 'Paste a fresh token')}
            disabled={!canUseShippingIntegrations || isProviderBusy}
          />
          {providerStatus?.isActive && (
            <p className="text-xs text-muted-foreground">
              {t(
                'settings.shippingProviderTokenHidden',
                'Stored tokens stay hidden after save. Leave this blank to keep the current token, or enter a new token to replace it.'
              )}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
        {t(
          'settings.noestAddressHint',
          'For NOEST, keep the customer state as the wilaya name, or store the city as "Commune, Wilaya" so Stockly can send the correct wilaya_id and commune.'
        )}
      </div>
    </>
  );

  const renderWorldExpressProviderFields = (
    provider: ShippingProviderKey,
    providerForm: ShippingProviderFormState,
    providerStatus: ShippingProviderConnectionStatus | null,
    isProviderBusy: boolean
  ) => (
    <>
      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        {t(
          'settings.worldExpressHelper',
          'Enter the World Express Ecotrack API token. Stockly creates the order with the documented /api/v1/create/order flow, then validates and ships it automatically.'
        )}
      </div>

      <div className="space-y-2">
        <Label>{t('settings.shippingProviderApiToken', 'API token')}</Label>
        <Input
          type="password"
          value={providerForm.apiToken}
          onChange={(event) =>
            handleShippingProviderFormChange(provider, 'apiToken', event.target.value)
          }
          placeholder={t('settings.shippingProviderTokenPlaceholder', 'Paste a fresh token')}
          disabled={!canUseShippingIntegrations || isProviderBusy}
        />
        {providerStatus?.isActive && (
          <p className="text-xs text-muted-foreground">
            {t(
              'settings.shippingProviderTokenHidden',
              'Stored tokens stay hidden after save. Leave this blank to keep the current token, or enter a new token to replace it.'
            )}
          </p>
        )}
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
        {t(
          'settings.worldExpressAddressHint',
          'World Express expects a valid commune and numeric wilaya code. Keep the customer state as the wilaya name, or store the city as \"Commune, Wilaya\" so Stockly can map it correctly.'
        )}
      </div>
    </>
  );

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settings.avatarTooLarge', 'Image must be under 2 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setProfileImagePreview(dataUrl);
      setProfileForm((prev) => ({ ...prev, profileImageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setProfileImagePreview('');
    setProfileForm((prev) => ({ ...prev, profileImageUrl: '' }));
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsProfileSaving(true);
    try {
      const response = await authAPI.updateSettings({
        profile: {
          name: profileForm.name,
          profileImageUrl: profileForm.profileImageUrl,
        },
      });
      const updated = response.data;
      updateUser({
        name: updated.profile.name,
        profileImageUrl: updated.profile.profileImageUrl,
      });
      toast.success(t('settings.profileSaved', 'Profile updated'));
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      toast.error(message || t('settings.profileSaveError', 'Failed to update profile'));
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleRequestEmailChangeCode = async () => {
    const trimmed = newEmailInput.trim();
    if (!trimmed) return;
    setIsRequestingEmailCode(true);
    setEmailChangeError(null);
    try {
      const res = await authAPI.requestEmailChangeCode(trimmed);
      setEmailChangeMaskedEmail(res.data?.maskedEmail || '');
      setEmailChangeStep('code');
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setEmailChangeError(message || t('settings.emailChangeCodeFailed', 'Failed to send confirmation code.'));
    } finally {
      setIsRequestingEmailCode(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (emailChangeCode.length !== 6) return;
    setIsConfirmingEmailChange(true);
    setEmailChangeError(null);
    try {
      const res = await authAPI.confirmEmailChange(emailChangeCode);
      const newEmail = res.data?.email;
      if (newEmail) {
        updateUser({ email: newEmail });
        setProfileForm((prev) => ({ ...prev, email: newEmail }));
      }
      setEmailChangeDialogOpen(false);
      toast.success(t('settings.emailChanged', 'Email updated successfully'));
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setEmailChangeError(message || t('settings.emailChangeFailed', 'Failed to change email.'));
    } finally {
      setIsConfirmingEmailChange(false);
    }
  };

  const renderProfileSection = () => (
    <div className="space-y-3">
      {/* Personal Info + Avatar Card */}
      <Card className="rounded-md border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <UserRound className="w-5 h-5" />
            {t('settings.personalProfile', 'Personal Profile')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-5">
            {/* Avatar row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors"
                  aria-label={t('settings.changePhoto', 'Change photo')}
                >
                  <Camera className="h-3 w-3" />
                </button>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{profileForm.name || user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{profileForm.email || user?.email}</p>
                {profileImagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-xs text-destructive hover:underline mt-0.5"
                  >
                    {t('settings.removePhoto', 'Remove photo')}
                  </button>
                )}
              </div>
            </div>

            <Separator />

            {/* Name field */}
            <div className="space-y-1.5">
              <Label htmlFor="profileName">{t('settings.fullName', 'Full Name')}</Label>
              <Input
                id="profileName"
                value={profileForm.name}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>

            {/* Email (read-only, change via dialog) */}
            <div className="space-y-1.5">
              <Label>{t('common.email', 'Email')}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-sm sm:flex-1">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-foreground">{profileForm.email}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full shrink-0 gap-1.5 sm:w-auto"
                  onClick={() => {
                    setNewEmailInput('');
                    setEmailChangeCode('');
                    setEmailChangeStep('input');
                    setEmailChangeError(null);
                    setEmailChangeDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t('settings.changeEmail', 'Change')}
                </Button>
              </div>
            </div>

            <Button type="submit" disabled={isProfileSaving} className="w-full sm:w-auto">
              {isProfileSaving
                ? t('common.saving', 'Saving...')
                : t('common.save', 'Save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security Card — Password */}
      <Card className="rounded-md border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {passwordCardText.changePassword}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">
                {passwordCardText.currentPassword}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => handlePasswordInputChange('currentPassword', event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword">{passwordCardText.newPassword}</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => handlePasswordInputChange('newPassword', event.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="whitespace-nowrap">
                {passwordCardText.confirmNewPassword}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => handlePasswordInputChange('confirmPassword', event.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-3 sm:flex-row sm:items-center sm:gap-3">
              <Button type="submit" disabled={isPasswordSaving}>
                {isPasswordSaving
                  ? passwordCardText.updatingPassword
                  : passwordCardText.updatePassword}
              </Button>
              <p className="text-xs text-muted-foreground">
                {passwordCardText.minimumSixChars}
              </p>
            </div>
            {passwordFeedback && (
              <div
                className={`md:col-span-3 rounded-md px-3 py-2 text-sm ${
                  passwordFeedback.type === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {passwordFeedback.message}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Business Profile Card */}
      <Card className="rounded-md border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('settings.businessProfile', 'Business Profile')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleBusinessProfileSave}>
            <div className="space-y-1">
              <Label>{t('settings.businessName', 'Business Name')}</Label>
              <Input
                value={businessProfileForm.businessName}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, businessName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('settings.contactName', 'Contact Name')}</Label>
              <Input
                value={businessProfileForm.contactName}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, contactName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('common.email', 'Email')}</Label>
              <Input
                value={businessProfileForm.email}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('common.phone', 'Phone')}</Label>
              <Input
                value={businessProfileForm.phone}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>{t('settings.businessAddress', 'Business Address')}</Label>
              <Input
                value={businessProfileForm.address}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, address: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>NIF</Label>
              <Input
                value={businessProfileForm.nif}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, nif: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>RC</Label>
              <Input
                value={businessProfileForm.rc}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, rc: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>NIS</Label>
              <Input
                value={businessProfileForm.nis}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, nis: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>AI</Label>
              <Input
                value={businessProfileForm.ai}
                onChange={(event) =>
                  setBusinessProfileForm((prev) => ({ ...prev, ai: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-3 pt-2 md:col-span-2 xl:col-span-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.businessProfileDesc',
                  'These legal details are snapshotted onto invoices when they are created.'
                )}
              </p>
              <Button type="submit" className="w-full sm:w-auto" disabled={isBusinessProfileSaving}>
                {isBusinessProfileSaving
                  ? t('common.saving', 'Saving...')
                  : t('common.save', 'Save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Email Change Dialog */}
      <Dialog
        open={emailChangeDialogOpen}
        onOpenChange={(open) => {
          if (isRequestingEmailCode || isConfirmingEmailChange) return;
          setEmailChangeDialogOpen(open);
          if (!open) {
            setNewEmailInput('');
            setEmailChangeCode('');
            setEmailChangeStep('input');
            setEmailChangeError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('settings.changeEmailTitle', 'Change Email Address')}
            </DialogTitle>
            <DialogDescription>
              {emailChangeStep === 'input'
                ? t('settings.changeEmailDesc', 'Enter your new email address. A confirmation code will be sent to your current email.')
                : t(
                    'settings.changeEmailCodeDesc',
                    'Enter the 6-digit code sent to {{email}} to confirm the change.',
                  ).replace('{{email}}', emailChangeMaskedEmail)}
            </DialogDescription>
          </DialogHeader>

          {emailChangeStep === 'input' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="newEmail">{t('settings.newEmail', 'New Email')}</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => { setNewEmailInput(e.target.value); if (emailChangeError) setEmailChangeError(null); }}
                  placeholder={t('settings.newEmailPlaceholder', 'name@example.com')}
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                value={emailChangeCode}
                onChange={(e) => {
                  setEmailChangeCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (emailChangeError) setEmailChangeError(null);
                }}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
            </div>
          )}

          {emailChangeError && (
            <p className="text-sm text-destructive">{emailChangeError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (isRequestingEmailCode || isConfirmingEmailChange) return;
                setEmailChangeDialogOpen(false);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            {emailChangeStep === 'input' ? (
              <Button
                onClick={handleRequestEmailChangeCode}
                disabled={!newEmailInput.trim() || isRequestingEmailCode}
              >
                {isRequestingEmailCode
                  ? t('common.loading', 'Loading...')
                  : t('settings.sendCode', 'Send Code')}
              </Button>
            ) : (
              <Button
                onClick={handleConfirmEmailChange}
                disabled={emailChangeCode.length !== 6 || isConfirmingEmailChange}
              >
                {isConfirmingEmailChange
                  ? t('common.loading', 'Loading...')
                  : t('settings.confirmChange', 'Confirm Change')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderPreferencesSection = () => (
    <div className="grid gap-3 xl:grid-cols-2">
      <Card className="rounded-md border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {t('settings.appearance')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div>
            <Label className="mb-1.5 block">{t('settings.theme')}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleThemeChange('light')}
              >
                <Sun className="w-4 h-4 mr-2" />
                {t('settings.lightMode')}
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleThemeChange('dark')}
              >
                <Moon className="w-4 h-4 mr-2" />
                {t('settings.darkMode')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('settings.language')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div>
            <Label className="mb-1.5 block">{t('settings.language')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                variant={language === 'en' ? 'default' : 'outline'}
                className={`flex-1 ${
                  language === 'en' ? 'bg-[#7283FB] hover:bg-[#7283FB]/90 border-[#7283FB] text-white' : ''
                }`}
                onClick={() => handleLanguageChange('en')}
              >
                {t('settings.english')}
              </Button>
              <Button
                variant={language === 'ar' ? 'default' : 'outline'}
                className={`flex-1 ${
                  language === 'ar' ? 'bg-[#7283FB] hover:bg-[#7283FB]/90 border-[#7283FB] text-white' : ''
                }`}
                onClick={() => handleLanguageChange('ar')}
              >
                {t('settings.arabic')}
              </Button>
              <Button
                variant={language === 'fr' ? 'default' : 'outline'}
                className={`flex-1 ${
                  language === 'fr' ? 'bg-[#7283FB] hover:bg-[#7283FB]/90 border-[#7283FB] text-white' : ''
                }`}
                onClick={() => handleLanguageChange('fr')}
              >
                {t('settings.french')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            {t('settings.currency', 'Currency')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label className="mb-1.5 block">{t('settings.selectCurrency', 'Select Currency')}</Label>
            <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ── Niche reset handler ─────────────────────────────────────────────────────
  const [isNicheResetting, setIsNicheResetting] = React.useState(false);

  const handleNicheReset = async () => {
    setIsNicheResetting(true);
    try {
      const res = await nicheAPI.resetNiche();
      if (res.success) {
        setIsNicheResetWarningOpen(false);
        toast.success(t('settings.resetNicheSuccessRedirect', 'Niche reset. Redirecting to setup...'));
        setTimeout(() => navigate('/onboarding'), 1200);
      } else {
        toast.error(res.message ?? t('settings.resetNicheRequestFailed', 'Failed to reset. Try again.'));
      }
    } catch {
      toast.error(t('settings.resetNicheRequestFailed', 'Failed to reset. Try again.'));
    } finally {
      setIsNicheResetting(false);
    }
  };

  const NICHE_LABEL_MAP: Record<string, string> = {
    retail_shop:      t('onboarding.nicheLabelStandard', 'Standard'),
    grocery:          t('onboarding.nicheLabelSupermarket', 'Supermarket'),
    restaurant_cafe:  t('settings.nicheLabelRestaurantCafe', 'Restaurant / Café'),
    pharmacy:         t('onboarding.nicheLabelPharmacy', 'Pharmacy'),
    clothing_store:   t('onboarding.nicheLabelRetail', 'Retail'),
    beauty_salon:     t('settings.nicheLabelBeautySalon', 'Beauty Salon'),
    gym:              t('settings.nicheLabelGym', 'Gym / Sports Club'),
    school_training:  t('settings.nicheLabelSchoolTraining', 'School / Training Center'),
    startup_company:  t('settings.nicheLabelStartupCompany', 'Startup / Company'),
    electronics_shop: t('onboarding.nicheLabelEcommerce', 'E-commerce'),
    electromechanical: t('onboarding.nicheLabelHouseholdAppliances', 'Household Appliances'),
    cosmetics:        t('onboarding.nicheLabelCosmetics', 'Cosmetics / Beauty'),
    electronics_toys: t('onboarding.nicheLabelElectronicsToys', 'Electronics & Toys'),
    library:          t('onboarding.nicheLabelLibrary', 'Library'),
    other:            t('settings.nicheLabelOther', 'Other'),
  };

  const renderNicheSection = () => {
    const currentNiche = user?.selectedNiche;
    const nicheLabel = currentNiche ? (NICHE_LABEL_MAP[currentNiche] ?? currentNiche) : null;
    return (
      <>
        <Card className="rounded-md border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('settings.nicheTitle', 'Business Niche')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t('settings.currentNiche', 'Current Niche')}</p>
                {nicheLabel ? (
                  <Badge variant="secondary" className="text-sm px-3 py-1 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    {nicheLabel}
                  </Badge>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t('settings.noNicheSelected', 'No niche selected')}</p>
                )}
              </div>
              {!isSubUser() && user?.nicheOnboardingCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNicheResetWarningOpen(true)}
                  className="shrink-0"
                >
                  {t('settings.resetNiche', 'Reset Niche')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Warning AlertDialog */}
        <AlertDialog open={isNicheResetWarningOpen} onOpenChange={setIsNicheResetWarningOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.resetNicheWarningTitle', 'Reset Business Niche?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.resetNicheWarningDesc', 'This will clear your niche selection and walk you through the onboarding questionnaire again. Your business name and data will be preserved.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleNicheReset} disabled={isNicheResetting}>
                {isNicheResetting ? t('common.loading', 'Loading...') : t('settings.resetNicheConfirm', 'Reset & Re-select')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  };

  const renderBackupSection = () => {
    if (isDesktop) {
      return (
        <Card className="rounded-md border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {t('settings.backupSystem', 'Backup System')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium">
                  {t('settings.desktopLocalBackup', 'Desktop local backup')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.desktopLocalBackupDesc',
                    'Exports local SQLite data to JSON daily and keeps the last 2 backup files.'
                  )}
                </p>
              </div>
              <Badge variant="secondary">{t('settings.daily', 'Daily')}</Badge>
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                {t('settings.lastRun', 'Last run')}:{' '}
                {backupLastRun ? new Date(backupLastRun).toLocaleString(locale) : t('settings.never', 'Never')}
              </div>
              <div>
                {t('settings.nextRun', 'Next run')}:{' '}
                {backupNextRun ? new Date(backupNextRun).toLocaleString(locale) : t('settings.noneDash', '-')}
              </div>
              <div>
                {t('settings.backupFolder', 'Backup folder')}:{' '}
                {localBackupSettings.backupDir || latestLocalBackup?.backupDir || t('settings.appDataFolder', 'App data folder')}
              </div>
              {latestLocalBackup && (
                <div>
                  {t('settings.latestBackupFile', 'Latest backup')}:{' '}
                  {latestLocalBackup.fileName}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={runBackupNow}
                disabled={backupLoading}
              >
                {backupLoading
                  ? t('common.loading', 'Loading...')
                  : t('settings.runBackupNow', 'Run Backup Now')}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
    <Card className={`${isSubUser() ? 'opacity-60' : ''} rounded-md border-border/70`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          {t('settings.backupSystem', 'Backup System')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSubUser() && (
          <p className="text-sm text-muted-foreground">
            {t('settings.backupOwnerOnly', 'Backups are available only to the stock owner.')}
          </p>
        )}
        <div className={switchRowClassName}>
          <div className={switchTextBlockClassName}>
            <p className="font-medium">{t('settings.enableBackups', 'Enable Backups')}</p>
            <p className="text-sm text-muted-foreground">
              {t('settings.enableBackupsDesc', 'Keep 5 latest backups for orders and inventory.')}
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={backupEnabled}
            onCheckedChange={(checked) => updateBackupSettings({ enabled: checked })}
            disabled={backupLoading || isSubUser()}
          />
        </div>
        <Separator />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="font-medium">{t('settings.backupFrequency', 'Backup Frequency')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.backupFrequencyDesc', 'Choose how often backups run.')}</p>
          </div>
          <Select
            value={backupFrequency}
            onValueChange={(value) => updateBackupSettings({ frequency: value as 'daily' | 'weekly' | 'monthly' })}
            disabled={!backupEnabled || backupLoading || isSubUser()}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t('settings.daily', 'Daily')}</SelectItem>
              <SelectItem value="weekly">{t('settings.weekly', 'Weekly')}</SelectItem>
              <SelectItem value="monthly">{t('settings.monthly', 'Monthly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <div>
              {t('settings.lastRun', 'Last run')}:{' '}
              {backupLastRun ? new Date(backupLastRun).toLocaleString(locale) : t('settings.never', 'Never')}
            </div>
            <div>
              {t('settings.nextRun', 'Next run')}:{' '}
              {backupNextRun ? new Date(backupNextRun).toLocaleString(locale) : t('settings.noneDash', '-')}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={runBackupNow}
            disabled={!backupEnabled || backupLoading || isSubUser()}
          >
            {t('settings.runBackupNow', 'Run Backup Now')}
          </Button>
        </div>
        <Separator />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {t('settings.restoreFromBackupDesc', 'Restore from a previous backup (orders + inventory).')}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <input
              ref={restoreLocalFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                void restoreLocalBackupFromPc(event);
              }}
            />
            <Select
              value={selectedBackup}
              onValueChange={(value) => setSelectedBackup(value)}
              disabled={availableBackups.length === 0 || backupLoading || isSubUser()}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder={t('settings.selectBackup', 'Select backup')} />
              </SelectTrigger>
              <SelectContent>
                {availableBackups.map((backup) => (
                  <SelectItem key={backup.fileName} value={backup.fileName}>
                    {new Date(backup.createdAt).toLocaleString(locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => restoreLocalFileInputRef.current?.click()}
              disabled={!backupEnabled || backupLoading || isSubUser()}
            >
              {t('settings.loadBackupFromPc', 'Load Existing from PC')}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={downloadBackup}
              disabled={!selectedBackup || backupLoading || isSubUser()}
            >
              {t('settings.download', 'Download')}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={restoreBackup}
              disabled={!backupEnabled || !selectedBackup || backupLoading || isSubUser()}
            >
              {t('settings.restoreBackup', 'Restore Backup')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  const renderNotificationsSection = () => (
    <Card className="rounded-md border-border/70 xl:min-h-[410px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          {t('settings.notifications')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={switchRowClassName}>
          <div className={switchTextBlockClassName}>
            <p className="font-medium">{t('settings.emailNotifications')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.emailNotificationsDesc', 'Receive email updates about your account')}</p>
          </div>
          <Switch
            className="shrink-0"
            checked={user?.settings?.notifications?.email ?? true}
            onCheckedChange={(checked) => handleNotificationChange('email', checked)}
          />
        </div>
        <Separator />
        <div className={switchRowClassName}>
          <div className={switchTextBlockClassName}>
            <p className="font-medium">{t('settings.lowStockAlerts')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.lowStockAlertsDesc', 'Get notified when products run low')}</p>
          </div>
          <Switch
            className="shrink-0"
            checked={user?.settings?.notifications?.lowStock ?? true}
            onCheckedChange={(checked) => handleNotificationChange('lowStock', checked)}
          />
        </div>
        <Separator />
        <div className={switchRowClassName}>
          <div className={switchTextBlockClassName}>
            <p className="font-medium">{t('settings.salesAlerts')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.salesAlertsDesc', 'Receive daily sales summaries')}</p>
          </div>
          <Switch
            className="shrink-0"
            checked={user?.settings?.notifications?.sales ?? true}
            onCheckedChange={(checked) => handleNotificationChange('sales', checked)}
          />
        </div>
        <Separator />
        <div className={switchRowClassName}>
          <div className={switchTextBlockClassName}>
            <p className="font-medium">
              {t(
                'settings.smsAlerts',
                language === 'ar' ? 'تنبيهات SMS' : language === 'fr' ? 'Alertes SMS' : 'SMS Alerts'
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                'settings.smsAlertsDesc',
                language === 'ar'
                  ? 'استلم إشعارات SMS للتحديثات العاجلة'
                  : language === 'fr'
                    ? 'Recevez des notifications SMS pour les mises à jour urgentes'
                    : 'Receive SMS notifications for urgent updates'
              )}
            </p>
          </div>
          <Switch
            className="shrink-0"
            checked={smsAlertsEnabled}
            onCheckedChange={setSmsAlertsEnabled}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderIntegrationsSection = () => (
    <>
      <Card className={`${!canUseEcommerceIntegrations ? 'opacity-60' : ''} rounded-md border-border/70`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('settings.integrations', 'Integrations')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasShippingCapability && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t(
                  'settings.integrationsBusinessTypeRequired',
                  'Integrations require a business type with shipping capabilities. Update your business niche in settings to enable this feature.'
                )}
              </p>
            </div>
          )}
          {hasShippingCapability && !canManageEcommerceAccess && (
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t(
                  'settings.integrationsNoAccess',
                  'You do not have permission to manage integrations in this workspace.'
                )}
              </p>
            </div>
          )}

          {/* Sales Channels */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t('settings.salesChannels', 'Sales Channels')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('settings.salesChannelsDesc', 'Connect storefronts that send orders into Stockly.')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveIntegrationDialog('shopify')}
              disabled={!canUseEcommerceIntegrations}
              className="group w-full rounded-md border border-border/70 bg-card p-5 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md disabled:cursor-not-allowed disabled:hover:border-border/70 disabled:hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-md bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">Shopify</p>
                    <Badge
                      variant={shopifyStatus?.isActive ? 'default' : 'outline'}
                      className={shopifyStatus?.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {shopifyStatus?.isActive
                        ? t('settings.shopifyConnectedBadge', 'Connected')
                        : t('settings.shopifyDisconnectedBadge', 'Needs connection')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                    {shopifyStatus?.isActive
                      ? t('settings.shopifyConnectedLabel', 'Connected to {{shop}}', { shop: shopifyStatus.shop })
                      : t('settings.shopifyFlowHelperShort', 'Import orders and sync inventory with your Shopify store.')}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </div>
              {shopifyStatus?.isActive && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                  {shopifyStatus.lastSyncedAt && (
                    <span>{t('settings.shopifyLastSync', 'Last sync: {{time}}', { time: new Date(shopifyStatus.lastSyncedAt).toLocaleString(locale) })}</span>
                  )}
                  <span>{t('settings.shopifyMappedItems', 'Mapped items')}: {shopifyStatus.mappingSummary?.mapped ?? 0}/{shopifyStatus.mappingSummary?.total ?? 0}</span>
                  {(shopifyStatus.eventSummary?.failed ?? 0) > 0 && (
                    <span className="text-amber-600">{t('settings.shopifyFailedEvents', 'Failed events')}: {shopifyStatus.eventSummary?.failed}</span>
                  )}
                </div>
              )}
            </button>
          </div>

          <Separator />

          {/* Shipping Providers */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t('settings.shippingProviders', 'Shipping Providers')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('settings.shippingProvidersDesc', 'Connect your delivery account once, then choose one or many ecommerce orders and send them directly to your courier.')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SHIPPING_PROVIDER_OPTIONS.map((providerOption) => {
                const providerStatus = shippingProviderStatuses[providerOption.value];
                const ProviderIcon =
                  providerOption.value === 'noest_express' || providerOption.value === 'world_express'
                    ? PackageCheck
                    : Truck;

                return (
                  <button
                    key={providerOption.value}
                    type="button"
                    onClick={() => setActiveIntegrationDialog(providerOption.value)}
                    disabled={!canUseShippingIntegrations}
                    className="group w-full rounded-md border border-border/70 bg-card p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md disabled:cursor-not-allowed disabled:hover:border-border/70 disabled:hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-sky-100 p-2.5 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                        <ProviderIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{providerOption.label}</p>
                          <div className={`h-2 w-2 rounded-full ${providerStatus?.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{providerOption.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </div>
                    {providerStatus?.isActive && providerStatus.lastConnectedAt && (
                      <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        {t('settings.shippingProviderConnectedAt', 'Connected: {{time}}', { time: new Date(providerStatus.lastConnectedAt).toLocaleString(locale) })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {shippingProvidersLoading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                {t('settings.shippingProvidersLoading', 'Loading shipping provider settings...')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={activeIntegrationDialog === 'shopify'}
        onOpenChange={(open) => setActiveIntegrationDialog(open ? 'shopify' : null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Shopify</DialogTitle>
            <DialogDescription>
              {t(
                'settings.shopifyDialogDesc',
                'Use the store owner\'s Shopify admin domain, then continue to Shopify so they can approve Stockly securely.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={shopifyStatus?.isActive ? 'secondary' : 'outline'}>
                    {shopifyStatus?.isActive
                      ? t('settings.shopifyConnectedBadge', 'Connected')
                      : t('settings.shopifyDisconnectedBadge', 'Needs connection')}
                  </Badge>
                  <Badge variant="outline">
                    {t('settings.shopifyApiVersion', 'API version')}: {shopifySetup.apiVersion}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.shopifyDialogHelper',
                    'Pasting a normal website URL is not enough. Stockly must install through the merchant\'s Shopify admin domain, usually something like your-store.myshopify.com.'
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {[
                {
                  title: t('settings.shopifyStepOne', '1. Enter the Shopify admin domain'),
                  description: t(
                    'settings.shopifyStepOneDesc',
                    'Use the permanent domain like store-name.myshopify.com, not the public website URL.'
                  )
                },
                {
                  title: t('settings.shopifyStepTwo', '2. Approve access on Shopify'),
                  description: t(
                    'settings.shopifyStepTwoDesc',
                    'Stockly redirects the merchant to Shopify so they can approve your app securely.'
                  )
                },
                {
                  title: t('settings.shopifyStepThree', '3. Sync and keep orders updated'),
                  description: t(
                    'settings.shopifyStepThreeDesc',
                    'After authorization, Stockly can import orders and receive updates through Shopify webhooks.'
                  )
                }
              ].map((step) => (
                <div key={step.title} className="rounded-md border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-medium">{step.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('settings.shopifyHealth', 'Health')}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {shopifyStatus?.health
                    ? shopifyStatus.health.charAt(0).toUpperCase() + shopifyStatus.health.slice(1)
                    : t('settings.notConnected', 'Not connected')}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('settings.shopifyMappedItems', 'Mapped items')}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {shopifyStatus?.mappingSummary?.mapped ?? 0} / {shopifyStatus?.mappingSummary?.total ?? 0}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('settings.shopifyFailedEvents', 'Failed events')}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {shopifyStatus?.eventSummary?.failed ?? 0}
                </p>
              </div>
              <div className="rounded-md border bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('settings.shopifyLocation', 'Location')}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {shopifyStatus?.primaryLocationName || '-'}
                </p>
              </div>
            </div>

            {/* Infrastructure setup warnings removed - no longer exposed to users */}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <Label>{t('settings.shopifyShop', 'Shopify shop domain')}</Label>
                <Input
                  value={shopifyShopInput}
                  onChange={(event) => setShopifyShopInput(event.target.value)}
                  placeholder={t('settings.shopifyShopPlaceholder', 'your-shop.myshopify.com')}
                  disabled={!canUseShopifyIntegrations || Boolean(shopifyStatus?.isActive)}
                />
                <p className="text-xs text-muted-foreground">
                  {t(
                    'settings.shopifyShopHint',
                    'Example: your-shop.myshopify.com. If you only have the storefront link, ask the merchant for their Shopify admin domain.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {shopifyStatus?.isActive ? (
                  <>
                    <Button variant="outline" onClick={handleShopifyTestConnection} disabled={!canUseShopifyIntegrations || shopifyTestLoading}>
                      {shopifyTestLoading
                        ? t('settings.testing', 'Testing...')
                        : t('settings.shopifyTestConnection', 'Test Connection')}
                    </Button>
                    <Button variant="outline" onClick={handleShopifySync} disabled={!canUseShopifyIntegrations || shopifySyncLoading}>
                      {shopifySyncLoading
                        ? t('settings.shopifySyncing', 'Syncing...')
                        : t('settings.shopifySync', 'Sync Orders')}
                    </Button>
                    <Button variant="outline" onClick={handleShopifyCatalogSync} disabled={!canUseShopifyIntegrations || shopifyCatalogSyncLoading}>
                      {shopifyCatalogSyncLoading
                        ? t('settings.shopifyCatalogSyncing', 'Syncing catalog...')
                        : t('settings.shopifySyncCatalog', 'Sync Catalog')}
                    </Button>
                    <Button variant="outline" onClick={handleShopifyAutoMap} disabled={!canUseShopifyIntegrations || shopifyAutoMapLoading}>
                      {shopifyAutoMapLoading
                        ? t('settings.shopifyAutoMapping', 'Matching...')
                        : t('settings.shopifyAutoMap', 'Auto Map by SKU')}
                    </Button>
                    <Button variant="outline" onClick={handleShopifyInventoryPush} disabled={!canUseShopifyIntegrations || shopifyInventoryPushLoading || !(shopifySyncOptionsDraft.allowManualInventoryPush)}>
                      {shopifyInventoryPushLoading
                        ? t('settings.shopifyInventoryPushing', 'Pushing stock...')
                        : t('settings.shopifyPushInventory', 'Push Stock to Shopify')}
                    </Button>
                    <Button variant="destructive" onClick={handleShopifyDisconnect} disabled={!canUseShopifyIntegrations || shopifyActionLoading}>
                      {shopifyActionLoading
                        ? t('settings.disconnecting', 'Disconnecting...')
                        : t('settings.shopifyDisconnect', 'Disconnect')}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleShopifyConnect}
                    disabled={
                      !canUseShopifyIntegrations ||
                      shopifyActionLoading ||
                      shopifyLoading ||
                      !shopifySetup.isAvailable
                    }
                  >
                    {shopifyActionLoading
                      ? t('settings.shopifyConnecting', 'Connecting...')
                      : t('settings.shopifyContinueToShopify', 'Continue to Shopify')}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-4 space-y-3">
              {/* Infrastructure details (redirectUri, webhookUrl) removed - no longer exposed to users */}

              <div className="flex flex-col gap-2 text-xs text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
                <span>
                  {shopifyStatus?.isActive
                    ? t('settings.shopifyConnectedLabel', 'Connected to {{shop}}', {
                        shop: shopifyStatus.shop
                      })
                    : t('settings.shopifyDisconnectedLabel', 'Not connected')}
                </span>
                {shopifyStatus?.lastSyncedAt && (
                  <span>
                    {t('settings.shopifyLastSync', 'Last sync: {{time}}', {
                      time: new Date(shopifyStatus.lastSyncedAt).toLocaleString(locale)
                    })}
                  </span>
                )}
              </div>
            </div>

            {shopifyStatus?.isActive && (
              <>
                <div className="rounded-md border bg-muted/20 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {t('settings.shopifySyncSettings', 'Sync behavior')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.shopifySyncSettingsDesc',
                          'Choose how Stockly should treat Shopify orders and inventory.'
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleShopifySettingsSave}
                      disabled={!canUseShopifyIntegrations || shopifySettingsSaving}
                    >
                      {shopifySettingsSaving
                        ? t('common.saving', 'Saving...')
                        : t('common.save', 'Save')}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="rounded-md border bg-background/60 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {t('settings.shopifyAutoImportOrders', 'Auto import webhook orders')}
                        </span>
                        <Switch
                          checked={shopifySyncOptionsDraft.autoImportOrders}
                          onCheckedChange={(checked) =>
                            setShopifySyncOptionsDraft((prev) => ({ ...prev, autoImportOrders: checked }))
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.shopifyAutoImportOrdersDesc',
                          'When enabled, valid Shopify webhooks create or update Stockly sales automatically.'
                        )}
                      </p>
                    </label>

                    <label className="rounded-md border bg-background/60 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {t('settings.shopifyFailOnUnmapped', 'Block unmapped items')}
                        </span>
                        <Switch
                          checked={shopifySyncOptionsDraft.failOnUnmappedItems}
                          onCheckedChange={(checked) =>
                            setShopifySyncOptionsDraft((prev) => ({ ...prev, failOnUnmappedItems: checked }))
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.shopifyFailOnUnmappedDesc',
                          'Recommended: keep this on so Stockly never guesses the wrong product when a Shopify SKU is unknown.'
                        )}
                      </p>
                    </label>

                    <label className="rounded-md border bg-background/60 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {t('settings.shopifyAutoSyncStatuses', 'Accept order status updates')}
                        </span>
                        <Switch
                          checked={shopifySyncOptionsDraft.autoSyncStatusUpdates}
                          onCheckedChange={(checked) =>
                            setShopifySyncOptionsDraft((prev) => ({ ...prev, autoSyncStatusUpdates: checked }))
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.shopifyAutoSyncStatusesDesc',
                          'Allow Shopify payment, fulfillment, and cancellation changes to update the existing Stockly sale.'
                        )}
                      </p>
                    </label>

                    <label className="rounded-md border bg-background/60 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">
                          {t('settings.shopifyManualInventoryPushToggle', 'Allow manual stock push')}
                        </span>
                        <Switch
                          checked={shopifySyncOptionsDraft.allowManualInventoryPush}
                          onCheckedChange={(checked) =>
                            setShopifySyncOptionsDraft((prev) => ({ ...prev, allowManualInventoryPush: checked }))
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.shopifyManualInventoryPushDesc',
                          'Stockly stays the source of truth. This only enables the manual “Push Stock to Shopify” action.'
                        )}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">
                      {t('settings.shopifyScopes', 'Granted scopes')}
                    </p>
                    {(shopifyStatus?.grantedScopes || []).map((scope) => (
                      <Badge key={scope} variant="outline">{scope}</Badge>
                    ))}
                  </div>
                  {(shopifyStatus?.missingScopes?.length || 0) > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                      {t(
                        'settings.shopifyMissingScopes',
                        'Missing Shopify scopes: {{scopes}}. Reconnect the store after updating the app scopes so Stockly can use the full integration safely.',
                        { scopes: shopifyStatus?.missingScopes?.join(', ') || '' }
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-md border bg-muted/20 p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {t('settings.shopifyMappingsTitle', 'Product mapping')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          'settings.shopifyMappingsDesc',
                          'Map Shopify variants to Stockly SKUs. Variant SKU is optional and only needed when the Stockly product has variants.'
                        )}
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Input
                        value={shopifyMappingSearch}
                        onChange={(event) => setShopifyMappingSearch(event.target.value)}
                        placeholder={t('settings.searchMappings', 'Search mappings')}
                        className="w-full sm:w-[220px]"
                      />
                      <Button variant="outline" onClick={() => void loadShopifyMappings()}>
                        {t('common.search', 'Search')}
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-md border bg-background/60">
                    <div className="grid min-w-[720px] grid-cols-[minmax(0,1.3fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_auto] gap-3 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
                      <span>{t('settings.shopifyItem', 'Shopify item')}</span>
                      <span>{t('settings.stocklySku', 'Stockly SKU')}</span>
                      <span>{t('settings.stocklyVariantSku', 'Variant SKU')}</span>
                      <span>{t('common.actions', 'Actions')}</span>
                    </div>
                    {shopifyMappingsLoading ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        {t('settings.shopifyMappingsLoading', 'Loading Shopify mappings...')}
                      </div>
                    ) : shopifyMappings.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        {t('settings.shopifyMappingsEmpty', 'No Shopify mappings yet. Sync the catalog first.')}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {shopifyMappings.map((mapping) => (
                          <div
                            key={mapping.id}
                            className="grid min-w-[720px] grid-cols-[minmax(0,1.3fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_auto] gap-3 px-4 py-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">{mapping.shopifyProductTitle}</span>
                                {mapping.shopifyVariantTitle && mapping.shopifyVariantTitle !== 'Default Title' && (
                                  <Badge variant="outline">{mapping.shopifyVariantTitle}</Badge>
                                )}
                                <Badge variant={mapping.isMapped ? 'secondary' : 'outline'}>
                                  {mapping.isMapped
                                    ? t('settings.mapped', 'Mapped')
                                    : t('settings.unmapped', 'Unmapped')}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t('settings.shopifySkuLabel', 'Shopify SKU')}: {mapping.shopifySku || '-'}
                              </p>
                            </div>
                            <Input
                              value={shopifyMappingDrafts[mapping.id]?.stocklySku || ''}
                              onChange={(event) =>
                                handleShopifyMappingDraftChange(mapping.id, 'stocklySku', event.target.value)
                              }
                              placeholder={t('settings.stocklySkuPlaceholder', 'Example: ABC-123')}
                            />
                            <Input
                              value={shopifyMappingDrafts[mapping.id]?.stocklyVariantSku || ''}
                              onChange={(event) =>
                                handleShopifyMappingDraftChange(mapping.id, 'stocklyVariantSku', event.target.value)
                              }
                              placeholder={t('settings.stocklyVariantSkuPlaceholder', 'Optional variant SKU')}
                            />
                            <Button
                              variant="outline"
                              onClick={() => void handleShopifyMappingSave(mapping.id)}
                            >
                              {t('common.save', 'Save')}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-md border bg-muted/20 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium">
                      {t('settings.shopifyEventsTitle', 'Recent webhook and sync events')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        'settings.shopifyEventsDesc',
                        'When something fails, fix the mapping or connection problem, then retry the event from here.'
                      )}
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-md border bg-background/60">
                    <div className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_120px_100px_auto] gap-3 border-b px-4 py-3 text-xs font-medium text-muted-foreground">
                      <span>{t('settings.shopifyEvent', 'Event')}</span>
                      <span>{t('common.status', 'Status')}</span>
                      <span>{t('common.attempts', 'Attempts')}</span>
                      <span>{t('common.actions', 'Actions')}</span>
                    </div>
                    {shopifyEventsLoading ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        {t('settings.shopifyEventsLoading', 'Loading Shopify events...')}
                      </div>
                    ) : displayedShopifyEvents.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground">
                        {t('settings.shopifyEventsEmpty', 'No Shopify events recorded yet.')}
                      </div>
                    ) : (
                      <div className="divide-y">
                        {displayedShopifyEvents.map((event) => (
                          <div
                            key={event.id}
                            className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_120px_100px_auto] gap-3 px-4 py-3"
                          >
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{event.topic}</p>
                              <p className="text-xs text-muted-foreground">
                                {event.orderNumber || event.resourceId || '-'}
                              </p>
                              {event.lastError && (
                                <p className="text-xs text-destructive">{event.lastError}</p>
                              )}
                            </div>
                            <div className="text-sm">{event.status}</div>
                            <div className="text-sm">{event.attempts}</div>
                            <div className="flex justify-end">
                              {event.status === 'failed' ? (
                                <Button
                                  variant="outline"
                                  onClick={() => void handleShopifyRetryEvent(event.id)}
                                  disabled={shopifyRetryingEventId === event.id}
                                >
                                  {shopifyRetryingEventId === event.id
                                    ? t('common.retrying', 'Retrying...')
                                    : t('common.retry', 'Retry')}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {event.receivedAt
                                    ? new Date(event.receivedAt).toLocaleString(locale)
                                    : '-'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {SHIPPING_PROVIDER_OPTIONS.map((providerOption) => {
        const providerStatus = shippingProviderStatuses[providerOption.value];
        const providerForm = shippingProviderForms[providerOption.value];
        const isConnecting =
          shippingProviderActionKey === `connect:${providerOption.value}`;
        const isDisconnecting =
          shippingProviderActionKey === `disconnect:${providerOption.value}`;
        const isProviderBusy = isConnecting || isDisconnecting;
        const isYalidineProvider = providerOption.value === 'yalidine_express';
        const isZrExpressProvider = providerOption.value === 'zr_express';
        const isNoestProvider = providerOption.value === 'noest_express';

        return (
          <Dialog
            key={providerOption.value}
            open={activeIntegrationDialog === providerOption.value}
            onOpenChange={(open) => setActiveIntegrationDialog(open ? providerOption.value : null)}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{providerOption.label}</DialogTitle>
                <DialogDescription>{providerOption.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={providerStatus?.isActive ? 'secondary' : 'outline'}>
                    {providerStatus?.isActive
                      ? t('settings.shippingProviderActive', 'Connected')
                      : t('settings.shippingProviderInactive', 'Not connected')}
                  </Badge>
                  {providerStatus?.lastConnectedAt && (
                    <Badge variant="outline">
                      {t('settings.shippingProviderConnectedAt', 'Connected: {{time}}', {
                        time: new Date(providerStatus.lastConnectedAt).toLocaleString(locale)
                      })}
                    </Badge>
                  )}
                  {providerStatus?.lastDispatchedAt && (
                    <Badge variant="outline">
                      {t('settings.shippingProviderLastDispatch', 'Last order sent: {{time}}', {
                        time: new Date(providerStatus.lastDispatchedAt).toLocaleString(locale)
                      })}
                    </Badge>
                  )}
                </div>

                {isYalidineProvider
                  ? renderYalidineProviderFields(providerOption.value, providerForm, providerStatus, isProviderBusy)
                  : isZrExpressProvider
                    ? renderZrExpressProviderFields(providerOption.value, providerForm, providerStatus, isProviderBusy)
                    : isNoestProvider
                      ? renderNoestProviderFields(providerOption.value, providerForm, providerStatus, isProviderBusy)
                      : renderWorldExpressProviderFields(providerOption.value, providerForm, providerStatus, isProviderBusy)}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleShippingProviderConnect(providerOption.value)}
                    disabled={!canUseShippingIntegrations || isProviderBusy || shippingProvidersLoading}
                  >
                    {isConnecting
                      ? t('common.saving', 'Saving...')
                      : providerStatus?.isActive
                        ? t('settings.shippingProviderUpdate', 'Update Connection')
                        : t('settings.shippingProviderConnect', 'Connect Provider')}
                  </Button>
                  {providerStatus?.isActive && (
                    <Button
                      variant="destructive"
                      onClick={() => handleShippingProviderDisconnect(providerOption.value)}
                      disabled={!canUseShippingIntegrations || isProviderBusy}
                    >
                      {isDisconnecting
                        ? t('settings.disconnecting', 'Disconnecting...')
                        : t('settings.shippingProviderDisconnect', 'Disconnect')}
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })}
    </>
  );
  const renderSubscriptionSection = () => (
    <SubscriptionPanel />
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSection();
      case 'preferences':
        return renderPreferencesSection();
      case 'niche':
        return renderNicheSection();
      case 'backup':
        return renderBackupSection();
      case 'notifications':
        return renderNotificationsSection();
      case 'integrations':
        return renderIntegrationsSection();
      case 'subscription':
        return renderSubscriptionSection();
      default:
        return renderProfileSection();
    }
  };
  const SectionChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="page-shell min-h-[calc(100vh-9rem)] bg-[#F0F0F0] dark:bg-[#333333]">
      {/* Mobile horizontal tab bar */}
      <div className="xl:hidden">
        <div className="overflow-x-auto rounded-md border border-border/70 bg-card p-2 shadow-sm">
          <div className="flex gap-1.5">
            {sectionItems.map((section) => {
              const Icon = section.icon;
              const selected = activeSection === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                    selected
                      ? 'bg-[#001EF4] text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden xl:block xl:sticky xl:top-24 h-fit">
          <div className="rounded-md border border-border/70 bg-card p-3 shadow-sm xl:min-h-[520px]">
            <div className="px-3 py-2">
              <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
            </div>
            <div className="mt-2 space-y-1">
              {sectionItems.map((section) => {
                const Icon = section.icon;
                const selected = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={`w-full rounded-md px-3 py-3 text-left transition-all ${
                      selected
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{section.title}</div>
                        <div className="text-xs text-muted-foreground">{section.subtitle}</div>
                      </div>
                      <SectionChevronIcon
                        className={`h-4 w-4 transition-transform ${
                          selected ? (isRTL ? '-translate-x-0.5' : 'translate-x-0.5') : ''
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {activeSection !== 'subscription' && (
            <div className="rounded-md border border-border/70 bg-card p-4 shadow-sm">
              <h2 className="text-lg font-semibold">{activeSectionItem.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{activeSectionItem.subtitle}</p>
            </div>
          )}

          {renderActiveSection()}
        </section>
      </div>

      <AlertDialog open={isCurrencyErrorOpen} onOpenChange={setIsCurrencyErrorOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-700">
              {t('settings.cannotSwitchCurrency', 'Cannot switch currency')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currencyErrorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {currencyErrorSamples.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {currencyErrorSamples.map((product, index) => (
                <div key={`${product.name}-${index}`}>
                  {product.name}: {product.price}
                  {product.secondPrice !== null && Number.isFinite(product.secondPrice)
                    ? ` | ${t('settings.secondPriceLabel', 'Second price')}: ${product.secondPrice}`
                    : ''}
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsCurrencyErrorOpen(false)}>
              {t('common.ok', 'OK')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;

