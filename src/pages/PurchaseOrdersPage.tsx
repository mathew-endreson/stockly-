import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, Plus, Trash2, Truck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { businessAPI, productsAPI } from '@/services/api';
import type { Product, PurchaseOrder, PurchaseOrderStatus } from '@/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'Draft',
  'Sent',
  'Confirmed',
  'In Transit',
  'At Customs',
  'Received'
];

type DraftPurchaseOrder = {
  supplier: string;
  referenceNumber: string;
  status: PurchaseOrderStatus;
  notes: string;
  items: Array<{ product: string; quantity: string; costPerItem: string }>;
  associatedCosts: Array<{ name: string; amount: string }>;
};

const createInitialDraft = (): DraftPurchaseOrder => ({
  supplier: '',
  referenceNumber: '',
  status: 'Draft',
  notes: '',
  items: [{ product: '', quantity: '1', costPerItem: '0' }],
  associatedCosts: [{ name: 'Shipping', amount: '0' }]
});

const PurchaseOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = React.useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = React.useState<PurchaseOrder | null>(null);
  const [draft, setDraft] = React.useState<DraftPurchaseOrder>(createInitialDraft());

  const isWholesaleBusiness = user?.businessType === 'wholesale_importer';
  const hasRequiredPlan = ['pro', 'enterprise'].includes(user?.subscription?.plan || '');
  const canAccess = Boolean(isWholesaleBusiness && hasRequiredPlan);

  const loadData = React.useCallback(async () => {
    if (!canAccess) return;
    try {
      setIsLoading(true);
      setError(null);
      const [purchaseOrderResponse, productResponse] = await Promise.all([
        businessAPI.getPurchaseOrders({ limit: 120 }),
        productsAPI.getProducts({ limit: 200, sort: 'name' })
      ]);
      setPurchaseOrders(purchaseOrderResponse.data.purchaseOrders);
      setProducts(productResponse.data.products || []);
      setSelectedPurchaseOrder((current) =>
        purchaseOrderResponse.data.purchaseOrders.find((item) => item._id === current?._id) ||
        purchaseOrderResponse.data.purchaseOrders[0] ||
        null
      );
    } catch (apiError) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('purchaseOrders.loadFailed', 'Failed to load purchase orders.'));
    } finally {
      setIsLoading(false);
    }
  }, [canAccess, t]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setEditingPurchaseOrder(null);
    setDraft(createInitialDraft());
    setIsDialogOpen(true);
  };

  const openEditDialog = (purchaseOrder: PurchaseOrder) => {
    setEditingPurchaseOrder(purchaseOrder);
    setDraft({
      supplier: purchaseOrder.supplier,
      referenceNumber: purchaseOrder.referenceNumber || '',
      status: purchaseOrder.status,
      notes: purchaseOrder.notes || '',
      items: purchaseOrder.items.map((item) => ({
        product: typeof item.product === 'string' ? item.product : item.product._id,
        quantity: String(item.quantity),
        costPerItem: String(item.costPerItem)
      })),
      associatedCosts:
        purchaseOrder.associatedCosts.length > 0
          ? purchaseOrder.associatedCosts.map((cost) => ({
              name: cost.name,
              amount: String(cost.amount)
            }))
          : [{ name: 'Shipping', amount: '0' }]
    });
    setIsDialogOpen(true);
  };

  const savePurchaseOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      const items = draft.items
        .filter((item) => item.product)
        .map((item) => {
          const quantity = Number(item.quantity || 0);
          const costPerItem = Number(item.costPerItem || 0);
          const matchingProduct = products.find((product) => product._id === item.product);

          return {
            product: item.product,
            name: matchingProduct?.name || '',
            sku: matchingProduct?.sku || '',
            quantity,
            costPerItem
          };
        });

      const payload = {
        supplier: draft.supplier,
        referenceNumber: draft.referenceNumber,
        status: draft.status,
        notes: draft.notes,
        items,
        associatedCosts: draft.associatedCosts
          .filter((cost) => cost.name.trim())
          .map((cost) => ({
            name: cost.name,
            amount: Number(cost.amount || 0)
          }))
      };

      if (editingPurchaseOrder) {
        await businessAPI.updatePurchaseOrder(editingPurchaseOrder._id, payload);
      } else {
        await businessAPI.createPurchaseOrder(payload);
      }
      setIsDialogOpen(false);
      await loadData();
    } catch (apiError) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('purchaseOrders.saveFailed', 'Failed to save purchase order.'));
    } finally {
      setIsSaving(false);
    }
  };

  const updatePurchaseOrderStatus = async (purchaseOrderId: string, status: PurchaseOrderStatus) => {
    try {
      await businessAPI.updatePurchaseOrderStatus(purchaseOrderId, status);
      await loadData();
    } catch (apiError) {
      const message =
        typeof apiError === 'object' &&
        apiError !== null &&
        'response' in apiError
          ? (apiError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || t('purchaseOrders.statusFailed', 'Failed to update purchase order status.'));
    }
  };

  if (!isWholesaleBusiness) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t(
            'purchaseOrders.businessTypeRequired',
            'Purchase Orders are available only for the Wholesale / Importer business type.'
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!hasRequiredPlan) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t(
            'purchaseOrders.planRequired',
            'Upgrade to Pro or Enterprise to use landed-cost tracking and purchase orders.'
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('purchaseOrders.title', 'Purchase Orders')}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'purchaseOrders.subtitle',
              'Track procurement, landed costs, customs, and stock receipts in one place.'
            )}
          </p>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t('purchaseOrders.new', 'New Purchase Order')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('purchaseOrders.list', 'Open Purchase Orders')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading', 'Loading...')}
              </div>
            ) : (
              <div className="table-responsive rounded-md border">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('purchaseOrders.supplier', 'Supplier')}</TableHead>
                    <TableHead>{t('purchaseOrders.status', 'Status')}</TableHead>
                    <TableHead>{t('purchaseOrders.reference', 'Reference')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((purchaseOrder) => (
                    <TableRow
                      key={purchaseOrder._id}
                      className="cursor-pointer"
                      onClick={() => setSelectedPurchaseOrder(purchaseOrder)}
                    >
                      <TableCell className="font-medium">{purchaseOrder.supplier}</TableCell>
                      <TableCell>{purchaseOrder.status}</TableCell>
                      <TableCell>{purchaseOrder.referenceNumber || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(purchaseOrder)}>
                          {t('common.edit', 'Edit')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedPurchaseOrder?.supplier || t('purchaseOrders.detail', 'Purchase Order Detail')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPurchaseOrder ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedPurchaseOrder.status}
                    onValueChange={(value) =>
                      void updatePurchaseOrderStatus(selectedPurchaseOrder._id, value as PurchaseOrderStatus)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURCHASE_ORDER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border p-4">
                  <p className="text-sm font-medium">{t('purchaseOrders.costBreakdown', 'Associated Costs')}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {selectedPurchaseOrder.associatedCosts.map((cost) => (
                      <div key={`${selectedPurchaseOrder._id}-${cost.name}`} className="flex items-center justify-between">
                        <span>{cost.name}</span>
                        <span>{formatCurrency(cost.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <p className="text-sm font-medium">{t('purchaseOrders.landedCosts', 'Landed Cost Per Item')}</p>
                  <div className="mt-3 space-y-3">
                    {selectedPurchaseOrder.items.map((item) => {
                      const productId = typeof item.product === 'string' ? item.product : item.product._id;
                      const landedCost = selectedPurchaseOrder.landedCostPerItem?.[productId];
                      return (
                        <div key={`${selectedPurchaseOrder._id}-${productId}`} className="space-y-1 rounded-md border p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.name}</span>
                            <span>{item.quantity}x</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{t('purchaseOrders.baseCost', 'Base cost')}</span>
                            <span>{formatCurrency(item.costPerItem)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{t('purchaseOrders.finalLandedCost', 'Final landed cost')}</span>
                            <span>{typeof landedCost === 'number' ? formatCurrency(landedCost) : '-'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('purchaseOrders.emptySelection', 'Select a purchase order to review landed costs and shipment details.')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingPurchaseOrder
                ? t('purchaseOrders.edit', 'Edit Purchase Order')
                : t('purchaseOrders.new', 'New Purchase Order')}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePurchaseOrder}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>{t('purchaseOrders.supplier', 'Supplier')}</Label>
                <Input
                  value={draft.supplier}
                  onChange={(event) => setDraft((prev) => ({ ...prev, supplier: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{t('purchaseOrders.reference', 'Reference')}</Label>
                <Input
                  value={draft.referenceNumber}
                  onChange={(event) => setDraft((prev) => ({ ...prev, referenceNumber: event.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('purchaseOrders.status', 'Status')}</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, status: value as PurchaseOrderStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURCHASE_ORDER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>{t('purchaseOrders.items', 'Items')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      items: [...prev.items, { product: '', quantity: '1', costPerItem: '0' }]
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('purchaseOrders.addItem', 'Add Item')}
                </Button>
              </div>
              {draft.items.map((item, index) => (
                <div key={`draft-item-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(120px,0.6fr)_minmax(120px,0.6fr)_auto]">
                  <Select
                    value={item.product}
                    onValueChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, product: value } : entry
                        )
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('purchaseOrders.selectProduct', 'Select product')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, quantity: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder={t('common.quantity', 'Quantity')}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.costPerItem}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, costPerItem: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder={t('purchaseOrders.costPerItem', 'Cost per item')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        items: prev.items.filter((_, entryIndex) => entryIndex !== index)
                      }))
                    }
                    disabled={draft.items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>{t('purchaseOrders.associatedCosts', 'Associated Costs')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      associatedCosts: [...prev.associatedCosts, { name: '', amount: '0' }]
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('purchaseOrders.addCost', 'Add Cost')}
                </Button>
              </div>
              {draft.associatedCosts.map((cost, index) => (
                <div key={`draft-cost-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(120px,0.6fr)_auto]">
                  <Input
                    value={cost.name}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        associatedCosts: prev.associatedCosts.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, name: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder={t('purchaseOrders.costName', 'Shipping, customs, insurance...')}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cost.amount}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        associatedCosts: prev.associatedCosts.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, amount: event.target.value } : entry
                        )
                      }))
                    }
                    placeholder={t('purchaseOrders.amount', 'Amount')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        associatedCosts: prev.associatedCosts.filter((_, entryIndex) => entryIndex !== index)
                      }))
                    }
                    disabled={draft.associatedCosts.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label>{t('common.notes', 'Notes')}</Label>
              <Textarea
                value={draft.notes}
                onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t('purchaseOrders.notesPlaceholder', 'Shipment notes, customs notes, supplier terms...')}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseOrdersPage;
