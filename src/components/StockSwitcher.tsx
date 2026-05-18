import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Users,
  Store,
  LogOut,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authAPI } from '@/services/api';
import { cn } from '@/lib/utils';
import { getBranchStockLimit } from '@/lib/subscriptionPlans';

const StockSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    user,
    accessibleStocks,
    currentStockId,
    switchStock,
    isSubUser,
    refreshAccessibleStocks,
  } = useAuth();
  const { isRTL } = useLanguage();
  
  const [isSwitching, setIsSwitching] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [stockToLeave, setStockToLeave] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchNicheMode, setBranchNicheMode] = useState<'sync' | 'custom'>('sync');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [createBranchError, setCreateBranchError] = useState<string | null>(null);

  // Delete branch state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<{ stockId: string; stockName: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'code'>('confirm');
  const [deleteCode, setDeleteCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isDeletingBranch, setIsDeletingBranch] = useState(false);
  const [isRequestingDeleteCode, setIsRequestingDeleteCode] = useState(false);
  const [deleteBranchError, setDeleteBranchError] = useState<string | null>(null);

  if (!user) return null;

  const isOwner = !isSubUser();
  const ownStockId = user.id;
  const ownStockName = user.name ? `${user.name}'s Stock` : 'My Stock';
  const ownPlan = user.ownSubscription?.plan || user.subscription?.plan || 'basic';
  const ownIsSubscribed = user.ownIsSubscribed ?? user.isSubscribed;
  const hideOwnStock = !ownIsSubscribed && accessibleStocks.length > 0;
  const canShowOwnStock = ownIsSubscribed;
  const showInviteMembers = currentStockId === ownStockId;
  const ownBranchStockLimit = getBranchStockLimit(ownPlan);
  const canCreateBranchStock = showInviteMembers && ownBranchStockLimit !== 0;
  const ownedBranchStocks = accessibleStocks.filter((stock) => stock.isOwnedStock);
  const sharedStocks = accessibleStocks.filter((stock) => !stock.isOwnedStock);

  const handleSwitchStock = async (stockId: string) => {
    if (stockId === currentStockId) return;
    
    setIsSwitching(true);
    try {
      await switchStock(stockId);
      await refreshAccessibleStocks();
      // Reload page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error('Error switching stock:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!stockToLeave) return;
    
    try {
      await authAPI.leaveTeam(stockToLeave);
      await refreshAccessibleStocks();
      setLeaveDialogOpen(false);
      setStockToLeave(null);
      // If leaving current stock, switch to own stock
      if (stockToLeave === currentStockId) {
        await switchStock(ownStockId);
        window.location.reload();
      }
    } catch (error) {
      console.error('Error leaving team:', error);
    }
  };

  const openLeaveDialog = (stockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const stock = accessibleStocks.find((item) => item.stockId === stockId);
    if (stock?.isOwnedStock) {
      return;
    }
    setStockToLeave(stockId);
    setLeaveDialogOpen(true);
  };

  const handleCreateBranchStock = async () => {
    const trimmedName = newBranchName.trim();
    if (!trimmedName || isCreatingBranch) return;
    setCreateBranchError(null);

    const normalizedName = trimmedName.toLowerCase();
    const duplicateOwnedStock = ownedBranchStocks.some((stock) => {
      const stockName = String(stock?.stockName || '').trim().toLowerCase();
      return stockName === normalizedName;
    });

    if (duplicateOwnedStock) {
      setCreateBranchError(
        t('stockSwitcher.branchExists', 'A branch stock with this name already exists.')
      );
      return;
    }

    try {
      setIsCreatingBranch(true);
      const response = await authAPI.createOwnedStock(trimmedName);
      const createdStockId = response.data?.stock?.stockId;
      await refreshAccessibleStocks();
      setCreateDialogOpen(false);
      setNewBranchName('');
      setCreateBranchError(null);
      setBranchNicheMode('sync');

      if (createdStockId && branchNicheMode === 'custom') {
        // Navigate to full branch onboarding page to customize niche
        navigate(`/branch-onboarding/${createdStockId}`, {
          state: { branchName: trimmedName },
        });
      } else if (createdStockId) {
        await switchStock(createdStockId);
        window.location.reload();
      }
    } catch (error) {
      const err = error as {
        response?: {
          status?: number;
          data?: { code?: string; message?: string; details?: { limit?: number; current?: number } };
        };
      };
      const status = err.response?.status;
      const code = String(err.response?.data?.code || '');
      const apiMessage = String(err.response?.data?.message || '').trim();

      if (status === 409 || code === 'ITEM_ALREADY_EXISTS') {
        if (code === 'BRANCH_IDENTITY_CONFLICT' || code === 'DUPLICATE_KEY_CONFLICT') {
          setCreateBranchError(
            apiMessage || t('stockSwitcher.branchCreateRetry', 'Temporary conflict while creating branch. Please retry.')
          );
        } else {
          setCreateBranchError(
            apiMessage || t('stockSwitcher.branchExists', 'A branch stock with this name already exists.')
          );
        }
      } else if (code === 'BRANCH_STOCK_LIMIT_REACHED') {
        setCreateBranchError(
          apiMessage || t('stockSwitcher.branchLimitReached', 'Branch stock limit reached for your current plan.')
        );
      } else if (code === 'SWITCH_TO_MAIN_STOCK_REQUIRED') {
        setCreateBranchError(
          apiMessage || t('stockSwitcher.switchMainFirst', 'Switch to your main stock before creating a branch.')
        );
      } else {
        setCreateBranchError(
          apiMessage || t('stockSwitcher.createBranchFailed', 'Unable to create branch stock. Please try again.')
        );
      }
      console.error('Error creating branch stock:', error);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const openDeleteDialog = (stockId: string, stockName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setStockToDelete({ stockId, stockName });
    setDeleteStep('confirm');
    setDeleteCode('');
    setMaskedEmail('');
    setDeleteBranchError(null);
    setDeleteDialogOpen(true);
  };

  const handleRequestDeleteCode = async () => {
    if (!stockToDelete) return;
    setIsRequestingDeleteCode(true);
    setDeleteBranchError(null);
    try {
      const res = await authAPI.requestBranchDeleteCode(stockToDelete.stockId);
      setMaskedEmail(res.data?.maskedEmail || '');
      setDeleteStep('code');
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setDeleteBranchError(
        err.response?.data?.message || t('stockSwitcher.deleteCodeFailed', 'Failed to send confirmation code.')
      );
    } finally {
      setIsRequestingDeleteCode(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!stockToDelete || deleteCode.length !== 6) return;
    setIsDeletingBranch(true);
    setDeleteBranchError(null);
    try {
      await authAPI.deleteBranchStock(stockToDelete.stockId, deleteCode);
      await refreshAccessibleStocks();
      setDeleteDialogOpen(false);
      setStockToDelete(null);
      // If we deleted the current stock, switch to main
      if (stockToDelete.stockId === currentStockId) {
        await switchStock(ownStockId);
        window.location.reload();
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setDeleteBranchError(
        err.response?.data?.message || t('stockSwitcher.deleteFailed', 'Failed to delete branch stock.')
      );
    } finally {
      setIsDeletingBranch(false);
    }
  };

  const getCurrentStockName = () => {
    if (currentStockId === ownStockId) {
      if (hideOwnStock && accessibleStocks.length > 0) {
        const fallback = accessibleStocks[0];
        return fallback?.stockName || fallback?.ownerName || t('stockSwitcher.sharedStock', 'Shared Stock');
      }
      return t('stockSwitcher.myStock', 'My Stock');
    }
    const stock = accessibleStocks.find((s) => s.stockId === currentStockId);
    return stock?.stockName || stock?.ownerName || t('stockSwitcher.sharedStock', 'Shared Stock');
  };

  const getCurrentStockBadge = () => {
    const roleColors: Record<string, string> = {
      viewer: 'bg-blue-500',
      seller: 'bg-orange-500',
      editor: 'bg-green-500',
      manager: 'bg-purple-500',
      custom: 'bg-amber-500',
    };
    if (currentStockId === ownStockId) {
      if (hideOwnStock && accessibleStocks.length > 0) {
        const fallbackRole = accessibleStocks[0]?.role || 'viewer';
        return (
          <Badge className={`text-xs text-white ${roleColors[fallbackRole] || 'bg-gray-500'}`}>
            {t(`team.role.${fallbackRole}`, fallbackRole.charAt(0).toUpperCase() + fallbackRole.slice(1))}
          </Badge>
        );
      }
      return (
        <Badge className="text-xs text-white bg-[#7283FB]">
          {t('stockSwitcher.owner', 'Owner')}
        </Badge>
      );
    }
    const stock = accessibleStocks.find((s) => s.stockId === currentStockId);
    if (stock?.isOwnedStock) {
      return (
        <Badge className="text-xs text-white bg-[#7283FB]">
          {t('stockSwitcher.owner', 'Owner')}
        </Badge>
      );
    }
    const effectivePermissions = user?.permissions || stock?.permissions;
    if (effectivePermissions) {
      const resolveRoleFromPermissions = (permissions: Record<string, boolean>) => {
        const normalizedPermissions = {
          ...permissions,
          canViewBalance:
            typeof permissions.canViewBalance === 'boolean' ? permissions.canViewBalance : Boolean(permissions.canManageUsers),
          canViewProductCost:
            typeof permissions.canViewProductCost === 'boolean' ? permissions.canViewProductCost : Boolean(permissions.canEdit),
          canViewExpenses: Boolean(permissions.canViewExpenses),
          canManageExpenses: Boolean(permissions.canManageExpenses),
          canApproveExpenses: Boolean(permissions.canApproveExpenses),
          canViewSensitiveExpenses: Boolean(permissions.canViewSensitiveExpenses),
          canManageReimbursements: Boolean(permissions.canManageReimbursements),
        };
        const basePermissions = {
          viewer: { canView: true, canViewAnalytics: false, canViewBalance: false, canViewProductCost: false, canEdit: false, canDelete: false, canManageUsers: false, canManageSales: false, canManageEcommerce: false, canViewExpenses: false, canManageExpenses: false, canApproveExpenses: false, canViewSensitiveExpenses: false, canManageReimbursements: false },
          seller: { canView: true, canViewAnalytics: false, canViewBalance: false, canViewProductCost: false, canEdit: false, canDelete: false, canManageUsers: false, canManageSales: true, canManageEcommerce: true, canViewExpenses: false, canManageExpenses: false, canApproveExpenses: false, canViewSensitiveExpenses: false, canManageReimbursements: false },
          editor: { canView: true, canViewAnalytics: true, canViewBalance: false, canViewProductCost: true, canEdit: true, canDelete: false, canManageUsers: false, canManageSales: true, canManageEcommerce: false, canViewExpenses: true, canManageExpenses: true, canApproveExpenses: false, canViewSensitiveExpenses: false, canManageReimbursements: false },
          manager: { canView: true, canViewAnalytics: true, canViewBalance: true, canViewProductCost: true, canEdit: true, canDelete: true, canManageUsers: true, canManageSales: true, canManageEcommerce: true, canViewExpenses: true, canManageExpenses: true, canApproveExpenses: true, canViewSensitiveExpenses: true, canManageReimbursements: true },
        } as const;
        const match = (Object.entries(basePermissions) as Array<[keyof typeof basePermissions, typeof permissions]>).find(
          ([, base]) =>
            Object.keys(base).every(
              (key) => base[key as keyof typeof base] === normalizedPermissions[key as keyof typeof normalizedPermissions]
            )
        );
        return match ? match[0] : 'custom';
      };
      const resolvedRole = resolveRoleFromPermissions(effectivePermissions);
      const label =
        resolvedRole === 'custom'
          ? t('team.role.custom', 'Custom')
          : t(`team.role.${resolvedRole}`, resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1));
      const colorKey = resolvedRole === 'custom' ? 'custom' : resolvedRole;
      return (
        <Badge className={`text-xs text-white ${roleColors[colorKey] || 'bg-gray-500'}`}>
          {label}
        </Badge>
      );
    }
    const fallbackRole = stock?.role || 'viewer';
    const fallbackLabel = t(
      `team.role.${fallbackRole}`,
      fallbackRole.charAt(0).toUpperCase() + fallbackRole.slice(1)
    );
    return (
      <Badge className={`text-xs text-white ${roleColors[fallbackRole] || 'bg-gray-500'}`}>
        {fallbackLabel}
      </Badge>
    );
  };

  // Don't show if user has no accessible stocks besides their own
  if (!isOwner && accessibleStocks.length === 0) {
    return (
      <div className={`flex min-w-0 items-center gap-2 rounded-md bg-muted px-3 py-2 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
        <Store className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{getCurrentStockName()}</span>
        <Badge variant="outline" className="text-xs">
          {t('stockSwitcher.member', 'Member')}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`flex h-auto min-w-0 shrink items-center gap-1 px-1.5 py-1.5 sm:gap-2 sm:px-3 sm:py-2 ${isRTL ? 'text-right' : ''}`}
          disabled={isSwitching}
        >
          <Building2 className="w-4 h-4 text-primary" />
          <span className="max-w-[58px] truncate text-xs font-medium sm:max-w-[150px] sm:text-sm">
            {getCurrentStockName()}
          </span>
          <span className="hidden sm:inline">{getCurrentStockBadge()}</span>
          <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRTL ? 'end' : 'start'} className="w-72 max-w-[90vw] max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>
          {t('stockSwitcher.yourStocks', 'Your Stocks')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Own Stock */}
        {canShowOwnStock && !hideOwnStock && (
          <DropdownMenuItem
            onClick={() => handleSwitchStock(ownStockId)}
            className={`flex items-center justify-between py-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}
          >
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{ownStockName}</p>
                <p className="text-xs text-muted-foreground">
                  {t('stockSwitcher.yourMainStock', 'Your main stock')}
                </p>
              </div>
            </div>
            {currentStockId === ownStockId && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        )}

        {/* Owned Branch Stocks */}
        {ownedBranchStocks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('stockSwitcher.branchStocks', 'Branch Stocks')}
            </DropdownMenuLabel>
            {ownedBranchStocks.map((stock) => (
              <div key={stock.stockId} className="relative group">
                <DropdownMenuItem
                  onClick={() => handleSwitchStock(stock.stockId)}
                  className={`flex items-center justify-between py-3 ${isRTL ? 'pl-10 flex-row-reverse text-right' : 'pr-10'}`}
                >
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {stock.stockName || `${stock.ownerName}'s Stock`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('stockSwitcher.branchLabel', 'Owned branch')}
                      </p>
                    </div>
                  </div>
                  {currentStockId === stock.stockId && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
                <button
                  onClick={(e) => openDeleteDialog(stock.stockId, stock.stockName || stock.ownerName || 'Branch', e)}
                  className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all ${
                    isRTL ? 'left-2' : 'right-2'
                  }`}
                  title={t('stockSwitcher.deleteBranch', 'Delete Branch')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Shared Stocks */}
        {sharedStocks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t('stockSwitcher.sharedWithYou', 'Shared with You')}
            </DropdownMenuLabel>
            {sharedStocks.map((stock) => (
              <div key={stock.stockId} className="relative group">
                <DropdownMenuItem
                  onClick={() => handleSwitchStock(stock.stockId)}
                  className={`flex items-center justify-between py-3 ${isRTL ? 'pl-12 flex-row-reverse text-right' : 'pr-12'}`}
                >
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {stock.stockName || `${stock.ownerName}'s Stock`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('stockSwitcher.role', 'Role:')} {stock.role}
                      </p>
                    </div>
                  </div>
                  {currentStockId === stock.stockId && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </DropdownMenuItem>
                <button
                  onClick={(e) => openLeaveDialog(stock.stockId, e)}
                  className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all ${
                    isRTL ? 'left-2' : 'right-2'
                  }`}
                  title={t('stockSwitcher.leaveTeam', 'Leave Team')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Add Stock Option */}
        {showInviteMembers && !hideOwnStock && (
          <>
            <DropdownMenuSeparator />
            {canCreateBranchStock && (
              <DropdownMenuItem
                className={`py-3 ${isRTL ? 'justify-end text-right' : ''}`}
                onClick={(event) => {
                  event.preventDefault();
                  setCreateDialogOpen(true);
                }}
              >
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-sm">
                    {t('stockSwitcher.createBranch', 'Create Branch Stock')}
                  </span>
                </div>
              </DropdownMenuItem>
            )}
            <Link to="/dashboard/users" className="block">
              <DropdownMenuItem className={`py-3 ${isRTL ? 'justify-end text-right' : ''}`}>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <Plus className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="text-sm">
                    {t('stockSwitcher.inviteMembers', 'Invite Team Members')}
                  </span>
                </div>
              </DropdownMenuItem>
            </Link>
          </>
        )}
      </DropdownMenuContent>

      {/* Leave Team Dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              {t('stockSwitcher.leaveTeamTitle', 'Leave Team?')}
            </DialogTitle>
            <DialogDescription>
              {t('stockSwitcher.leaveTeamDesc', 'Are you sure you want to leave this team? You will lose access to their inventory and will need to be invited again to regain access.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLeaveTeam}>
              {t('stockSwitcher.leaveTeam', 'Leave Team')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Branch Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingBranch) return;
          setCreateDialogOpen(open);
          if (!open) {
            setNewBranchName('');
            setBranchNicheMode('sync');
            setCreateBranchError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stockSwitcher.createBranch', 'Create Branch Stock')}</DialogTitle>
            <DialogDescription>
              {t(
                'stockSwitcher.createBranchDesc',
                'Create a workspace for a separate branch and choose its niche.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="branch-stock-name" className="text-sm font-medium">
                {t('stockSwitcher.branchName', 'Branch name')}
              </label>
              <Input
                id="branch-stock-name"
                value={newBranchName}
                onChange={(event) => {
                  setNewBranchName(event.target.value);
                  if (createBranchError) {
                    setCreateBranchError(null);
                  }
                }}
                placeholder={t('stockSwitcher.branchNamePlaceholder', 'e.g. Downtown Branch')}
                maxLength={50}
                autoFocus
              />
            </div>

            {/* Niche selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('stockSwitcher.branchNiche', 'Branch niche')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    branchNicheMode === 'sync'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => setBranchNicheMode('sync')}
                >
                  {t('stockSwitcher.syncNiche', 'Same as current')}
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    branchNicheMode === 'custom'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  )}
                  onClick={() => setBranchNicheMode('custom')}
                >
                  {t('stockSwitcher.pickNiche', 'Pick a niche')}
                </button>
              </div>
              {branchNicheMode === 'custom' && (
                <p className="text-xs text-muted-foreground">
                  {t('stockSwitcher.pickNicheHint', 'You\'ll be taken to a setup page to fully customize this branch after creation.')}
                </p>
              )}
            </div>
            {createBranchError && (
              <p className="text-sm text-red-600 dark:text-red-400">{createBranchError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (isCreatingBranch) return;
                setCreateDialogOpen(false);
                setNewBranchName('');
                setBranchNicheMode('sync');
                setCreateBranchError(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleCreateBranchStock}
              disabled={!newBranchName.trim() || isCreatingBranch}
            >
              {isCreatingBranch
                ? t('common.loading', 'Loading...')
                : branchNicheMode === 'custom'
                  ? t('stockSwitcher.createAndCustomize', 'Create & Customize')
                  : t('stockSwitcher.createBranch', 'Create Branch Stock')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (isDeletingBranch || isRequestingDeleteCode) return;
          setDeleteDialogOpen(open);
          if (!open) {
            setStockToDelete(null);
            setDeleteStep('confirm');
            setDeleteCode('');
            setMaskedEmail('');
            setDeleteBranchError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              {t('stockSwitcher.deleteBranchTitle', 'Delete Branch Stock?')}
            </DialogTitle>
            <DialogDescription>
              {deleteStep === 'confirm'
                ? t(
                    'stockSwitcher.deleteBranchDesc',
                    'This will permanently delete "{{name}}" and all its products, sales, and invoices. A confirmation code will be sent to your email.',
                  ).replace('{{name}}', stockToDelete?.stockName || '')
                : t(
                    'stockSwitcher.deleteBranchCodeDesc',
                    'Enter the 6-digit code sent to {{email}} to confirm deletion.',
                  ).replace('{{email}}', maskedEmail)}
            </DialogDescription>
          </DialogHeader>

          {deleteStep === 'code' && (
            <div className="space-y-3">
              <Input
                value={deleteCode}
                onChange={(e) => {
                  setDeleteCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (deleteBranchError) setDeleteBranchError(null);
                }}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
            </div>
          )}

          {deleteBranchError && (
            <p className="text-sm text-red-600 dark:text-red-400">{deleteBranchError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (isDeletingBranch || isRequestingDeleteCode) return;
                setDeleteDialogOpen(false);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            {deleteStep === 'confirm' ? (
              <Button
                variant="destructive"
                onClick={handleRequestDeleteCode}
                disabled={isRequestingDeleteCode}
              >
                {isRequestingDeleteCode
                  ? t('common.loading', 'Loading...')
                  : t('stockSwitcher.sendDeleteCode', 'Send Confirmation Code')}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleteCode.length !== 6 || isDeletingBranch}
              >
                {isDeletingBranch
                  ? t('common.loading', 'Loading...')
                  : t('stockSwitcher.confirmDelete', 'Delete Branch')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};

export default StockSwitcher;
