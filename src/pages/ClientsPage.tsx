import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BadgeDollarSign,
  CircleDollarSign,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Undo2,
  UserRound
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { clientsAPI } from '@/services/api';
import type { ClientRecord, ClientsOverviewData, PricingTier, TeamDetailsRangeKey } from '@/types';
import { PRICING_TIERS, PRICING_TIER_LABELS } from '@/lib/pricing';
import { MdReceiptLong, MdStorefront } from 'react-icons/md';

type SortOption = 'spent' | 'debt' | 'orders' | 'recent' | 'return_rate' | 'name';
type ClientRangeOption = TeamDetailsRangeKey | 'all';

const ClientsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, isSubUser, canManageSales } = useAuth();
  const locale = i18n.language || 'en';
  const notAvailableLabel = t('common.notAvailable', 'N/A');

  const [range, setRange] = useState<ClientRangeOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('spent');
  const [search, setSearch] = useState('');
  const [inDebtOnly, setInDebtOnly] = useState(false);
  const [data, setData] = useState<ClientsOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    pricingTier: 'default' as PricingTier,
    notes: ''
  });
  const [isSavingClient, setIsSavingClient] = useState(false);

  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [debtForm, setDebtForm] = useState({
    isInDebt: true,
    amount: '',
    note: ''
  });
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const [detailsClient, setDetailsClient] = useState<ClientRecord | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<ClientRecord | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  const currency = user?.settings?.currency || 'DZD';
  const rangeOptions = useMemo(
    () => [
      { value: 'all', label: t('clients.range.all', 'All Time') },
      { value: 'day', label: t('clients.range.today', 'Today') },
      { value: '3days', label: t('clients.range.last3Days', 'Last 3 Days') },
      { value: '7days', label: t('clients.range.last7Days', 'Last 7 Days') },
      { value: '30days', label: t('clients.range.last30Days', 'Last 30 Days') },
    ],
    [t]
  );
  const sortOptions = useMemo(
    () => [
      { value: 'spent', label: t('clients.sort.mostSpent', 'Most Spent') },
      { value: 'debt', label: t('clients.sort.highestDebt', 'Highest Debt') },
      { value: 'orders', label: t('clients.sort.mostOrders', 'Most Orders') },
      { value: 'recent', label: t('clients.sort.recentPurchase', 'Recent Purchase') },
      { value: 'return_rate', label: t('clients.sort.returnRate', 'Return Rate') },
      { value: 'name', label: t('clients.sort.name', 'Name') },
    ],
    [t]
  );
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
  const formatCurrency = useMemo(
    () => (value: number) => {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2
        }).format(Number(value || 0));
      } catch {
        return `${currency} ${Number(value || 0).toFixed(2)}`;
      }
    },
    [currency, locale]
  );

  const canAccess = !isSubUser() || canManageSales();

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await clientsAPI.getClients({
        range,
        search: search.trim() || undefined,
        inDebtOnly,
        sortBy,
        sortDirection: 'desc',
        page: 1,
        limit: 120
      });
      setData(response.data);
    } catch (apiError: unknown) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('clients.loadFailed', 'Failed to load clients'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [inDebtOnly, range, search, sortBy, t]);

  useEffect(() => {
    if (!canAccess) return;
    void loadClients();
  }, [canAccess, loadClients]);

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newClient.name.trim()) {
      setError(t('clients.nameRequired', 'Client name is required'));
      return;
    }

    setIsSavingClient(true);
    setError(null);
    try {
      await clientsAPI.upsertClient({
        name: newClient.name.trim(),
        email: newClient.email.trim(),
        phone: newClient.phone.trim(),
        pricingTier: newClient.pricingTier,
        notes: newClient.notes.trim()
      });
      setIsAddClientOpen(false);
      setNewClient({ name: '', email: '', phone: '', pricingTier: 'default', notes: '' });
      await loadClients();
    } catch (apiError: unknown) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('clients.saveFailed', 'Failed to save client'));
    } finally {
      setIsSavingClient(false);
    }
  };

  const openDebtDialog = (client: ClientRecord, markAsDebt: boolean) => {
    setSelectedClient(client);
    setDebtForm({
      isInDebt: markAsDebt,
      amount: markAsDebt ? String(Math.max(0, client.debt.manualAmount || client.debt.totalDebt || 0)) : '0',
      note: markAsDebt ? client.debt.note || '' : ''
    });
    setIsDebtDialogOpen(true);
  };

  const saveDebtStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient) return;

    const amount = Math.max(0, Number(debtForm.amount || 0));
    setIsSavingDebt(true);
    setError(null);
    try {
      await clientsAPI.updateClientDebt(selectedClient.clientKey, {
        isInDebt: debtForm.isInDebt,
        amount,
        note: debtForm.note.trim(),
        name: selectedClient.name,
        email: selectedClient.email,
        phone: selectedClient.phone
      });
      setIsDebtDialogOpen(false);
      setSelectedClient(null);
      await loadClients();
    } catch (apiError: unknown) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('clients.debtUpdateFailed', 'Failed to update debt status'));
    } finally {
      setIsSavingDebt(false);
    }
  };

  const openClientDetails = (client: ClientRecord) => {
    setDetailsClient(client);
  };

  const openDeleteClientDialog = (client: ClientRecord) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    setError(null);
    try {
      await clientsAPI.deleteClient(clientToDelete.clientKey, {
        name: clientToDelete.name,
        email: clientToDelete.email,
        phone: clientToDelete.phone
      });
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
      await loadClients();
    } catch (apiError: unknown) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('clients.deleteFailed', 'Failed to delete client'));
    } finally {
      setIsDeletingClient(false);
    }
  };

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

  const clients = data?.clients || [];
  const summary = data?.summary;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold">{t('common.clients', 'Clients')}</h1>
          <p className="text-muted-foreground">
            {t(
              'clients.description',
              'Track client purchases, spending, return behavior, and debt status'
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void loadClients()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setIsAddClientOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('clients.addClient', 'Add Client')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(150px,180px)_minmax(150px,180px)_minmax(120px,130px)]">
            <div>
              <Label htmlFor="client-search">{t('common.search', 'Search')}</Label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="client-search"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('clients.searchPlaceholder', 'Name, email, phone...')}
                />
              </div>
            </div>
            <div>
              <Label>{t('team.rangeLabel', 'Date Range')}</Label>
              <Select value={range} onValueChange={(value) => setRange(value as ClientRangeOption)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(`team.range.${option.value}`, option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('common.sortBy', 'Sort By')}</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(`clients.sort.${option.value}`, option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between gap-2">
              <Label className="text-sm">{t('clients.inDebtOnly', 'Debt Only')}</Label>
              <Switch checked={inDebtOnly} onCheckedChange={setInDebtOnly} />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<UserRound className="h-4 w-4" />} label={t('clients.totalClients', 'Total Clients')} value={String(summary?.totalClients || 0)} />
        <SummaryCard icon={<BadgeDollarSign className="h-4 w-4" />} label={t('clients.totalSpent', 'Total Spent')} value={formatCurrency(summary?.totalSpent || 0)} />
        <SummaryCard icon={<CircleDollarSign className="h-4 w-4" />} label={t('clients.totalDebt', 'Total Debt')} value={formatCurrency(summary?.totalDebt || 0)} />
        <SummaryCard icon={<Undo2 className="h-4 w-4" />} label={t('clients.avgReturnRate', 'Avg Return Rate')} value={`${Number(summary?.averageReturnRate || 0).toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t('clients.listTitle', 'Client Insights')}</CardTitle>
          <CardDescription>
            {t('clients.listDesc', 'Who bought what, how much they spent, and debt risk')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && !data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('common.loading', 'Loading...')}</span>
            </div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('clients.empty', 'No clients found')}</p>
          ) : (
            <div className="table-responsive rounded-md border">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('clients.client', 'Client')}</TableHead>
                    <TableHead>{t('clients.contact', 'Contact')}</TableHead>
                    <TableHead className="text-center">{t('clients.orders', 'Orders')}</TableHead>
                    <TableHead className="text-center">{t('clients.spent', 'Spent')}</TableHead>
                    <TableHead className="text-center">{t('clients.returnRate', 'Return Rate')}</TableHead>
                    <TableHead className="text-center">{t('clients.debt', 'Debt')}</TableHead>
                    <TableHead className="text-center">{t('clients.lastPurchase', 'Last Purchase')}</TableHead>
                    <TableHead>{t('clients.topProducts', 'What They Bought')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className="cursor-pointer" onDoubleClick={() => openClientDetails(client)}>
                      <TableCell className="min-w-[220px]">
                        <div className="space-y-1">
                          <p className="font-medium">{client.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {client.debt.hasDebt ? (
                              <Badge className="bg-amber-500 text-white">{t('clients.inDebt', 'In Debt')}</Badge>
                            ) : (
                              <Badge variant="secondary">{t('clients.clear', 'Clear')}</Badge>
                            )}
                            {client.addedManually && <Badge variant="outline">{t('clients.manual', 'Manual')}</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[180px] text-sm text-muted-foreground">
                        {[client.email, client.phone].filter(Boolean).join(' | ') ||
                          t('clients.noContact', 'No contact info')}
                      </TableCell>
                      <TableCell className="text-center">{client.metrics.purchasedOrders}</TableCell>
                      <TableCell className="text-center font-medium">
                        {formatCurrency(client.metrics.totalSpent)}
                      </TableCell>
                      <TableCell className="text-center">
                        {Number(client.metrics.returnRate || 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-1">
                          <p className="font-medium">{formatCurrency(client.debt.totalDebt)}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('clients.manualDebt', 'Manual debt mark')}: {formatCurrency(client.debt.manualAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {formatDateTime(client.metrics.lastPurchaseAt)}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        {client.metrics.topProducts.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t('clients.noProducts', 'No product history yet')}
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {client.metrics.topProducts.slice(0, 2).map((item) => (
                              <div
                                key={`${client.clientKey}-${item.name}`}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="truncate">{item.name}</span>
                                <span className="shrink-0 text-muted-foreground">
                                  {item.quantity}x | {formatCurrency(item.spent)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => event.stopPropagation()}
                              onDoubleClick={(event) => event.stopPropagation()}
                              aria-label={t('common.actions', 'Actions')}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                openClientDetails(client);
                              }}
                            >
                              {t('common.details', 'Details')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                openDebtDialog(client, true);
                              }}
                            >
                              {t('clients.updateDebt', 'Update Debt')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!client.debt.isMarked}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!client.debt.isMarked) return;
                                openDebtDialog(client, false);
                              }}
                            >
                              {t('clients.clearDebtMark', 'Clear Mark')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDeleteClientDialog(client);
                              }}
                            >
                              {t('clients.deleteClient', 'Delete Client')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailsClient)} onOpenChange={(open) => !open && setDetailsClient(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {t('clients.detailsTitle', 'Client Details')}
              {detailsClient ? ` - ${detailsClient.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          {detailsClient && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">{t('common.overview', 'Overview')}</TabsTrigger>
                <TabsTrigger value="orders">{t('clients.orders', 'Orders')}</TabsTrigger>
                <TabsTrigger value="invoices">{t('invoices.title', 'Invoices')}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('clients.contact', 'Contact')}</p>
                      <p className="mt-2 font-medium">
                        {[detailsClient.email, detailsClient.phone].filter(Boolean).join(' | ') || t('clients.noContact', 'No contact info')}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('clients.pricingTier', 'Pricing Tier')}</p>
                      <p className="mt-2 font-medium">{PRICING_TIER_LABELS[detailsClient.pricingTier]}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('clients.lastPurchase', 'Last Purchase')}</p>
                      <p className="mt-2 font-medium">{formatDateTime(detailsClient.metrics.lastPurchaseAt)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('clients.debt', 'Debt')}</p>
                      <p className="mt-2 font-medium">{formatCurrency(detailsClient.debt.totalDebt)}</p>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>{t('clients.topProducts', 'What They Bought')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detailsClient.metrics.topProducts.length === 0 ? (
                      <p className="text-muted-foreground">{t('clients.noProducts', 'No product history yet')}</p>
                    ) : (
                      <div className="space-y-2">
                        {detailsClient.metrics.topProducts.slice(0, 8).map((item) => (
                          <div key={`${detailsClient.clientKey}-details-${item.name}`} className="flex items-center justify-between gap-3 rounded-md border p-3">
                            <span className="truncate">{item.name}</span>
                            <span className="shrink-0 text-muted-foreground">{item.quantity}x | {formatCurrency(item.spent)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="orders" className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard icon={<MdStorefront className="h-4 w-4" />} label={t('clients.orders', 'Orders')} value={String(detailsClient.metrics.purchasedOrders)} />
                  <SummaryCard icon={<BadgeDollarSign className="h-4 w-4" />} label={t('clients.totalSpent', 'Total Spent')} value={formatCurrency(detailsClient.metrics.totalSpent)} />
                  <SummaryCard icon={<Undo2 className="h-4 w-4" />} label={t('clients.returnRate', 'Return Rate')} value={`${Number(detailsClient.metrics.returnRate || 0).toFixed(1)}%`} />
                  <SummaryCard icon={<UserRound className="h-4 w-4" />} label={t('clients.itemsPurchased', 'Items Purchased')} value={String(detailsClient.metrics.totalItemsPurchased)} />
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>{t('clients.orderActivity', 'Order Activity')}</CardTitle>
                    <CardDescription>{t('clients.orderActivityDesc', 'Order count, reversals, and latest purchase timing for this client.')}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">{t('clients.reversedOrders', 'Reversed Orders')}</p>
                      <p className="mt-2 text-lg font-semibold">{detailsClient.metrics.reversedOrders}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">{t('clients.lastPurchase', 'Last Purchase')}</p>
                      <p className="mt-2 text-lg font-semibold">{formatDateTime(detailsClient.metrics.lastPurchaseAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invoices" className="space-y-4 text-sm">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard icon={<MdReceiptLong className="h-4 w-4" />} label={t('clients.totalInvoices', 'Invoices')} value={String(detailsClient.metrics.totalInvoices)} />
                  <SummaryCard icon={<BadgeDollarSign className="h-4 w-4" />} label={t('clients.totalInvoiced', 'Total Invoiced')} value={formatCurrency(detailsClient.metrics.totalInvoiced)} />
                  <SummaryCard icon={<CircleDollarSign className="h-4 w-4" />} label={t('clients.totalPaid', 'Total Paid')} value={formatCurrency(detailsClient.metrics.totalPaid)} />
                  <SummaryCard icon={<ShieldAlert className="h-4 w-4" />} label={t('clients.totalOutstanding', 'Outstanding')} value={formatCurrency(detailsClient.metrics.totalOutstanding)} />
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>{t('clients.invoiceSummary', 'Invoice Summary')}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">{t('clients.overdueInvoices', 'Overdue Invoices')}</p>
                      <p className="mt-2 text-lg font-semibold">{detailsClient.metrics.overdueInvoices}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">{t('clients.manualDebt', 'Manual debt mark')}</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrency(detailsClient.debt.manualAmount)}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailsClient(null)}>
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setClientToDelete(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('clients.deleteClient', 'Delete Client')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              'clients.deleteClientConfirm',
              'Delete {{name}} from clients list? This hides the client profile from this tab.',
              { name: clientToDelete?.name || t('common.client', 'this client') }
            )}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDeleteClient()} disabled={isDeletingClient}>
              {isDeletingClient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('clients.addClient', 'Add Client')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleCreateClient}>
            <div>
              <Label>{t('clients.name', 'Name')}</Label>
              <Input
                value={newClient.name}
                onChange={(event) => setNewClient((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('clients.namePlaceholder', 'Client full name')}
              />
            </div>
            <div>
              <Label>{t('common.email', 'Email')}</Label>
              <Input
                value={newClient.email}
                onChange={(event) => setNewClient((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="client@email.com"
              />
            </div>
            <div>
              <Label>{t('common.phone', 'Phone')}</Label>
              <Input
                value={newClient.phone}
                onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+213..."
              />
            </div>
            <div>
              <Label>{t('clients.pricingTier', 'Pricing Tier')}</Label>
              <Select
                value={newClient.pricingTier}
                onValueChange={(value) =>
                  setNewClient((prev) => ({ ...prev, pricingTier: value as PricingTier }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('clients.pricingTier', 'Pricing Tier')} />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TIERS.map((tier) => (
                    <SelectItem key={tier} value={tier}>
                      {PRICING_TIER_LABELS[tier]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('common.notes', 'Notes')}</Label>
              <Textarea
                value={newClient.notes}
                onChange={(event) => setNewClient((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t('clients.notesPlaceholder', 'Optional notes about this client')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddClientOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSavingClient}>
                {isSavingClient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDebtDialogOpen} onOpenChange={setIsDebtDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {debtForm.isInDebt ? t('clients.markDebt', 'Mark Debt') : t('clients.clearDebtMark', 'Clear Debt Mark')}
              {selectedClient ? ` - ${selectedClient.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveDebtStatus}>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>{t('clients.clientInDebt', 'Client is in debt')}</Label>
              <Switch
                checked={debtForm.isInDebt}
                onCheckedChange={(checked) => setDebtForm((prev) => ({ ...prev, isInDebt: checked }))}
              />
            </div>
            <div>
              <Label>{t('clients.manualDebtAmount', 'Manual Debt Amount')}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={debtForm.amount}
                onChange={(event) => setDebtForm((prev) => ({ ...prev, amount: event.target.value }))}
                disabled={!debtForm.isInDebt}
              />
            </div>
            <div>
              <Label>{t('common.notes', 'Notes')}</Label>
              <Textarea
                value={debtForm.note}
                onChange={(event) => setDebtForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={t('clients.debtNote', 'Reason, payment plan, due date...')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDebtDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSavingDebt}>
                {isSavingDebt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      </div>
    </CardContent>
  </Card>
);

export default ClientsPage;
