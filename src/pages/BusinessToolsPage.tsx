import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, Package, RefreshCcw, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { businessAPI, productsAPI, salesAPI } from '@/services/api';
import { BUSINESS_TOOLKIT_META, getCapabilitiesForBusinessType } from '@/constants/businessCapabilities';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type {
  BusinessHighlightCard,
  BusinessType,
  ClothingReturnRecord,
  ClothingReturnStatus,
  ClothingVariant,
  Product,
  Sale,
  SupermarketBatch,
  SupermarketPromotion,
} from '@/types';

const toneClasses: Record<BusinessHighlightCard['tone'], string> = {
  info: 'border-blue-200 bg-blue-50',
  success: 'border-emerald-200 bg-emerald-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
};
const WALK_IN_CUSTOMER_ALIASES = new Set([
  'walk-in customer',
  'walk in customer',
  'عميل داخل المتجر',
  'client en magasin',
]);

const BusinessToolsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, canEdit, canDelete, canManageSales } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const businessType = user?.businessType as BusinessType | null;
  const toolkitMeta = businessType ? BUSINESS_TOOLKIT_META[businessType] : null;
  const capabilities = getCapabilitiesForBusinessType(businessType);
  const hasTypeSpecificCapabilities = capabilities.some((capability) =>
    [
      'clothing_variants',
      'clothing_returns',
      'supermarket_batch_expiry',
      'supermarket_promo_bundles'
    ].includes(capability)
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<BusinessHighlightCard[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [variants, setVariants] = useState<ClothingVariant[]>([]);
  const [returnsQueue, setReturnsQueue] = useState<ClothingReturnRecord[]>([]);
  const [batches, setBatches] = useState<SupermarketBatch[]>([]);
  const [promotions, setPromotions] = useState<SupermarketPromotion[]>([]);

  const [variantForm, setVariantForm] = useState({
    productId: '',
    variantSku: '',
    size: '',
    color: '',
    quantity: '0',
  });
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantEditForm, setVariantEditForm] = useState({
    variantSku: '',
    size: '',
    color: '',
    quantity: '0',
  });
  const [returnForm, setReturnForm] = useState({
    saleId: '',
    reason: 'wrong_size',
  });
  const [batchForm, setBatchForm] = useState({
    productId: '',
    batchCode: '',
    quantity: '0',
    expiresAt: '',
  });
  const [promotionForm, setPromotionForm] = useState({
    name: '',
    productIds: [] as string[],
    productQuantities: {} as Record<string, string>,
    startsAt: '',
    endsAt: '',
    bundlePrice: '0',
  });
  const [promotionProductSearch, setPromotionProductSearch] = useState('');
  const formatCustomerName = (saleLike: { customer?: { name?: string | null }; orderType?: string | null }) => {
    const rawCustomerName = String(saleLike.customer?.name || '').trim();
    const normalizedCustomerName = rawCustomerName.toLowerCase();
    const isWalkInOrder = String(saleLike.orderType || '')
      .trim()
      .toLowerCase() === 'walk_in';

    if (WALK_IN_CUSTOMER_ALIASES.has(normalizedCustomerName) || (!rawCustomerName && isWalkInOrder)) {
      return t('ecommerce.walkInCustomer', 'Walk-in Customer');
    }

    return rawCustomerName || t('ecommerce.customer', 'Customer');
  };

  const loadHighlights = useCallback(async () => {
    const response = await businessAPI.getHighlights();
    setHighlights(response.data.cards || []);
  }, []);

  const loadSharedOptions = useCallback(async () => {
    const [productsResponse, salesResponse] = await Promise.all([
      productsAPI.getProducts({ page: 1, limit: 200, sort: 'name' }),
      salesAPI.getSales({ page: 1, limit: 100, sort: '-createdAt' }),
    ]);
    setProducts(productsResponse.data.products || []);
    setSales(salesResponse.data.sales || []);
  }, []);

  const loadClothing = useCallback(async () => {
    const [variantsResponse, returnsResponse] = await Promise.all([
      businessAPI.getClothingVariants(),
      businessAPI.getClothingReturns(),
    ]);
    setVariants(variantsResponse.data.variants || []);
    setReturnsQueue(returnsResponse.data.returns || []);
  }, []);

  const loadSupermarket = useCallback(async () => {
    const [batchesResponse, promotionsResponse] = await Promise.all([
      businessAPI.getSupermarketBatches(),
      businessAPI.getSupermarketPromotions(true),
    ]);
    setBatches(batchesResponse.data.batches || []);
    setPromotions(promotionsResponse.data.promotions || []);
  }, []);

  const reload = useCallback(async () => {
    if (!businessType) {
      setLoading(false);
      return;
    }
    if (businessType === 'ecommerce') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await loadHighlights();
      await loadSharedOptions();
      if (businessType === 'clothing_retail') await loadClothing();
      if (businessType === 'supermarket') await loadSupermarket();
    } catch (loadError: unknown) {
      const apiError = loadError as { response?: { data?: { message?: string } } };
      setError(
        apiError?.response?.data?.message ||
          t('businessTools.loadError', 'Failed to load business tools.')
      );
    } finally {
      setLoading(false);
    }
  }, [businessType, loadHighlights, loadSharedOptions, loadClothing, loadSupermarket, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreateVariant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!variantForm.productId || !variantForm.variantSku || !canEdit()) return;
    await businessAPI.createClothingVariant({
      productId: variantForm.productId,
      variantSku: variantForm.variantSku,
      size: variantForm.size,
      color: variantForm.color,
      quantity: Math.max(0, Number(variantForm.quantity || 0)),
    });
    setVariantForm({ productId: '', variantSku: '', size: '', color: '', quantity: '0' });
    await loadClothing();
    await loadHighlights();
  };

  const handleStartEditVariant = (variant: ClothingVariant) => {
    setEditingVariantId(String(variant._id));
    setVariantEditForm({
      variantSku: variant.variantSku || '',
      size: variant.size || '',
      color: variant.color || '',
      quantity: String(variant.quantity ?? 0),
    });
  };

  const handleCancelEditVariant = () => {
    setEditingVariantId(null);
    setVariantEditForm({
      variantSku: '',
      size: '',
      color: '',
      quantity: '0',
    });
  };

  const handleUpdateVariant = async (variantId: string) => {
    if (!canEdit()) return;
    await businessAPI.updateClothingVariant(variantId, {
      variantSku: variantEditForm.variantSku,
      size: variantEditForm.size,
      color: variantEditForm.color,
      quantity: Math.max(0, Number(variantEditForm.quantity || 0)),
    });
    handleCancelEditVariant();
    await loadClothing();
    await loadHighlights();
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!canDelete()) return;
    await businessAPI.deleteClothingVariant(variantId);
    if (editingVariantId === variantId) {
      handleCancelEditVariant();
    }
    await loadClothing();
    await loadHighlights();
  };

  const handleCreateReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!returnForm.saleId || !canManageSales()) return;
    await businessAPI.createClothingReturn({
      saleId: returnForm.saleId,
      reason: returnForm.reason as
        | 'wrong_size'
        | 'damaged_item'
        | 'wrong_item'
        | 'quality_issue'
        | 'other',
    });
    setReturnForm({ saleId: '', reason: 'wrong_size' });
    await loadClothing();
    await loadHighlights();
  };

  const handleUpdateReturnStatus = async (returnId: string, status: ClothingReturnStatus) => {
    if (!canManageSales()) return;
    await businessAPI.updateClothingReturnStatus(returnId, { status });
    await loadClothing();
    await loadHighlights();
  };

  const handleCreateBatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!batchForm.productId || !batchForm.batchCode || !batchForm.expiresAt || !canEdit()) return;
    await businessAPI.createSupermarketBatch({
      productId: batchForm.productId,
      batchCode: batchForm.batchCode,
      quantity: Number(batchForm.quantity || 0),
      expiresAt: batchForm.expiresAt,
    });
    setBatchForm({ productId: '', batchCode: '', quantity: '0', expiresAt: '' });
    await loadSupermarket();
    await loadHighlights();
  };

  const handleCreatePromotion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!promotionForm.name || !promotionForm.startsAt || !promotionForm.endsAt || !canEdit()) return;
    if (promotionForm.productIds.length === 0) return;
    if (hasInvalidPromotionQuantities) return;

    const bundleItems = promotionForm.productIds.map((productId) => {
      const parsedQuantity = Number(promotionForm.productQuantities[productId] || 1);
      return {
        productId,
        quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1
      };
    });

    await businessAPI.createSupermarketPromotion({
      name: promotionForm.name,
      productIds: promotionForm.productIds,
      bundleItems,
      startsAt: promotionForm.startsAt,
      endsAt: promotionForm.endsAt,
      bundlePrice: Number(promotionForm.bundlePrice || 0),
    });
    setPromotionForm({
      name: '',
      productIds: [],
      productQuantities: {},
      startsAt: '',
      endsAt: '',
      bundlePrice: '0'
    });
    setPromotionProductSearch('');
    await loadSupermarket();
    await loadHighlights();
  };

  const handleAddPromotionProduct = (productId: string) => {
    setPromotionForm((prev) => {
      if (prev.productIds.includes(productId)) return prev;
      return {
        ...prev,
        productIds: [...prev.productIds, productId],
        productQuantities: {
          ...prev.productQuantities,
          [productId]: prev.productQuantities[productId] || '1'
        }
      };
    });
  };

  const handleRemovePromotionProduct = (productId: string) => {
    setPromotionForm((prev) => {
      const nextQuantities = { ...prev.productQuantities };
      delete nextQuantities[productId];
      return {
        ...prev,
        productIds: prev.productIds.filter((id) => id !== productId),
        productQuantities: nextQuantities
      };
    });
  };

  const handlePromotionProductQuantityChange = (productId: string, value: string) => {
    setPromotionForm((prev) => ({
      ...prev,
      productQuantities: {
        ...prev.productQuantities,
        [productId]: value
      }
    }));
  };

  const filteredPromotionProducts = useMemo(() => {
    const normalizedQuery = promotionProductSearch.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => {
      const name = String(product.name || '').toLowerCase();
      const sku = String(product.sku || '').toLowerCase();
      const barcode = String(product.barcode || '').toLowerCase();
      return (
        name.includes(normalizedQuery) ||
        sku.includes(normalizedQuery) ||
        barcode.includes(normalizedQuery)
      );
    });
  }, [products, promotionProductSearch]);

  const selectedPromotionProducts = useMemo(
    () =>
      promotionForm.productIds
        .map((id) => {
          const product = products.find((item) => String(item._id) === String(id));
          if (!product) return null;
          const parsedQuantity = Number(promotionForm.productQuantities[id] || 1);
          return {
            product,
            quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1
          };
        })
        .filter(Boolean) as Array<{ product: Product; quantity: number }>,
    [products, promotionForm.productIds, promotionForm.productQuantities]
  );

  const selectedPromotionUnits = useMemo(
    () => selectedPromotionProducts.reduce((sum, item) => sum + item.quantity, 0),
    [selectedPromotionProducts]
  );

  const hasInvalidPromotionQuantities = useMemo(
    () =>
      promotionForm.productIds.some((productId) => {
        const parsedQuantity = Number(promotionForm.productQuantities[productId] || 0);
        return !Number.isFinite(parsedQuantity) || parsedQuantity <= 0;
      }),
    [promotionForm.productIds, promotionForm.productQuantities]
  );

  if (!businessType || !toolkitMeta) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('businessTools.title', 'Business Tools')}</CardTitle>
          <CardDescription>
            {t('businessTools.selectType', 'Select a business type to unlock this module.')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (businessType === 'ecommerce') {
    return <Navigate to="/dashboard/analytics" replace />;
  }

  if (!hasTypeSpecificCapabilities) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('businessTools.title', 'Business Tools')}</CardTitle>
          <CardDescription>
            {t(
              'businessTools.disabled',
              'Business-specific tools are currently disabled for this workspace.'
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{toolkitMeta.title}</h1>
          <p className="text-muted-foreground">{toolkitMeta.subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => void reload()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-red-700">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {highlights.map((card) => (
          <Card key={card.id} className={toneClasses[card.tone]}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {businessType === 'clothing_retail' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessTools.variants.title', 'Variant Matrix')}</CardTitle>
              <CardDescription>
                {t('businessTools.variants.description', 'Track size/color variants as separate SKUs.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleCreateVariant}>
                <div>
                  <Label>{t('businessTools.productLabel', 'Product')}</Label>
                  <Select
                    value={variantForm.productId}
                    onValueChange={(value) => setVariantForm((prev) => ({ ...prev, productId: value }))}
                    disabled={!canEdit()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('businessTools.selectProduct', 'Select product')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name} ({product.sku || '-'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('businessTools.variantSku', 'Variant SKU')}</Label>
                    <Input
                      value={variantForm.variantSku}
                      onChange={(event) =>
                        setVariantForm((prev) => ({ ...prev, variantSku: event.target.value }))
                      }
                      disabled={!canEdit()}
                    />
                  </div>
                  <div>
                    <Label>{t('businessTools.sizeLabel', 'Size')}</Label>
                    <Input
                      value={variantForm.size}
                      onChange={(event) => setVariantForm((prev) => ({ ...prev, size: event.target.value }))}
                      disabled={!canEdit()}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t('businessTools.colorLabel', 'Color')}</Label>
                  <Input
                    value={variantForm.color}
                    onChange={(event) => setVariantForm((prev) => ({ ...prev, color: event.target.value }))}
                    disabled={!canEdit()}
                  />
                </div>
                <div>
                  <Label>{t('businessTools.quantityLabel', 'Quantity')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={variantForm.quantity}
                    onChange={(event) =>
                      setVariantForm((prev) => ({ ...prev, quantity: event.target.value }))
                    }
                    disabled={!canEdit()}
                  />
                </div>
                <Button type="submit" disabled={!canEdit()}>
                  {t('businessTools.addVariant', 'Add Variant')}
                </Button>
              </form>

              <div className="space-y-2">
                {variants.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('businessTools.variants.empty', 'No variants yet.')}
                  </p>
                )}
                {variants.map((variant) => {
                  const variantId = String(variant._id);
                  const isEditing = editingVariantId === variantId;

                  return (
                    <div key={variantId} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{variant.variantSku}</p>
                          <p className="text-sm text-muted-foreground">
                            {variant.size || '-'} / {variant.color || '-'} -{' '}
                            {t('businessTools.qtyShort', 'Qty')} {variant.quantity}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEditVariant(variant)}
                            disabled={!canEdit()}
                          >
                            {t('common.edit', 'Edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDeleteVariant(variantId)}
                            disabled={!canDelete()}
                          >
                            {t('common.delete', 'Delete')}
                          </Button>
                        </div>
                      </div>
                      {isEditing && (
                        <div className="mt-3 space-y-3 rounded-md border bg-muted/20 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label>{t('businessTools.variantSku', 'Variant SKU')}</Label>
                              <Input
                                value={variantEditForm.variantSku}
                                onChange={(event) =>
                                  setVariantEditForm((prev) => ({
                                    ...prev,
                                    variantSku: event.target.value,
                                  }))
                                }
                                disabled={!canEdit()}
                              />
                            </div>
                            <div>
                              <Label>{t('businessTools.quantityLabel', 'Quantity')}</Label>
                              <Input
                                type="number"
                                min={0}
                                value={variantEditForm.quantity}
                                onChange={(event) =>
                                  setVariantEditForm((prev) => ({
                                    ...prev,
                                    quantity: event.target.value,
                                  }))
                                }
                                disabled={!canEdit()}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label>{t('businessTools.sizeLabel', 'Size')}</Label>
                              <Input
                                value={variantEditForm.size}
                                onChange={(event) =>
                                  setVariantEditForm((prev) => ({ ...prev, size: event.target.value }))
                                }
                                disabled={!canEdit()}
                              />
                            </div>
                            <div>
                              <Label>{t('businessTools.colorLabel', 'Color')}</Label>
                              <Input
                                value={variantEditForm.color}
                                onChange={(event) =>
                                  setVariantEditForm((prev) => ({ ...prev, color: event.target.value }))
                                }
                                disabled={!canEdit()}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleUpdateVariant(variantId)}
                              disabled={!canEdit() || !variantEditForm.variantSku}
                            >
                              {t('common.save', 'Save')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditVariant}
                            >
                              {t('common.cancel', 'Cancel')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('businessTools.returns.title', 'Returns & Exchanges')}</CardTitle>
              <CardDescription>
                {t(
                  'businessTools.returns.description',
                  'Capture return requests and move them through status.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleCreateReturn}>
                <div>
                  <Label>{t('businessTools.saleLabel', 'Sale')}</Label>
                  <Select
                    value={returnForm.saleId}
                    onValueChange={(value) => setReturnForm((prev) => ({ ...prev, saleId: value }))}
                    disabled={!canManageSales()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('businessTools.selectSale', 'Select sale order')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sales.map((sale) => (
                        <SelectItem key={sale._id} value={sale._id}>
                          {sale.orderNumber} - {formatCustomerName(sale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('businessTools.reasonLabel', 'Reason')}</Label>
                  <Select
                    value={returnForm.reason}
                    onValueChange={(value) => setReturnForm((prev) => ({ ...prev, reason: value }))}
                    disabled={!canManageSales()}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wrong_size">
                        {t('businessTools.returns.reason.wrongSize', 'Wrong size')}
                      </SelectItem>
                      <SelectItem value="damaged_item">
                        {t('businessTools.returns.reason.damaged', 'Damaged item')}
                      </SelectItem>
                      <SelectItem value="wrong_item">
                        {t('businessTools.returns.reason.wrongItem', 'Wrong item')}
                      </SelectItem>
                      <SelectItem value="quality_issue">
                        {t('businessTools.returns.reason.quality', 'Quality issue')}
                      </SelectItem>
                      <SelectItem value="other">
                        {t('businessTools.returns.reason.other', 'Other')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={!canManageSales()}>
                  {t('businessTools.returns.create', 'Create Return')}
                </Button>
              </form>

              <div className="space-y-2">
                {returnsQueue.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('businessTools.returns.empty', 'No return requests yet.')}
                  </p>
                )}
                {returnsQueue.map((item) => (
                  <div key={item._id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">{item.customerName}</p>
                      </div>
                      <Select
                        value={item.status}
                        onValueChange={(value) =>
                          void handleUpdateReturnStatus(item._id, value as ClothingReturnStatus)
                        }
                        disabled={!canManageSales()}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requested">
                            {t('businessTools.returns.status.requested', 'Requested')}
                          </SelectItem>
                          <SelectItem value="approved">
                            {t('businessTools.returns.status.approved', 'Approved')}
                          </SelectItem>
                          <SelectItem value="rejected">
                            {t('businessTools.returns.status.rejected', 'Rejected')}
                          </SelectItem>
                          <SelectItem value="completed">
                            {t('businessTools.returns.status.completed', 'Completed')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {businessType === 'supermarket' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('businessTools.batch.title', 'Batch & Expiry Tracker')}</CardTitle>
              <CardDescription>
                {t('businessTools.batch.description', 'Track incoming batches and expiry dates.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleCreateBatch}>
                <div>
                  <Label>{t('businessTools.batch.productLabel', 'Product')}</Label>
                  <Select
                    value={batchForm.productId}
                    onValueChange={(value) => setBatchForm((prev) => ({ ...prev, productId: value }))}
                    disabled={!canEdit()}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('businessTools.batch.selectProduct', 'Select product')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product._id} value={product._id}>
                          {product.name} ({product.sku || '-'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('businessTools.batch.batchCodeLabel', 'Batch code')}</Label>
                    <Input
                      value={batchForm.batchCode}
                      onChange={(event) =>
                        setBatchForm((prev) => ({ ...prev, batchCode: event.target.value }))
                      }
                      disabled={!canEdit()}
                    />
                  </div>
                  <div>
                    <Label>{t('businessTools.batch.quantityLabel', 'Quantity')}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={batchForm.quantity}
                      onChange={(event) =>
                        setBatchForm((prev) => ({ ...prev, quantity: event.target.value }))
                      }
                      disabled={!canEdit()}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t('businessTools.batch.expiryLabel', 'Expiry date')}</Label>
                  <Input
                    type="date"
                    value={batchForm.expiresAt}
                    onChange={(event) =>
                      setBatchForm((prev) => ({ ...prev, expiresAt: event.target.value }))
                    }
                    disabled={!canEdit()}
                  />
                </div>
                <Button type="submit" disabled={!canEdit()}>
                  {t('businessTools.batch.add', 'Add Batch')}
                </Button>
              </form>

              <div className="space-y-2">
                {batches.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('businessTools.batch.empty', 'No batches yet.')}
                  </p>
                )}
                {batches.map((batch) => (
                  <div key={batch._id} className="rounded-md border p-3">
                    <p className="font-medium">{batch.batchCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('businessTools.batch.summary', 'Qty {{quantity}} - Exp {{date}}', {
                        quantity: batch.quantity,
                        date: new Date(batch.expiresAt).toLocaleDateString(),
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('businessTools.promo.title', 'Promo Bundles')}</CardTitle>
              <CardDescription>
                {t('businessTools.promo.description', 'Create campaigns and bundle baskets.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-3" onSubmit={handleCreatePromotion}>
                <div>
                  <Label>{t('businessTools.promo.campaignNameLabel', 'Campaign name')}</Label>
                  <Input
                    value={promotionForm.name}
                    onChange={(event) => setPromotionForm((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={!canEdit()}
                  />
                </div>
                <div>
                  <Label>{t('businessTools.promo.bundleProductsLabel', 'Bundle Products')}</Label>
                  <div className="mt-2 rounded-lg border p-3 space-y-3">
                    <Label className="text-xs text-muted-foreground">
                      {t('businessTools.promo.searchLabel', 'Search your stock products')}
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={promotionProductSearch}
                        onChange={(event) => setPromotionProductSearch(event.target.value)}
                        placeholder={t(
                          'businessTools.promo.searchPlaceholder',
                          'Search by name, SKU, or barcode'
                        )}
                        className="pl-9"
                        disabled={!canEdit()}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                      {filteredPromotionProducts.length === 0 && (
                        <p className="p-3 text-sm text-muted-foreground">
                          {t('businessTools.promo.noMatchingProducts', 'No matching products found.')}
                        </p>
                      )}
                      {filteredPromotionProducts.map((product) => {
                        const productId = String(product._id);
                        const isSelected = promotionForm.productIds.includes(productId);
                        return (
                          <button
                            key={productId}
                            type="button"
                            className="w-full p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-70"
                            onClick={() => handleAddPromotionProduct(productId)}
                            disabled={!canEdit() || isSelected}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {product.sku || '-'} -{' '}
                                  {t('businessTools.promo.available', 'Available: {{quantity}}', {
                                    quantity: product.quantity,
                                  })}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold">{formatCurrency(product.price)}</p>
                                <p className="text-xs text-emerald-600">
                                  {isSelected
                                    ? t('businessTools.promo.added', 'Added')
                                    : t('businessTools.promo.addItem', 'Add item')}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <Package className="h-3.5 w-3.5" />
                      {t('businessTools.promo.bundleItemsLabel', 'Bundle items')}
                    </Label>
                    {selectedPromotionProducts.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t('businessTools.promo.noBundleItems', 'No bundle items selected yet.')}
                      </p>
                    )}
                    {selectedPromotionProducts.map(({ product, quantity }) => (
                      <div
                        key={product._id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {product.sku || '-'} - {formatCurrency(product.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min="0.000001"
                            step="0.01"
                            value={promotionForm.productQuantities[String(product._id)] || String(quantity)}
                            onChange={(event) =>
                              handlePromotionProductQuantityChange(String(product._id), event.target.value)
                            }
                            className="h-8 w-20"
                            disabled={!canEdit()}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePromotionProduct(String(product._id))}
                            disabled={!canEdit()}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(
                      'businessTools.promo.selectedSummary',
                      '{{count}} product(s) selected - {{units}} total unit(s)',
                      {
                        count: promotionForm.productIds.length,
                        units: selectedPromotionUnits,
                      }
                    )}
                  </p>
                  {hasInvalidPromotionQuantities && (
                    <p className="mt-1 text-xs text-red-600">
                      {t(
                        'businessTools.promo.invalidQuantities',
                        'Each bundle item quantity must be greater than 0.'
                      )}
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>{t('businessTools.promo.bundlePriceLabel', 'Bundle price')}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={promotionForm.bundlePrice}
                      onChange={(event) =>
                        setPromotionForm((prev) => ({ ...prev, bundlePrice: event.target.value }))
                      }
                      disabled={!canEdit()}
                    />
                  </div>
                  <div>
                    <Label>{t('businessTools.promo.startsLabel', 'Starts')}</Label>
                    <Input
                      type="date"
                      value={promotionForm.startsAt}
                      onChange={(event) =>
                        setPromotionForm((prev) => ({ ...prev, startsAt: event.target.value }))
                      }
                      disabled={!canEdit()}
                    />
                  </div>
                  <div>
                    <Label>{t('businessTools.promo.endsLabel', 'Ends')}</Label>
                    <Input
                      type="date"
                      value={promotionForm.endsAt}
                      onChange={(event) =>
                        setPromotionForm((prev) => ({ ...prev, endsAt: event.target.value }))
                      }
                      disabled={!canEdit()}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={!canEdit() || promotionForm.productIds.length === 0 || hasInvalidPromotionQuantities}
                >
                  {t('businessTools.promo.create', 'Create Promotion')}
                </Button>
              </form>

              <div className="space-y-2">
                {promotions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('businessTools.promo.empty', 'No promotions yet.')}
                  </p>
                )}
                {promotions.map((promotion) => (
                  <div key={promotion._id} className="rounded-md border p-3">
                    {(() => {
                      const bundleItems = Array.isArray(promotion.bundleItems) ? promotion.bundleItems : [];
                      const bundleProductCount =
                        bundleItems.length > 0
                          ? bundleItems.length
                          : Array.isArray(promotion.productIds)
                            ? promotion.productIds.length
                            : 0;
                      const bundleUnits =
                        bundleItems.length > 0
                          ? bundleItems.reduce(
                              (sum, item) => sum + (Number(item.quantity) > 0 ? Number(item.quantity) : 0),
                              0
                            )
                          : bundleProductCount;
                      return (
                        <div className="mb-2 text-xs text-muted-foreground">
                          {t(
                            'businessTools.promo.bundleSummary',
                            '{{count}} product(s) - {{units}} total unit(s)',
                            { count: bundleProductCount, units: bundleUnits }
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{promotion.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(promotion.startsAt).toLocaleDateString()} -{' '}
                          {new Date(promotion.endsAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={promotion.isActive ? 'default' : 'secondary'}>
                        {promotion.isActive
                          ? t('common.active', 'Active')
                          : t('common.paused', 'Paused')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BusinessToolsPage;
