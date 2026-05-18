import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Crown,
  Loader2,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import {
  adminAPI,
  type AdminOverview,
  type AdminUserRecord,
  type PlatformAdminRecord,
} from '@/services/api';
import type { User } from '@/types';

const plans: Array<User['subscription']['plan']> = ['basic', 'premium', 'pro', 'enterprise'];
const statuses: Array<User['subscription']['status']> = ['active', 'inactive', 'cancelled', 'expired'];

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const AdminPanelPage: React.FC = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', name: '' });
  const [editingUser, setEditingUser] = useState<AdminUserRecord | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<{
    plan: User['subscription']['plan'];
    status: User['subscription']['status'];
    startDate: string;
    endDate: string;
  }>({
    plan: 'basic',
    status: 'inactive',
    startDate: '',
    endDate: '',
  });
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);

  const canAccess = Boolean(user?.isPlatformAdmin);

  const loadOverview = useCallback(async () => {
    const response = await adminAPI.getOverview();
    setOverview(response.data);
  }, []);

  const loadAdmins = useCallback(async () => {
    const response = await adminAPI.getAdmins();
    setAdmins(response.data.admins || []);
  }, []);

  const loadUsers = useCallback(async () => {
    const response = await adminAPI.getUsers({
      search: search.trim() || undefined,
      status: statusFilter,
      plan: planFilter,
      page: pagination.page,
      limit: pagination.limit,
    });
    setUsers(response.data.users || []);
    setPagination(response.data.pagination);
  }, [pagination.limit, pagination.page, planFilter, search, statusFilter]);

  const loadAdminPanel = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    try {
      await Promise.all([loadOverview(), loadAdmins(), loadUsers()]);
    } catch (error) {
      console.error('Error loading admin panel:', error);
      toast.error('Unable to load admin panel');
    } finally {
      setIsLoading(false);
    }
  }, [canAccess, loadAdmins, loadOverview, loadUsers]);

  useEffect(() => {
    void loadAdminPanel();
  }, [loadAdminPanel]);

  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }));
  }, [search, statusFilter, planFilter]);

  const openSubscriptionDialog = (targetUser: AdminUserRecord) => {
    setEditingUser(targetUser);
    setSubscriptionForm({
      plan: targetUser.subscription?.plan || 'basic',
      status: targetUser.subscription?.status || 'inactive',
      startDate: toDateInputValue(targetUser.subscription?.startDate),
      endDate: toDateInputValue(targetUser.subscription?.endDate),
    });
  };

  const saveSubscription = async () => {
    if (!editingUser) return;
    setIsSavingSubscription(true);
    try {
      const response = await adminAPI.updateUserSubscription(editingUser.id, {
        plan: subscriptionForm.plan,
        status: subscriptionForm.status,
        startDate: subscriptionForm.startDate || null,
        endDate: subscriptionForm.endDate || null,
      });
      setUsers((current) =>
        current.map((item) => (item.id === response.data.user.id ? response.data.user : item)),
      );
      setEditingUser(null);
      toast.success('Subscription updated');
      void loadOverview();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Unable to update subscription');
    } finally {
      setIsSavingSubscription(false);
    }
  };

  const addAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!adminForm.email.trim()) return;
    setIsSavingAdmin(true);
    try {
      await adminAPI.addAdmin({
        email: adminForm.email.trim(),
        name: adminForm.name.trim() || undefined,
      });
      setAdminForm({ email: '', name: '' });
      await loadAdmins();
      await loadUsers();
      toast.success('Admin added');
    } catch (error) {
      console.error('Error adding admin:', error);
      toast.error('Unable to add admin');
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const removeAdmin = async (admin: PlatformAdminRecord) => {
    if (admin.isOwner) return;
    if (!confirm(`Remove ${admin.email} from platform admins?`)) return;
    try {
      await adminAPI.removeAdmin(admin.email);
      await loadAdmins();
      await loadUsers();
      toast.success('Admin removed');
    } catch (error) {
      console.error('Error removing admin:', error);
      toast.error('Unable to remove admin');
    }
  };

  const maxVisits = useMemo(
    () => Math.max(1, ...(overview?.visitsByDay || []).map((item) => item.visits)),
    [overview?.visitsByDay],
  );

  if (!canAccess) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertDescription>Platform admin access is required.</AlertDescription>
      </Alert>
    );
  }

  const totals = overview?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#495FFA]" />
            <h1 className="text-3xl font-semibold tracking-tight">Admin Panel</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Search users, manage subscriptions, and monitor Stockly activity.
          </p>
        </div>
        <Button onClick={() => void loadAdminPanel()} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-3xl">{totals?.users ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {totals?.newUsersToday ?? 0} joined today
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active subscriptions</CardDescription>
            <CardTitle className="text-3xl">{totals?.subscribedUsers ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Across all paid plans
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Online now</CardDescription>
            <CardTitle className="text-3xl">{totals?.onlineNow ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Active in the last 15 minutes
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Website visits</CardDescription>
            <CardTitle className="text-3xl">{totals?.visits ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {totals?.visitsToday ?? 0} today, {totals?.uniqueVisitors ?? 0} unique
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="admins">
            <Crown className="mr-2 h-4 w-4" />
            Admins
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-2 h-4 w-4" />
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Search accounts and change subscription access without touching customer data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, email, or business type"
                    className="pl-9"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All plans</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => void loadUsers()}>
                  Search
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Last login</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="font-medium">{entry.name || 'Unnamed user'}</div>
                          <div className="text-xs text-muted-foreground">{entry.email}</div>
                          {entry.platformAdmin && <Badge className="mt-1 bg-[#495FFA]">Admin</Badge>}
                        </TableCell>
                        <TableCell className="capitalize">{entry.subscription?.plan || 'basic'}</TableCell>
                        <TableCell>
                          <Badge variant={entry.isSubscribed ? 'default' : 'secondary'} className="capitalize">
                            {entry.subscription?.status || 'inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.businessType || 'Not selected'}</TableCell>
                        <TableCell>{formatDateTime(entry.lastLoginAt)}</TableCell>
                        <TableCell>{formatDate(entry.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openSubscriptionDialog(entry)}>
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Page {pagination.page} of {pagination.pages} ({pagination.total} users)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Add Admin</CardTitle>
              <CardDescription>Admins can access this panel and manage subscriptions.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={addAdmin}>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={adminForm.email}
                    onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={adminForm.name}
                    onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <Button type="submit" disabled={isSavingAdmin} className="w-full">
                  {isSavingAdmin ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Add Admin
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Admins</CardTitle>
              <CardDescription>Your owner account is permanent and cannot be removed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {admins.map((admin) => (
                <div key={admin.email} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {admin.name || admin.email}
                      {admin.isOwner && <Badge className="bg-amber-500">Owner</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{admin.email}</div>
                    <div className="text-xs text-muted-foreground">Added {formatDate(admin.createdAt)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={admin.isOwner}
                    onClick={() => void removeAdmin(admin)}
                    aria-label={`Remove ${admin.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Visits Last 7 Days</CardTitle>
              <CardDescription>Website traffic recorded from the React app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(overview?.visitsByDay || []).map((item) => (
                <div key={item.date} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.date}</span>
                    <span>{item.visits} visits</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded bg-[#495FFA]"
                      style={{ width: `${Math.max(6, (item.visits / maxVisits) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {overview?.visitsByDay?.length === 0 && (
                <p className="text-sm text-muted-foreground">No visit data yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Mix</CardTitle>
              <CardDescription>Plan and status distribution across all users.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Plans</h3>
                {(overview?.subscriptions.byPlan || []).map((item) => (
                  <div key={item.plan} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="capitalize">{item.plan}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Statuses</h3>
                {(overview?.subscriptions.byStatus || []).map((item) => (
                  <div key={item.status} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="capitalize">{item.status}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="font-medium">{editingUser?.name}</div>
              <div className="text-sm text-muted-foreground">{editingUser?.email}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={subscriptionForm.plan}
                  onValueChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      plan: value as User['subscription']['plan'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={subscriptionForm.status}
                  onValueChange={(value) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      status: value as User['subscription']['status'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={subscriptionForm.startDate}
                  onChange={(event) =>
                    setSubscriptionForm((current) => ({ ...current, startDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={subscriptionForm.endDate}
                  onChange={(event) =>
                    setSubscriptionForm((current) => ({ ...current, endDate: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveSubscription()} disabled={isSavingSubscription}>
              {isSavingSubscription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanelPage;
