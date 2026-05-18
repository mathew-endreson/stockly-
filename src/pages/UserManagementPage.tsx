import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Plus,
  Trash2,
  Mail,
  Shield,
  User as UserIcon,
  Copy,
  Check,
  Clock,
  X,
  Edit2,
  Save,
  Eye,
  FileEdit,
  Trash,
  ShoppingCart,
  Store,
  BarChart3,
  DollarSign,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getTeamMemberLimit } from '@/lib/subscriptionPlans';
import { authAPI } from '@/services/api';
import type { SubUserRef } from '@/types';

const roleColors: Record<string, string> = {
  viewer: 'bg-blue-500',
  seller: 'bg-orange-500',
  editor: 'bg-green-500',
  manager: 'bg-purple-500',
  custom: 'bg-amber-500',
};

const roleDescriptions = (t: any): Record<string, string> => ({
  viewer: t('team.roleViewerDesc', 'Can view inventory and analytics only'),
  seller: t('team.roleSellerDesc', 'Can manage orders only (no analytics)'),
  editor: t('team.roleEditorDesc', 'Can view and edit products, manage sales'),
  manager: t('team.roleManagerDesc', 'Full access including user management'),
});

interface Permissions {
  canView: boolean;
  canViewAnalytics: boolean;
  canViewBalance: boolean;
  canViewProductCost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canManageSales: boolean;
  canManageEcommerce: boolean;
  canViewExpenses: boolean;
  canManageExpenses: boolean;
  canApproveExpenses: boolean;
  canViewSensitiveExpenses: boolean;
  canManageReimbursements: boolean;
}

const defaultPermissions: Record<string, Permissions> = {
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
};

const isCustomPermissions = (role: string, permissions: Permissions) => {
  const base = defaultPermissions[role];
  if (!base) return true;
  const normalizedPermissions = {
    ...permissions,
    canViewBalance:
      typeof permissions.canViewBalance === 'boolean' ? permissions.canViewBalance : Boolean(permissions.canManageUsers),
    canViewProductCost:
      typeof permissions.canViewProductCost === 'boolean' ? permissions.canViewProductCost : Boolean(permissions.canEdit),
  };
  return Object.keys(base).some(
    (key) => base[key as keyof Permissions] !== normalizedPermissions[key as keyof Permissions]
  );
};

const resolveRoleFromPermissions = (permissions: Permissions) => {
  const normalizedPermissions = {
    ...permissions,
    canViewBalance:
      typeof permissions.canViewBalance === 'boolean' ? permissions.canViewBalance : Boolean(permissions.canManageUsers),
    canViewProductCost:
      typeof permissions.canViewProductCost === 'boolean' ? permissions.canViewProductCost : Boolean(permissions.canEdit),
  };
  const entries = Object.entries(defaultPermissions) as Array<[keyof typeof defaultPermissions, Permissions]>;
  const match = entries.find(([, base]) =>
    Object.keys(base).every(
      (key) => base[key as keyof Permissions] === normalizedPermissions[key as keyof Permissions]
    )
  );
  return match ? match[0] : 'custom';
};

const normalizePermissions = (permissions?: Partial<Permissions> | null): Permissions => ({
  ...defaultPermissions.viewer,
  ...(permissions || {}),
  canViewBalance:
    typeof permissions?.canViewBalance === 'boolean'
      ? permissions.canViewBalance
      : Boolean(permissions?.canManageUsers),
  canViewProductCost:
    typeof permissions?.canViewProductCost === 'boolean'
      ? permissions.canViewProductCost
      : Boolean(permissions?.canEdit),
});

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, updateUser, updateOnboarding } = useAuth();
  const { language } = useLanguage();
  const roleDesc = roleDescriptions(t);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSubUser, setEditingSubUser] = useState<SubUserRef | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  
  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: 'viewer',
  });
  const [inviteError, setInviteError] = useState<string | null>(null);

  const currentPlanLimit = getTeamMemberLimit(user?.subscription?.plan) || 0;
  const activeSubUsers = user?.subUsers?.filter(su => su.isActive).length || 0;
  const pendingInvitations = user?.invitations?.length || 0;
  const totalMembers = activeSubUsers + pendingInvitations;
  const canAddMore = totalMembers < currentPlanLimit;
  const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviteError(null);
    setSuccessMessage(null);
    const form = e.currentTarget as HTMLFormElement;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setIsLoading(true);

    const normalizedEmail = inviteData.email.trim();
    const normalizedInviteEmail = normalizedEmail.toLowerCase();
    const normalizedCurrentUserEmail = String(user?.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!emailRegex.test(normalizedEmail)) {
      setInviteError(t('team.invalidEmail', 'Invalid email. Please try again.'));
      setIsLoading(false);
      return;
    }
    if (normalizedCurrentUserEmail && normalizedInviteEmail === normalizedCurrentUserEmail) {
      setInviteError(t('team.cannotInviteSelf', 'You cannot invite your own account to this team.'));
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.inviteSubUser({
        ...inviteData,
        email: normalizedInviteEmail,
      });
      updateUser({
        subUsers: response.data.subUsers,
        invitations: response.data.invitations,
      });
      await updateOnboarding({ invitedFirstMember: true });
      
      setSuccessMessage(t('team.inviteSent', 'Invitation sent to {{email}}', { email: inviteData.email }));
      setInviteData({ name: '', email: '', role: 'viewer' });
      setIsInviteModalOpen(false);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error sending invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubUser) return;

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await authAPI.updateSubUserPermissions(editingSubUser.userId, {
        role: editingSubUser.role,
        permissions: editingSubUser.permissions,
      });
      
      const normalizedUpdated = (() => {
        const normalizedPermissions = normalizePermissions(response.data.subUser.permissions);
        const resolvedRole = resolveRoleFromPermissions(normalizedPermissions);
        return {
          ...response.data.subUser,
          permissions: normalizedPermissions,
          role: resolvedRole === 'custom' ? response.data.subUser.role : resolvedRole,
        };
      })();

      const updatedSubUsers = user?.subUsers?.map((su) => {
        const nextRaw = su.userId === editingSubUser.userId ? normalizedUpdated : su;
        const next = {
          ...nextRaw,
          permissions: normalizePermissions(nextRaw.permissions),
        };
        const resolvedRole = resolveRoleFromPermissions(next.permissions);
        return {
          ...next,
          role: resolvedRole === 'custom' ? next.role : resolvedRole,
        };
      }) || [];
      
      updateUser({ subUsers: updatedSubUsers as SubUserRef[] });
      setSuccessMessage(t('team.permissionsUpdated', 'Permissions updated successfully'));
      setIsEditModalOpen(false);
      setEditingSubUser(null);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error updating permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm(t('team.revokeConfirm', 'Are you sure you want to revoke this team member\'s access? Their account will remain but they will no longer have access to your inventory.'))) return;

    try {
      const response = await authAPI.removeSubUser(userId);
      updateUser({ subUsers: response.data.subUsers });
      setSuccessMessage(t('team.revokeSuccess', 'Team member access revoked successfully'));
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error removing team member');
    }
  };

  const handleCancelInvitation = async (token: string) => {
    if (!confirm(t('team.cancelConfirm', 'Are you sure you want to cancel this invitation?'))) return;

    try {
      const response = await authAPI.cancelInvitation(token);
      updateUser({ invitations: response.data.invitations });
      setSuccessMessage(t('team.cancelSuccess', 'Invitation cancelled'));
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error cancelling invitation');
    }
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/accept-invitation?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const openEditModal = (subUser: SubUserRef) => {
    const normalizedPermissions = normalizePermissions(subUser.permissions);
    const resolvedRole = resolveRoleFromPermissions(normalizedPermissions);
    setEditingSubUser({
      ...subUser,
      permissions: normalizedPermissions,
      role: resolvedRole === 'custom' ? subUser.role : (resolvedRole as 'viewer' | 'seller' | 'editor' | 'manager'),
    });
    setIsEditModalOpen(true);
    setError(null);
  };

  const getRoleLabel = (role: string, permissions: Permissions) => {
    if (isCustomPermissions(role, permissions)) {
      return t('team.role.custom', 'Custom');
    }
    return t(`team.role.${role}`, role.charAt(0).toUpperCase() + role.slice(1));
  };

  const updateEditingRole = (role: string) => {
    if (!editingSubUser) return;
    setEditingSubUser({
      ...editingSubUser,
      role: role as 'viewer' | 'seller' | 'editor' | 'manager',
      permissions: { ...defaultPermissions[role] },
    });
  };

  const togglePermission = (permission: keyof Permissions) => {
    if (!editingSubUser) return;
    const nextPermissions = {
      ...editingSubUser.permissions,
      [permission]: !editingSubUser.permissions[permission],
    };
    const resolvedRole = resolveRoleFromPermissions(nextPermissions);
    setEditingSubUser({
      ...editingSubUser,
      role: resolvedRole === 'custom' ? editingSubUser.role : (resolvedRole as 'viewer' | 'seller' | 'editor' | 'manager'),
      permissions: nextPermissions,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) {
      return t('team.neverLoggedIn', 'Not available yet');
    }

    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateString));
  };

  if (!user?.isSubscribed) {
    return (
      <div className="page-shell">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.userManagement')}</h1>
          <p className="text-muted-foreground">{t('team.manageMembers', 'Manage your team members')}</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('team.upgradeToAdd', 'Upgrade to Add Team Members')}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('team.subscriptionRequired', 'An active subscription is required to add team members and manage permissions.')}
            </p>
            <Button onClick={() => window.location.href = '/subscribe'}>
              {t('team.viewPricing', 'View Pricing Plans')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.userManagement')}</h1>
          <p className="text-muted-foreground">{t('team.manageAccess', 'Manage your team members and their access permissions')}</p>
        </div>
        <Button 
          className="w-full sm:w-auto"
          onClick={() => {
            setError(null);
            setSuccessMessage(null);
            setIsInviteModalOpen(true);
          }}
          disabled={!canAddMore}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('team.inviteMember', 'Invite Team Member')}
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="w-4 h-4 text-green-600 mr-2" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Usage Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 min-w-0 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('team.activeMembers', 'Active Members')}</p>
                <p className="text-xl font-bold leading-none">{activeSubUsers}</p>
              </div>
              <div className="w-8 h-8 bg-blue-500/10 rounded-md flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 min-w-0 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('team.pendingInvites', 'Pending Invites')}</p>
                <p className="text-xl font-bold leading-none">{pendingInvitations}</p>
              </div>
              <div className="w-8 h-8 bg-orange-500/10 rounded-md flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 min-w-0 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('team.availableSlots', 'Available Slots')}</p>
                <div className="flex min-w-0 items-end gap-1 leading-none">
                  <p className="text-xl font-bold leading-none">{Math.max(currentPlanLimit - totalMembers, 0)}</p>
                  <p
                    className="truncate text-[11px] text-muted-foreground"
                    title={t('team.ofTotalPlan', 'of {{total}} total ({{plan}} plan)', {
                      total: currentPlanLimit,
                      plan: user?.subscription?.plan,
                    })}
                  >
                    {t('team.ofTotalPlan', 'of {{total}} total ({{plan}} plan)', {
                      total: currentPlanLimit,
                      plan: user?.subscription?.plan,
                    })}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 bg-green-500/10 rounded-md flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations */}
      {user?.invitations && user.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              {t('team.pendingInvitations', 'Pending Invitations')}
            </CardTitle>
            <CardDescription>
              {t('team.pendingInvitationsDesc', "These users have been invited but haven't accepted yet")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.invitations.map((invitation) => (
                <div
                  key={invitation._id}
                  className="flex flex-col gap-4 rounded-md border bg-orange-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">{invitation.name}</p>
                      <p className="text-sm text-muted-foreground">{invitation.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {invitation.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {t('team.expires', 'Expires')}: {formatDate(invitation.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyInvitationLink(invitation.token)}
                    >
                      {copiedToken === invitation.token ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          {t('team.copied', 'Copied!')}
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          {t('team.copyLink', 'Copy Link')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancelInvitation(invitation.token)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('team.activeTeamMembers', 'Active Team Members')}
          </CardTitle>
          <CardDescription>
            {t('team.acceptedInvitations', 'Users who have accepted their invitations')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user?.subUsers && user.subUsers.filter(su => su.isActive).length > 0 ? (
            <div className="space-y-3">
              {user.subUsers.filter(su => su.isActive).map((subUser) => (
                <div
                  key={subUser.userId}
                  className="flex flex-col gap-4 rounded-md border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-primary">
                        {subUser.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{subUser.name}</p>
                      <p className="text-sm text-muted-foreground">{subUser.email}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('team.lastLogin', 'Last login')}: {formatDateTime(subUser.lastLoginAt)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                          {subUser.permissions.canEdit && (
                            <Badge variant="outline" className="text-xs">
                              <FileEdit className="w-3 h-3 mr-1" />
                              {t('team.edit', 'Edit')}
                            </Badge>
                          )}
                          {subUser.permissions.canViewAnalytics && (
                            <Badge variant="outline" className="text-xs">
                              <BarChart3 className="w-3 h-3 mr-1" />
                              {t('team.analytics', 'Analytics')}
                            </Badge>
                          )}
                          {subUser.permissions.canViewBalance && (
                            <Badge variant="outline" className="text-xs">
                              <DollarSign className="w-3 h-3 mr-1" />
                              {t('team.balance', 'Balance')}
                            </Badge>
                          )}
                          {subUser.permissions.canViewProductCost && (
                            <Badge variant="outline" className="text-xs">
                              <Package className="w-3 h-3 mr-1" />
                              {t('team.productCost', 'Product Cost')}
                            </Badge>
                          )}
                        {subUser.permissions.canDelete && (
                          <Badge variant="outline" className="text-xs">
                            <Trash className="w-3 h-3 mr-1" />
                            {t('team.delete', 'Delete')}
                          </Badge>
                        )}
                        {subUser.permissions.canManageSales && (
                          <Badge variant="outline" className="text-xs">
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            {t('team.sales', 'Sales')}
                          </Badge>
                        )}
                        {subUser.permissions.canManageEcommerce && (
                          <Badge variant="outline" className="text-xs">
                            <Store className="w-3 h-3 mr-1" />
                            {t('team.ecommerce', 'Orders')}
                          </Badge>
                        )}
                        {subUser.permissions.canViewExpenses && (
                          <Badge variant="outline" className="text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {t('team.expenses', 'Expenses')}
                          </Badge>
                        )}
                        {subUser.permissions.canManageReimbursements && (
                          <Badge variant="outline" className="text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {t('team.reimbursements', 'Reimbursements')}
                          </Badge>
                        )}
                        {subUser.permissions.canViewSensitiveExpenses && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            {t('team.sensitiveFinance', 'Sensitive Finance')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                    <div className="text-right mr-4">
                        {(() => {
                          const label = getRoleLabel(subUser.role, subUser.permissions);
                          const colorKey = label.toLowerCase() === 'custom' ? 'custom' : subUser.role;
                          return (
                            <Badge className={`${roleColors[colorKey] || 'bg-gray-500'} text-white`}>
                              {label}
                            </Badge>
                          );
                        })()}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditModal(subUser)}
                      className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveUser(subUser.userId)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t('team.noActiveMembers', 'No active team members')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('team.inviteCollaborate', 'Invite team members to collaborate on inventory management')}
              </p>
              <Button onClick={() => setIsInviteModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('team.inviteFirst', 'Invite Your First Team Member')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('team.inviteModalTitle', 'Invite Team Member')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              {(inviteError || error) && (
                <Alert variant="destructive">
                  <AlertDescription>{inviteError || error}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="inviteName">{t('team.fullName', 'Full Name')}</Label>
                <Input
                id="inviteName"
                value={inviteData.name}
                onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                placeholder={t('team.fullNamePlaceholder', 'John Doe')}
                required
              />
            </div>
            <div>
              <Label htmlFor="inviteEmail">{t('team.emailAddress', 'Email Address')}</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder={t('team.emailPlaceholder', 'john@example.com')}
                  required
                />
            </div>
            <div>
              <Label htmlFor="inviteRole">{t('team.roleLabel', 'Role')}</Label>
              <Select
                value={inviteData.role}
                onValueChange={(value) => setInviteData({ ...inviteData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{t('team.role.viewer', 'Viewer')} - {t('team.viewOnly', 'View only')}</SelectItem>
                  <SelectItem value="seller">{t('team.role.seller', 'Seller')} - {t('team.ordersOnly', 'Orders only')}</SelectItem>
                  <SelectItem value="editor">{t('team.role.editor', 'Editor')} - {t('team.viewEdit', 'View & Edit')}</SelectItem>
                  <SelectItem value="manager">{t('team.role.manager', 'Manager')} - {t('team.fullAccess', 'Full access')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {roleDesc[inviteData.role]}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {t('team.sendInvitation', 'Send Invitation')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('team.editPermissions', 'Edit Permissions')} - {editingSubUser?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePermissions} className="space-y-4">
            <div>
              <Label>{t('team.roleLabel', 'Role')}</Label>
              <Select
                value={editingSubUser?.role}
                onValueChange={updateEditingRole}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{t('team.role.viewer', 'Viewer')}</SelectItem>
                  <SelectItem value="seller">{t('team.role.seller', 'Seller')}</SelectItem>
                  <SelectItem value="editor">{t('team.role.editor', 'Editor')}</SelectItem>
                  <SelectItem value="manager">{t('team.role.manager', 'Manager')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {editingSubUser && roleDesc[editingSubUser.role]}
              </p>
            </div>

            <Separator />

            <div>
              <Label className="mb-3 block">{t('team.customPermissions', 'Custom Permissions')}</Label>
              <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{t('team.viewInventory', 'View Inventory')}</span>
                    </div>
                    <Checkbox 
                      checked={editingSubUser?.permissions.canView}
                      onCheckedChange={() => togglePermission('canView')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{t('team.viewAnalytics', 'View Insights')}</span>
                    </div>
                    <Checkbox 
                      checked={editingSubUser?.permissions.canViewAnalytics}
                      onCheckedChange={() => togglePermission('canViewAnalytics')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{t('team.viewBalance', 'View Balance')}</span>
                    </div>
                    <Checkbox
                      checked={editingSubUser?.permissions.canViewBalance}
                      onCheckedChange={() => togglePermission('canViewBalance')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{t('team.viewProductCost', 'View Product Cost')}</span>
                    </div>
                    <Checkbox
                      checked={editingSubUser?.permissions.canViewProductCost}
                      onCheckedChange={() => togglePermission('canViewProductCost')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileEdit className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{t('team.editProducts', 'Edit Products')}</span>
                    </div>
                  <Checkbox 
                    checked={editingSubUser?.permissions.canEdit}
                    onCheckedChange={() => togglePermission('canEdit')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trash className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.deleteProducts', 'Delete Products')}</span>
                  </div>
                  <Checkbox 
                    checked={editingSubUser?.permissions.canDelete}
                    onCheckedChange={() => togglePermission('canDelete')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.manageSales', 'Manage Sales')}</span>
                  </div>
                  <Checkbox 
                    checked={editingSubUser?.permissions.canManageSales}
                    onCheckedChange={() => togglePermission('canManageSales')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.manageEcommerce', 'Orders Manager')}</span>
                  </div>
                  <Checkbox 
                    checked={editingSubUser?.permissions.canManageEcommerce}
                    onCheckedChange={() => togglePermission('canManageEcommerce')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.manageUsers', 'Manage Users')}</span>
                  </div>
                  <Checkbox 
                    checked={editingSubUser?.permissions.canManageUsers}
                    onCheckedChange={() => togglePermission('canManageUsers')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.viewExpenses', 'View Expenses')}</span>
                  </div>
                  <Checkbox
                    checked={editingSubUser?.permissions.canViewExpenses}
                    onCheckedChange={() => togglePermission('canViewExpenses')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.manageExpenses', 'Manage Expenses')}</span>
                  </div>
                  <Checkbox
                    checked={editingSubUser?.permissions.canManageExpenses}
                    onCheckedChange={() => togglePermission('canManageExpenses')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.approveExpenses', 'Approve Expenses')}</span>
                  </div>
                  <Checkbox
                    checked={editingSubUser?.permissions.canApproveExpenses}
                    onCheckedChange={() => togglePermission('canApproveExpenses')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.viewSensitiveExpenses', 'View Sensitive Expenses')}</span>
                  </div>
                  <Checkbox
                    checked={editingSubUser?.permissions.canViewSensitiveExpenses}
                    onCheckedChange={() => togglePermission('canViewSensitiveExpenses')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{t('team.manageReimbursements', 'Manage Reimbursements')}</span>
                  </div>
                  <Checkbox
                    checked={editingSubUser?.permissions.canManageReimbursements}
                    onCheckedChange={() => togglePermission('canManageReimbursements')}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {t('team.saveChanges', 'Save Changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
