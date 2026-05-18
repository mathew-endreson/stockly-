import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Building2,
  ChevronDown,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import {
  MdDashboard,
  MdBarChart,
  MdInventory2,
  MdStorefront,
  MdReceiptLong,
  MdPayments,
  MdPeopleAlt,
  MdGroups,
  MdOutlineVisibility,
  MdOutlineSettings,
  MdLocalShipping,
} from 'react-icons/md';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { authAPI } from '@/services/api';
import type { BusinessType } from '@/types';
import BrandLogo from '@/components/BrandLogo';
import StockSwitcher from './StockSwitcher';
import NotificationsPanel from './NotificationsPanel';
import AIAssistantPanel from './AIAssistantPanel';
import BusinessTypeSelectionGate from './BusinessTypeSelectionGate';
import { isDesktopRuntime, isOnline } from '@/shared/platform/platform';
import {
  getWorkspacePlanId,
  hasPlanFeature,
  type SubscriptionFeatureKey,
} from '@/lib/subscriptionPlans';

const TEAM_ROLE_PERMISSIONS = {
  viewer: {
    canView: true,
    canViewAnalytics: false,
    canViewBalance: false,
    canViewProductCost: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageSales: false,
    canManageEcommerce: false,
    canViewExpenses: false,
    canManageExpenses: false,
    canApproveExpenses: false,
    canViewSensitiveExpenses: false,
    canManageReimbursements: false,
  },
  seller: {
    canView: true,
    canViewAnalytics: false,
    canViewBalance: false,
    canViewProductCost: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canManageSales: true,
    canManageEcommerce: true,
    canViewExpenses: false,
    canManageExpenses: false,
    canApproveExpenses: false,
    canViewSensitiveExpenses: false,
    canManageReimbursements: false,
  },
  editor: {
    canView: true,
    canViewAnalytics: true,
    canViewBalance: false,
    canViewProductCost: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canManageSales: true,
    canManageEcommerce: false,
    canViewExpenses: true,
    canManageExpenses: true,
    canApproveExpenses: false,
    canViewSensitiveExpenses: false,
    canManageReimbursements: false,
  },
  manager: {
    canView: true,
    canViewAnalytics: true,
    canViewBalance: true,
    canViewProductCost: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canManageSales: true,
    canManageEcommerce: true,
    canViewExpenses: true,
    canManageExpenses: true,
    canApproveExpenses: true,
    canViewSensitiveExpenses: true,
    canManageReimbursements: true,
  },
} as const;

type TeamRoleKey = keyof typeof TEAM_ROLE_PERMISSIONS;

const normalizeTeamPermissions = (permissions?: Record<string, boolean> | null) => ({
  canView: Boolean(permissions?.canView),
  canViewAnalytics: Boolean(permissions?.canViewAnalytics),
  canViewBalance:
    typeof permissions?.canViewBalance === 'boolean'
      ? permissions.canViewBalance
      : Boolean(permissions?.canManageUsers),
  canViewProductCost:
    typeof permissions?.canViewProductCost === 'boolean'
      ? permissions.canViewProductCost
      : Boolean(permissions?.canEdit),
  canEdit: Boolean(permissions?.canEdit),
  canDelete: Boolean(permissions?.canDelete),
  canManageUsers: Boolean(permissions?.canManageUsers),
  canManageSales: Boolean(permissions?.canManageSales),
  canManageEcommerce: Boolean(permissions?.canManageEcommerce),
  canViewExpenses: Boolean(permissions?.canViewExpenses),
  canManageExpenses: Boolean(permissions?.canManageExpenses),
  canApproveExpenses: Boolean(permissions?.canApproveExpenses),
  canViewSensitiveExpenses: Boolean(permissions?.canViewSensitiveExpenses),
  canManageReimbursements: Boolean(permissions?.canManageReimbursements),
});

const resolveTeamRoleFromPermissions = (permissions?: Record<string, boolean> | null): TeamRoleKey | 'custom' => {
  const normalized = normalizeTeamPermissions(permissions);
  const entries = Object.entries(TEAM_ROLE_PERMISSIONS) as Array<
    [TeamRoleKey, (typeof TEAM_ROLE_PERMISSIONS)[TeamRoleKey]]
  >;
  const match = entries.find(([, base]) =>
    Object.keys(base).every(
      (key) => base[key as keyof typeof base] === normalized[key as keyof typeof normalized]
    )
  );
  return match ? match[0] : 'custom';
};

const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    logout,
    updateUser,
    isSubUser,
    canManageEcommerce,
    canViewAnalytics,
    canManageSales,
    canViewExpenses
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, isRTL } = useLanguage();
  const languageShortLabel = language === 'ar' ? 'Ar' : language === 'fr' ? 'Fr' : 'Eng';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedBusinessType, setSelectedBusinessType] = useState<BusinessType | null>(null);
  const [businessTypeError, setBusinessTypeError] = useState<string | null>(null);
  const [isSavingBusinessType, setIsSavingBusinessType] = useState(false);
  const [isOrdersQuickViewSidebarMode, setIsOrdersQuickViewSidebarMode] = useState(false);
  const [hasConnectionIssue, setHasConnectionIssue] = useState(false);
  const [navigatorOnline, setNavigatorOnline] = useState(() => isOnline());
  const isSettingsRoute = location.pathname.startsWith('/dashboard/settings');
  const isCompactSidebar = isSettingsRoute || isOrdersQuickViewSidebarMode;
  const isDesktopDisconnected = isDesktopRuntime() && (!navigatorOnline || hasConnectionIssue);
  const teamRole = isSubUser() ? resolveTeamRoleFromPermissions(user?.permissions as Record<string, boolean> | undefined) : null;
  const isSellerSalesOnly = isSubUser() && teamRole === 'seller';
  const dashboardHomeHref = isSellerSalesOnly ? '/dashboard/ecommerce' : '/dashboard';
  const workspacePlan = getWorkspacePlanId(user);

  const requiresBusinessTypeSelection = !user?.businessType;
  const requiresNicheQuestionnaire = Boolean(user?.businessType && !user?.nicheOnboardingCompleted);

  // Non-subusers without businessType or without niche onboarding go to /onboarding
  useEffect(() => {
    if ((requiresBusinessTypeSelection || requiresNicheQuestionnaire) && !isSubUser()) {
      navigate('/onboarding', { replace: true });
    }
  }, [requiresBusinessTypeSelection, requiresNicheQuestionnaire, isSubUser, navigate]);

  useEffect(() => {
    setSelectedBusinessType((user?.businessType as BusinessType) || null);
  }, [user?.businessType]);

  useEffect(() => {
    const handleOrdersQuickViewModeChange = (
      event: Event
    ) => {
      const customEvent = event as CustomEvent<{ enabled?: boolean }>;
      setIsOrdersQuickViewSidebarMode(Boolean(customEvent.detail?.enabled));
    };

    window.addEventListener(
      'stockly:orders-quick-view-mode',
      handleOrdersQuickViewModeChange as EventListener
    );

    return () => {
      window.removeEventListener(
        'stockly:orders-quick-view-mode',
        handleOrdersQuickViewModeChange as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!isSellerSalesOnly) return;
    if (location.pathname.startsWith('/dashboard/ecommerce')) return;
    navigate('/dashboard/ecommerce', { replace: true });
  }, [isSellerSalesOnly, location.pathname, navigate]);

  useEffect(() => {
    const updateNavigatorState = () => {
      const nextOnline = isOnline();
      setNavigatorOnline(nextOnline);
      if (nextOnline) setHasConnectionIssue(false);
    };
    const handleConnectivity = (event: Event) => {
      const customEvent = event as CustomEvent<{ online?: boolean }>;
      if (typeof customEvent.detail?.online === 'boolean') {
        setHasConnectionIssue(!customEvent.detail.online);
      }
    };

    window.addEventListener('online', updateNavigatorState);
    window.addEventListener('offline', updateNavigatorState);
    window.addEventListener('stockly:desktop-connectivity', handleConnectivity as EventListener);
    updateNavigatorState();

    return () => {
      window.removeEventListener('online', updateNavigatorState);
      window.removeEventListener('offline', updateNavigatorState);
      window.removeEventListener('stockly:desktop-connectivity', handleConnectivity as EventListener);
    };
  }, []);

  // Close sidebar on Escape key (mobile)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Auto-close sidebar on route change (mobile)
  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const navigation: Array<{
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    feature?: SubscriptionFeatureKey;
  }> = [
    { name: t('common.dashboard', 'Dashboard'), href: '/dashboard', icon: MdDashboard },
    { name: t('common.analytics', 'Analytics'), href: '/dashboard/analytics', icon: MdBarChart },
    { name: t('common.inventory', 'Inventory'), href: '/dashboard/inventory', icon: MdInventory2 },
    { name: t('ecommerce.label', 'Sales'), href: '/dashboard/ecommerce', icon: MdStorefront },
    { name: t('invoices.title', 'Invoices'), href: '/dashboard/invoices', icon: MdReceiptLong, feature: 'invoicing' },
    { name: t('expenses.title', 'Expenses'), href: '/dashboard/expenses', icon: MdPayments, feature: 'expenses' },
    { name: t('common.clients', 'Clients'), href: '/dashboard/clients', icon: MdPeopleAlt },
    { name: t('distributors.title', 'Distributors'), href: '/dashboard/distributors', icon: MdLocalShipping, feature: 'distributors' },
    { name: t('team.label', 'Team'), href: '/dashboard/users', icon: MdGroups },
    { name: t('common.surveillance', 'Survaillance'), href: '/dashboard/surveillance', icon: MdOutlineVisibility, feature: 'surveillance' },
    { name: t('common.settings', 'Settings'), href: '/dashboard/settings', icon: MdOutlineSettings },
  ];

  // Sub-users without ecommerce permission shouldn't see E-commerce
  const filteredNavigation = navigation.filter(item => {
    if (item.feature && !hasPlanFeature(workspacePlan, item.feature)) {
      return false;
    }
    if (isSellerSalesOnly) {
      return item.href === '/dashboard/ecommerce';
    }
    if (item.href === '/dashboard/users' && isSubUser() && !user?.permissions?.canManageUsers) {
      return false;
    }
    if (item.href === '/dashboard/surveillance' && isSubUser() && !user?.permissions?.canManageUsers) {
      return false;
    }
    if (item.href === '/dashboard/clients' && isSubUser() && !canManageSales()) {
      return false;
    }
    if (item.href === '/dashboard/distributors' && isSubUser() && !canManageSales()) {
      return false;
    }
    if (item.href === '/dashboard/analytics' && isSubUser() && !canViewAnalytics()) {
      return false;
    }
    if (item.href === '/dashboard/ecommerce' && isSubUser() && !canManageEcommerce()) {
      return false;
    }
    if (item.href === '/dashboard/invoices' && isSubUser() && !canManageSales()) {
      return false;
    }
    if (item.href === '/dashboard/expenses' && isSubUser() && !canViewExpenses()) {
      return false;
    }
    return true;
  });

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleBusinessTypeConfirm = async () => {
    if (!selectedBusinessType) {
      setBusinessTypeError(
        t('settings.businessTypeSelectRequired', 'Please choose one business type to continue.')
      );
      return;
    }

    try {
      setIsSavingBusinessType(true);
      setBusinessTypeError(null);
      const response = await authAPI.updateBusinessType({ businessType: selectedBusinessType });
      updateUser(response.data.user);
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setBusinessTypeError(
        apiError?.response?.data?.message ||
          t('settings.businessTypeUpdateFailed', 'Unable to save business type. Please try again.')
      );
    } finally {
      setIsSavingBusinessType(false);
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  if (requiresBusinessTypeSelection && isSubUser()) {
    return (
      <BusinessTypeSelectionGate
        isSubUser={isSubUser()}
        parentName={user?.parentName}
        selectedBusinessType={selectedBusinessType}
        onSelectBusinessType={setSelectedBusinessType}
        onConfirmSelection={handleBusinessTypeConfirm}
        isSubmitting={isSavingBusinessType}
        error={businessTypeError}
      />
    );
  }

  // Non-subusers without businessType or without niche onboarding are being redirected by useEffect — render nothing
  if ((requiresBusinessTypeSelection || requiresNicheQuestionnaire) && !isSubUser()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 cursor-pointer bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sub-user Banner */}
      {isSubUser() && (
        <div className="bg-primary/10 border-b border-primary/20 px-2 sm:px-4 py-2 sticky top-0 z-40">
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 text-center text-xs sm:text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{t('subUser.accessing', 'Accessing')}</span>
            <span className="font-medium">
              {user?.parentName ? `${user.parentName}'s` : t('subUser.team', 'Team')}
            </span>
            <span className="text-muted-foreground">{t('subUser.inventoryAs', 'inventory as')}</span>
            <Badge className={`text-xs text-white ${
              (() => {
                const resolvedRole = user?.permissions
                  ? resolveTeamRoleFromPermissions(user.permissions as Record<string, boolean>)
                  : 'viewer';
                const roleColors: Record<string, string> = {
                  viewer: 'bg-blue-500',
                  seller: 'bg-orange-500',
                  editor: 'bg-green-500',
                  manager: 'bg-purple-500',
                  custom: 'bg-amber-500',
                };
                return roleColors[resolvedRole] || 'bg-gray-500';
              })()
            }`}>
              {(() => {
                if (!user?.permissions) return t('roles.viewer', 'Viewer');
                const resolvedRole = resolveTeamRoleFromPermissions(user.permissions as Record<string, boolean>);
                if (resolvedRole === 'custom') return t('team.role.custom', 'Custom');
                return t(
                  `roles.${resolvedRole}`,
                  resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1)
                );
              })()}
            </Badge>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed ${isSubUser() ? 'top-10' : 'top-0'} ${isRTL ? 'right-0' : 'left-0'} z-50 h-full w-64 bg-[#F0F0F0] shadow-2xl shadow-black/10 dark:bg-[#333333] lg:shadow-none ${
          isRTL ? 'border-l' : 'border-r'
        } border-border/70 transform transition-all duration-200 lg:translate-x-0 ${
          isCompactSidebar ? 'lg:w-20' : ''
        } ${
          sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'
        } flex flex-col`}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        {/* Sidebar Header */}
        <div className={`h-16 shrink-0 flex items-center border-b border-border/70 ${isCompactSidebar ? 'justify-center px-2 lg:px-0' : 'justify-between px-4'}`}>
          <Link to={dashboardHomeHref} className={`inline-flex items-center ${isCompactSidebar ? 'lg:justify-center' : ''}`}>
            <BrandLogo
              markClassName="h-6 w-10"
              wordmarkClassName={`text-2xl ${isCompactSidebar ? 'lg:hidden' : ''}`}
            />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Stock Switcher - Mobile only */}
        <div className="border-b border-border/70 bg-background/35 px-3 py-2 lg:hidden">
          <StockSwitcher />
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto space-y-1.5 ${isCompactSidebar ? 'p-2 lg:p-2' : 'p-3 sm:p-4'}`}>
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                title={item.name}
                aria-current={active ? 'page' : undefined}
                onClick={() => setSidebarOpen(false)}
                className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 ${
                  active
                    ? 'bg-[#E0E0E0] dark:bg-[#5E5E5E] text-foreground shadow-sm hover:bg-[#E0E0E0] dark:hover:bg-[#5E5E5E] hover:text-foreground active:bg-[#E0E0E0] dark:active:bg-[#5E5E5E] active:text-foreground'
                    : 'text-muted-foreground hover:bg-[#B9B9B9]/80 hover:text-foreground active:bg-[#B9B9B9] active:text-foreground'
                } ${
                  isCompactSidebar ? 'lg:justify-center lg:px-0' : ''
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={isCompactSidebar ? 'lg:hidden' : ''}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content */}
      <div
        className={`min-w-0 overflow-x-hidden transition-[margin] ${
          isRTL
            ? (isCompactSidebar ? 'lg:mr-20' : 'lg:mr-64')
            : (isCompactSidebar ? 'lg:ml-20' : 'lg:ml-64')
        } ${isSubUser() ? 'mt-10' : ''}`}
      >
        {/* Top Header */}
        <header className={`sticky ${isSubUser() ? 'top-10' : 'top-0'} z-30 flex min-h-14 min-w-0 items-center justify-between gap-1 overflow-x-hidden border-b border-border/70 bg-[#F0F0F0]/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-[#F0F0F0]/85 dark:bg-[#333333]/95 dark:supports-[backdrop-filter]:bg-[#333333]/85 sm:min-h-16 sm:gap-2 sm:px-4`}>
          <div className="flex min-w-0 shrink items-center gap-1 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            {/* Stock Switcher - always visible */}
            <div className="min-w-0 max-w-[104px] sm:max-w-[180px] lg:max-w-[220px] xl:max-w-none">
              <StockSwitcher />
            </div>

            {isDesktopDisconnected && (
              <div className="hidden items-center gap-1.5 sm:gap-2 rounded-md border border-amber-300 bg-amber-50 px-2 sm:px-3 py-1 text-xs sm:text-sm text-amber-900 shadow-sm sm:flex dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <WifiOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="font-medium hidden sm:inline">Offline</span>
                <span className="hidden xl:inline">Changes save locally and sync when internet returns.</span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-0.5 sm:gap-2">
            {user?.isPlatformAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-1.5 md:gap-2 text-xs md:text-sm h-8 md:h-9"
                onClick={() => navigate('/dashboard/admin')}
              >
                <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden md:inline">Admin</span>
              </Button>
            )}

            {/* Theme Toggle */}
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4 sm:w-5 sm:h-5" /> : <Sun className="w-4 h-4 sm:w-5 sm:h-5" />}
            </Button>

            {/* Language Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 sm:h-10 gap-1 px-1.5 sm:px-2 text-xs sm:text-sm font-medium"
                  aria-label={t('settings.language', 'Language')}
                >
                  <span>{languageShortLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
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

            {/* Notifications */}
            <NotificationsPanel />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex h-9 w-9 items-center gap-0 px-0 sm:h-10 sm:w-auto sm:gap-2 sm:px-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || ''} alt={user?.name || 'User'} />
                    <AvatarFallback className="bg-[#495FFA] text-sm text-white">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden max-w-[120px] overflow-hidden text-left sm:block lg:max-w-[160px]">
                    <span className="block truncate text-sm font-medium">{user?.name}</span>
                    {isSubUser() && (
                      <span className="block text-xs text-muted-foreground">{t('subUser.teamMember', 'Team Member')}</span>
                    )}
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={isRTL ? 'start' : 'end'}
                className={`w-56 ${isRTL ? 'text-right [direction:rtl]' : ''}`}
              >
                <DropdownMenuLabel className={isRTL ? 'text-right' : ''}>
                  <div className={`flex flex-col ${isRTL ? 'items-end' : ''}`}>
                    <span>{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                    {isSubUser() && (
                      <span className="text-xs text-emerald-600 mt-1">
                        {user?.parentName}'s {t('subUser.team', 'Team')}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.isPlatformAdmin && (
                  <DropdownMenuItem
                    onClick={() => navigate('/dashboard/admin')}
                    className={isRTL ? 'justify-start text-right' : ''}
                  >
                    <ShieldCheck className={`w-4 h-4 ${isRTL ? 'ml-2 mr-0' : 'mr-2'}`} />
                    Admin Panel
                  </DropdownMenuItem>
                )}
                {!isSellerSalesOnly && (
                  <DropdownMenuItem
                    onClick={() => navigate('/dashboard/settings')}
                    className={isRTL ? 'justify-start text-right' : ''}
                  >
                    <Settings className={`w-4 h-4 ${isRTL ? 'ml-2 mr-0' : 'mr-2'}`} />
                    {t('settings.title', 'Settings')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleLogout}
                  className={isRTL ? 'justify-start text-right' : ''}
                >
                  <LogOut className={`w-4 h-4 ${isRTL ? 'ml-2 mr-0' : 'mr-2'}`} />
                  {t('auth.logout', 'Logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className={`min-h-screen max-w-full overflow-x-hidden bg-[#F0F0F0] p-3 dark:bg-[#333333] sm:p-4 lg:p-6 xl:p-8 [&_[data-slot=card]]:bg-[#FCFCFC] dark:[&_[data-slot=card]]:bg-[#5E5E5E] ${isRTL ? 'text-right' : ''}`}>
          <div className="mx-auto min-w-0 max-w-full xl:max-w-[1920px]">
            <Outlet />
          </div>
        </main>
      </div>

      <AIAssistantPanel />
    </div>
  );
};

export default DashboardLayout;





