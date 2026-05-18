import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DateRange } from 'react-day-picker';
import {
  Activity,
  CalendarDays,
  DollarSign,
  Package,
  Search,
  ShieldAlert,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { authAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import SubscriptionLock, { useFeatureAccess } from '@/components/SubscriptionLock';
import type {
  TeamMemberActivityItem,
  TeamMemberDetails,
  TeamSurveillanceData,
  TeamSurveillanceMember,
  TeamSurveillanceSessionEvent
} from '@/types';

const roleBadgeClassByRole: Record<string, string> = {
  viewer: 'bg-blue-500 text-white',
  seller: 'bg-orange-500 text-white',
  editor: 'bg-emerald-600 text-white',
  manager: 'bg-purple-600 text-white',
};

const areSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isLoginAction = (action: string) => String(action || '').toLowerCase() === 'team_member_login';
const isLogoutAction = (action: string) => String(action || '').toLowerCase() === 'team_member_logout';

const toDateKey = (value?: Date) => {
  if (!value) return undefined;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateRangeParams = (range?: DateRange) => {
  if (!range?.from) return {};
  const startDate = toDateKey(range.from);
  const endDate = toDateKey(range.to || range.from);
  if (!startDate || !endDate) return {};
  return { startDate, endDate };
};

const getActivityTone = (action: string) => {
  const normalized = String(action || '').toLowerCase();
  if (normalized.includes('login')) {
    return {
      rowClass: 'border-emerald-200 bg-emerald-50/40',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      amountClass: 'text-emerald-700',
    };
  }
  if (normalized.includes('logout')) {
    return {
      rowClass: 'border-amber-200 bg-amber-50/40',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      amountClass: 'text-amber-700',
    };
  }
  if (normalized.includes('sale')) {
    return {
      rowClass: 'border-blue-200 bg-blue-50/40',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
      amountClass: 'text-blue-700',
    };
  }
  if (normalized.includes('invoice')) {
    return {
      rowClass: 'border-violet-200 bg-violet-50/40',
      badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
      amountClass: 'text-violet-700',
    };
  }
  return {
    rowClass: 'border-slate-200 bg-slate-50/40',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    amountClass: 'text-slate-700',
  };
};

const SurveillancePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { hasAccess, requiredPlan, loading: featureLoading } = useFeatureAccess('surveillance');
  const { user, isSubUser, canManageUsers } = useAuth();
  const canAccess = !isSubUser() || canManageUsers();
  const locale = i18n.language || 'en';
  const notAvailableLabel = t('common.notAvailable', 'N/A');
  const activeLabel = t('team.active', 'Active');
  const inactiveLabel = t('team.inactive', 'Inactive');
  const pickDateRangeLabel = t('team.pickDateRange', 'Pick date range');
  const legacyLabel = t('team.legacy', 'Legacy');
  const qtyLabel = t('common.qty', 'Qty');

  const formatDateTime = useCallback(
    (value?: string | null) => {
      if (!value) return notAvailableLabel;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return notAvailableLabel;
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsed);
    },
    [locale, notAvailableLabel]
  );

  const formatDate = useCallback(
    (value?: Date) => {
      if (!value) return notAvailableLabel;
      return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(value);
    },
    [locale, notAvailableLabel]
  );

  const formatAction = useCallback(
    (action: string) => {
      const normalized = String(action || '').toLowerCase();
      if (normalized === 'team_member_login') return activeLabel;
      if (normalized === 'team_member_logout') return inactiveLabel;

      const roleLabels: Record<string, string> = {
        viewer: t('team.role.viewer', 'Viewer'),
        seller: t('team.role.seller', 'Seller'),
        editor: t('team.role.editor', 'Editor'),
        manager: t('team.role.manager', 'Manager'),
        custom: t('team.role.custom', 'Custom'),
      };

      if (roleLabels[normalized]) return roleLabels[normalized];

      return String(action || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    },
    [activeLabel, inactiveLabel, t]
  );

  const formatDateRangeLabel = useCallback(
    (range?: DateRange) => {
      if (!range?.from) return pickDateRangeLabel;
      if (!range.to || areSameDay(range.from, range.to)) {
        return formatDate(range.from);
      }
      return `${formatDate(range.from)} - ${formatDate(range.to)}`;
    },
    [formatDate, pickDateRangeLabel]
  );

  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<TeamSurveillanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<TeamSurveillanceMember | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<TeamMemberDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const currency = user?.settings?.currency || 'DZD';
  const formatCurrency = useMemo(
    () => (value: number) => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
        }).format(Number(value || 0));
      } catch {
        return `${currency} ${Number(value || 0).toFixed(2)}`;
      }
    },
    [currency, locale]
  );

  const loadSurveillance = useCallback(async (pickedRange: DateRange | undefined) => {
    if (featureLoading || !hasAccess || !canAccess) return;
    setIsLoading(true);
    setError(null);
    try {
      const rangeParams = getDateRangeParams(pickedRange);
      const response = await authAPI.getTeamSurveillance({
        range: 'custom',
        ...rangeParams,
        limit: 300,
      });
      setData(response.data);
    } catch (apiError: unknown) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('team.surveillanceLoadFailed', 'Failed to load surveillance data'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [canAccess, featureLoading, hasAccess, t]);

  const loadMemberDetails = useCallback(
    async (member: TeamSurveillanceMember, pickedRange: DateRange | undefined) => {
      if (featureLoading || !hasAccess || !canAccess) return;
      setDetailsLoading(true);
      setDetailsError(null);
      try {
        const rangeParams = getDateRangeParams(pickedRange);
        const response = await authAPI.getSubUserDetails(member.userId, {
          range: 'custom',
          ...rangeParams,
          limit: 200,
        });
        setDetailsData(response.data);
      } catch (apiError: unknown) {
        const message =
          typeof apiError === 'object' &&
          apiError !== null &&
          'response' in apiError
            ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
            : undefined;
        setDetailsError(message || t('team.memberDetailsLoadFailed', 'Failed to load worker details'));
        setDetailsData(null);
      } finally {
        setDetailsLoading(false);
      }
    },
    [canAccess, featureLoading, hasAccess, t]
  );

  useEffect(() => {
    if (featureLoading || !hasAccess || !canAccess) return;
    void loadSurveillance(dateRange);
  }, [canAccess, dateRange, featureLoading, hasAccess, loadSurveillance]);

  useEffect(() => {
    if (featureLoading || !hasAccess || !canAccess) return;
    if (!selectedMember || !isDetailsOpen) return;
    void loadMemberDetails(selectedMember, dateRange);
  }, [canAccess, dateRange, featureLoading, hasAccess, isDetailsOpen, loadMemberDetails, selectedMember]);

  const filteredMembers = useMemo(() => {
    const members = data?.members || [];
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) => {
      const haystack = [
        member.name,
        member.email,
        member.role,
        member.stats.currentlyOnline ? activeLabel : inactiveLabel,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [activeLabel, data?.members, inactiveLabel, search]);

  if (featureLoading) return null;
  if (!hasAccess) {
    return (
      <SubscriptionLock
        feature="surveillance"
        requiredPlan={requiredPlan}
        description="Upgrade to access the surveillance system in this workspace."
      />
    );
  }
  if (!canAccess) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          {t('team.noPermission', 'You do not have permission to access this page.')}
        </AlertDescription>
      </Alert>
    );
  }

  const summary = data?.summary;
  const selectedPresence = selectedMember?.stats?.currentlyOnline;

  const handleDateRangeSelect = (nextRange: DateRange | undefined) => {
    if (!nextRange?.from) return;
    setDateRange(nextRange);
  };

  const setTodayRange = () => {
    const today = new Date();
    setDateRange({ from: today, to: today });
  };

  const setLast7DaysRange = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    setDateRange({ from: start, to: end });
  };

  const openMemberDetails = (member: TeamSurveillanceMember) => {
    setSelectedMember(member);
    setIsDetailsOpen(true);
    void loadMemberDetails(member, dateRange);
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold">{t('common.surveillance', 'Survaillance')}</h1>
          <p className="text-muted-foreground">
            {t(
              'team.surveillanceDescription',
              'Track team member presence and activity across your stock'
            )}
          </p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => void loadSurveillance(dateRange)}>
          {isLoading ? (
            <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
          ) : (
            <Activity className="mr-2 h-4 w-4" />
          )}
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
            <div>
              <Label htmlFor="surveillance-search">{t('common.search', 'Search')}</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="surveillance-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('team.searchMembers', 'Search by name, email, role...')}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>{t('team.rangeLabel', 'Date Range')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="mt-1 w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {formatDateRangeLabel(dateRange)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-w-[calc(100vw-2rem)] overflow-x-auto p-0 sm:w-auto">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={handleDateRangeSelect}
                    numberOfMonths={2}
                    defaultMonth={dateRange?.from}
                  />
                  <div className="flex items-center justify-between border-t p-3">
                    <Button variant="outline" size="sm" onClick={setTodayRange}>
                      {t('team.range.day', 'Today')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={setLast7DaysRange}>
                      {t('team.range.7days', 'Last 7 Days')}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>{t('team.loadingDetails', 'Loading team member details...')}</span>
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label={t('team.activeMembers', 'Active Members')} value={String(summary?.activeMembers || 0)} />
            <SummaryCard label={t('team.onlineNow', 'Active Now')} value={String(summary?.onlineNow || 0)} valueClassName="text-emerald-600" />
            <SummaryCard label={t('team.loginsToday', 'Active Today')} value={String(summary?.loginsToday || 0)} valueClassName="text-blue-600" />
            <SummaryCard label={t('team.logoutsToday', 'Inactive Today')} value={String(summary?.logoutsToday || 0)} valueClassName="text-amber-600" />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('team.membersOverview', 'Workers')}</CardTitle>
              <CardDescription>
                {t('team.membersOverviewDesc', 'Workers list with live status and active/inactive metrics. Double-click a worker for full details.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('team.noTeamMembers', 'No team members added yet')}</p>
              ) : (
                <div className="table-responsive rounded-md border">
                  <Table className="min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('team.member', 'Worker')}</TableHead>
                        <TableHead>{t('team.roleLabel', 'Role')}</TableHead>
                        <TableHead>{t('team.status', 'Status')}</TableHead>
                        <TableHead className="text-center">{t('team.logins', 'Active')}</TableHead>
                        <TableHead className="text-center">{t('team.logouts', 'Inactive')}</TableHead>
                        <TableHead>{t('team.lastLogin', 'Last Active')}</TableHead>
                        <TableHead>{t('team.lastLogout', 'Last Inactive')}</TableHead>
                        <TableHead className="text-center">{t('team.totalActions', 'Total Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => {
                        const roleKey = String(member.role || '').toLowerCase();
                        const roleClass = roleBadgeClassByRole[roleKey] || 'bg-slate-500 text-white';
                        return (
                          <TableRow
                            key={member.userId}
                            className="cursor-pointer"
                            onDoubleClick={() => openMemberDetails(member)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={roleClass}>{formatAction(member.role)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={member.stats.currentlyOnline ? 'default' : 'secondary'}
                                className={member.stats.currentlyOnline ? 'bg-emerald-600' : ''}
                              >
                                {member.stats.currentlyOnline ? (
                                  <>
                                    <Wifi className="mr-1 h-3 w-3" />
                                    {t('team.online', 'Active')}
                                  </>
                                ) : (
                                  <>
                                    <WifiOff className="mr-1 h-3 w-3" />
                                    {t('team.offline', 'Inactive')}
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{member.stats.loginCount}</TableCell>
                            <TableCell className="text-center">{member.stats.logoutCount}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(member.stats.lastLoginAt)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(member.stats.lastLogoutAt)}
                            </TableCell>
                            <TableCell className="text-center font-medium">{member.stats.totalActions}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t('team.sessionTimeline', 'Session Timeline')}</CardTitle>
              <CardDescription>
                {t('team.sessionTimelineDesc', 'Recent active/inactive events across the selected date range')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.sessionEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('team.noSessionEvents', 'No active/inactive events found for this range')}
                </p>
              ) : (
                <div className="space-y-2">
                  {data.sessionEvents.slice(0, 120).map((event) => (
                    <SessionRow
                      key={event.id}
                      event={event}
                      formatAction={formatAction}
                      formatDateTime={formatDateTime}
                      activeLabel={activeLabel}
                      inactiveLabel={inactiveLabel}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setSelectedMember(null);
            setDetailsData(null);
            setDetailsError(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:w-[85vw] lg:w-[65vw] max-w-none max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('team.memberDetails', 'Worker Details')}
              {selectedMember ? ` - ${selectedMember.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>{t('team.loadingDetails', 'Loading team member details...')}</span>
            </div>
          )}

          {!detailsLoading && detailsError && (
            <Alert variant="destructive">
              <AlertDescription>{detailsError}</AlertDescription>
            </Alert>
          )}

          {!detailsLoading && !detailsError && detailsData && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{detailsData.member.name}</p>
                  <p className="text-sm text-muted-foreground">{detailsData.member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={roleBadgeClassByRole[String(detailsData.member.role).toLowerCase()] || 'bg-slate-500 text-white'}>
                    {formatAction(detailsData.member.role)}
                  </Badge>
                  <Badge
                    variant={selectedPresence ? 'default' : 'secondary'}
                    className={selectedPresence ? 'bg-emerald-600' : ''}
                  >
                    {selectedPresence ? t('team.active', 'Active') : t('team.inactive', 'Inactive')}
                  </Badge>
                  <Badge variant="outline">
                    {formatDateTime(detailsData.member.addedAt)}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  icon={<DollarSign className="h-5 w-5 text-[#10B981]" />}
                  label={t('team.totalRevenue', 'Total Revenue')}
                  value={formatCurrency(detailsData.stats.totals.totalRevenue)}
                  valueClassName="text-[#10B981]"
                />
                <MetricCard
                  icon={<Package className="h-5 w-5 text-[#10B981]" />}
                  label={t('team.totalSold', 'Total Sold Qty')}
                  value={String(detailsData.stats.totals.totalSoldQuantity)}
                  valueClassName="text-[#10B981]"
                />
                <MetricCard
                  icon={<Activity className="h-5 w-5 text-[#10B981]" />}
                  label={t('team.totalActions', 'Total Actions')}
                  value={String(detailsData.stats.totals.totalActions)}
                  valueClassName="text-[#10B981]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-[#0E92F0]/45">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t('team.salesStats', 'Sales')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>{t('team.orders', 'Orders')}: <span className="font-medium text-[#0E92F0]">{detailsData.stats.sales.totalOrders}</span></p>
                    <p>{t('team.itemsSold', 'Items Sold')}: <span className="font-medium text-[#0E92F0]">{detailsData.stats.sales.totalItemsSold}</span></p>
                    <p>{t('team.salesRevenue', 'Revenue')}: <span className="font-medium text-[#0E92F0]">{formatCurrency(detailsData.stats.sales.totalRevenue)}</span></p>
                  </CardContent>
                </Card>
                <Card className="border-[#0E92F0]/45">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t('team.productStats', 'Products')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>{t('team.productsAdded', 'Added')}: <span className="font-medium text-[#0E92F0]">{detailsData.stats.products.added}</span></p>
                    <p>{t('team.productsDeleted', 'Deleted')}: <span className="font-medium text-[#0E92F0]">{detailsData.stats.products.deleted}</span></p>
                  </CardContent>
                </Card>
                <Card className="border-[#0E92F0]/45">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{t('team.invoiceStats', 'Invoices')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>{t('team.invoicesCount', 'Invoices')}: <span className="font-medium text-[#0E92F0]">{detailsData.stats.invoices.totalInvoices}</span></p>
                    <p>{t('team.invoiced', 'Invoiced')}: <span className="font-medium text-[#0E92F0]">{formatCurrency(detailsData.stats.invoices.totalInvoiced)}</span></p>
                    <p>{t('team.collected', 'Collected')}: <span className="font-medium text-[#0E92F0]">{formatCurrency(detailsData.stats.invoices.totalCollected)}</span></p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('team.activityLog', 'Activity Log')}</CardTitle>
                  <CardDescription>
                    {t('team.activityLogDesc', 'Everything this team member did in the selected range')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {detailsData.activity.length > 0 ? (
                    <div className="space-y-2">
                      {detailsData.activity.map((activity) => (
                        <ActivityRow
                          key={activity.id}
                          activity={activity}
                          formatCurrency={formatCurrency}
                          formatAction={formatAction}
                          formatDateTime={formatDateTime}
                          activeLabel={activeLabel}
                          inactiveLabel={inactiveLabel}
                          legacyLabel={legacyLabel}
                          qtyLabel={qtyLabel}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">
                      {t('team.noActivity', 'No activity found for this range')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDetailsOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; valueClassName?: string }> = ({
  label,
  value,
  valueClassName
}) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${valueClassName || ''}`}>{value}</p>
    </CardContent>
  </Card>
);

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}> = ({ icon, label, value, valueClassName }) => (
  <Card className="border-[#10B981]/45 bg-[#10B981]/8">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold ${valueClassName || ''}`}>{value}</p>
        </div>
        {icon}
      </div>
    </CardContent>
  </Card>
);

const ActivityRow: React.FC<{
  activity: TeamMemberActivityItem;
  formatCurrency: (value: number) => string;
  formatAction: (action: string) => string;
  formatDateTime: (value?: string | null) => string;
  activeLabel: string;
  inactiveLabel: string;
  legacyLabel: string;
  qtyLabel: string;
}> = ({
  activity,
  formatCurrency,
  formatAction,
  formatDateTime,
  activeLabel,
  inactiveLabel,
  legacyLabel,
  qtyLabel,
}) => {
  const tone = getActivityTone(activity.action);
  const isLogin = isLoginAction(activity.action);
  const isLogout = isLogoutAction(activity.action);
  const actionLabel = isLogin
    ? activeLabel
    : isLogout
      ? inactiveLabel
      : formatAction(activity.action);
  const description = isLogin
    ? activeLabel
    : isLogout
      ? inactiveLabel
      : activity.description;
  return (
    <div className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start sm:justify-between ${tone.rowClass}`}>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${tone.badgeClass}`}>
            {actionLabel}
          </Badge>
          {activity.synthetic && (
            <Badge variant="secondary" className="text-xs">
              {legacyLabel}
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium">{description}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
      </div>
      <div className="shrink-0 space-y-1 text-right">
        {activity.amount > 0 && (
          <p className={`text-sm font-medium ${tone.amountClass}`}>{formatCurrency(activity.amount)}</p>
        )}
        {activity.quantity !== 0 && (
          <p className="text-xs text-muted-foreground">
            {qtyLabel}: {activity.quantity}
          </p>
        )}
      </div>
    </div>
  );
};

const SessionRow: React.FC<{
  event: TeamSurveillanceSessionEvent;
  compact?: boolean;
  formatAction: (action: string) => string;
  formatDateTime: (value?: string | null) => string;
  activeLabel: string;
  inactiveLabel: string;
}> = ({ event, compact = false, formatAction, formatDateTime, activeLabel, inactiveLabel }) => {
  const isLogin = isLoginAction(event.action);
  const isLogout = isLogoutAction(event.action);
  const sessionLabel = isLogin
    ? activeLabel
    : isLogout
      ? inactiveLabel
      : formatAction(event.action);
  const sessionDescription = isLogin
    ? activeLabel
    : isLogout
      ? inactiveLabel
      : event.description;
  return (
    <div className={`flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between ${compact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Badge
          variant="outline"
          className={
            isLogin
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : isLogout
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : ''
          }
        >
          {sessionLabel}
        </Badge>
        <span className="truncate font-medium">{event.userName}</span>
        {!compact && <span className="truncate text-muted-foreground">{sessionDescription}</span>}
      </div>
      <span className="shrink-0 text-muted-foreground">{formatDateTime(event.createdAt)}</span>
    </div>
  );
};

export default SurveillancePage;
