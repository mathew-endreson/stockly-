import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { businessAPI, expensesAPI, productsAPI, salesAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import type {
  Analytics,
  BusinessHighlightCard,
  ExpenseAnalytics,
  SalesAnalytics,
  ProductStockPrediction,
  PredictionConfidence
} from '@/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import ProfitAnalytics from '@/components/ProfitAnalytics';
import AlgeriaSalesMap from '@/components/AlgeriaSalesMap';

const COLORS = ['#001EF4', '#0E92F0', '#F2700F', '#BBF00F', '#10B981', '#F0162F', '#0A1DF5'];
const WALK_IN_CUSTOMER_ALIASES = new Set([
  'walk-in customer',
  'walk in customer',
  'عميل داخل المتجر',
  'client en magasin',
]);
const DATE_LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-DZ',
};

const REVENUE_ELIGIBLE_ORDER_STATUSES = new Set([
  'confirmed',
  'processing',
  'shipping',
  'delivered',
  'pending',
  'shipped',
]);

const REVENUE_ELIGIBLE_PAYMENT_STATUSES = new Set(['paid']);

type BestsellerView = 'product' | 'category';

const AnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, canViewAnalytics, canViewExpenses } = useAuth();
  const { language, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const canAccessInsights = canViewAnalytics();
  const isEcommerceBusiness = user?.businessType === 'ecommerce';
  const isRetailBusiness = user?.businessType === 'clothing_retail';
  const supportsShippingOperations = isEcommerceBusiness || isRetailBusiness;
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [stockPredictions, setStockPredictions] = useState<ProductStockPrediction[]>([]);
  const [ecommerceHighlights, setEcommerceHighlights] = useState<BusinessHighlightCard[]>([]);
  const [ecommerceOperationsLoading, setEcommerceOperationsLoading] = useState(false);
  const [ecommercePipeline, setEcommercePipeline] = useState({
    confirmed: 0,
    processing: 0,
    shipping: 0,
    delivered: 0
  });
  const [oldestOpenOrders, setOldestOpenOrders] = useState<
    Array<{ _id: string; orderNumber: string; status: string; createdAt: string; customer?: { name?: string } }>
  >([]);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weeklyRevenue, setWeeklyRevenue] = useState<{ date: string; label: string; revenue: number }[]>([]);
  const [_expenseAnalytics, setExpenseAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [geographicDistribution, setGeographicDistribution] = useState<SalesAnalytics['geographicDistribution']>([]);
  const [geographicLoading, setGeographicLoading] = useState(false);
  const [revenueRange, setRevenueRange] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [bestsellerView, setBestsellerView] = useState<BestsellerView>('product');
  const [recalculating, setRecalculating] = useState(false);
  const { formatCurrency } = useCurrencyFormatter();
  const dateLocale = DATE_LOCALE_BY_LANGUAGE[language] || DATE_LOCALE_BY_LANGUAGE.en;
  const revenueAxisColor = isDarkMode ? '#FCFCFC' : '#5E5E5E';
  const revenueGridColor = isDarkMode ? 'rgba(252,252,252,0.25)' : 'rgba(94,94,94,0.25)';
  const formatCustomerName = (
    orderLike: { customer?: { name?: string | null }; orderType?: string | null }
  ) => {
    const rawCustomerName = String(orderLike.customer?.name || '').trim();
    const normalizedCustomerName = rawCustomerName.toLowerCase();
    const isWalkInOrder = String(orderLike.orderType || '')
      .trim()
      .toLowerCase() === 'walk_in';

    if (WALK_IN_CUSTOMER_ALIASES.has(normalizedCustomerName) || (!rawCustomerName && isWalkInOrder)) {
      return t('ecommerce.walkInCustomer', 'Walk-in Customer');
    }

    return rawCustomerName || t('ecommerce.customer', 'Customer');
  };

  const fetchEcommerceOperations = useCallback(async () => {
    if (!canAccessInsights) {
      setEcommerceHighlights([]);
      setOldestOpenOrders([]);
      setEcommercePipeline({
        confirmed: 0,
        processing: 0,
        shipping: 0,
        delivered: 0
      });
      return;
    }
    if (!supportsShippingOperations) {
      setEcommerceHighlights([]);
      setOldestOpenOrders([]);
      setEcommercePipeline({
        confirmed: 0,
        processing: 0,
        shipping: 0,
        delivered: 0
      });
      return;
    }

    try {
      setEcommerceOperationsLoading(true);
      const [pipelineResponse, highlightsResponse] = await Promise.all([
        businessAPI.getEcommercePipeline(),
        businessAPI.getHighlights()
      ]);

      setEcommercePipeline(pipelineResponse.data.summary);
      setOldestOpenOrders(pipelineResponse.data.oldestOpenOrders || []);
      setEcommerceHighlights(highlightsResponse.data.cards || []);
    } catch (error) {
      console.error('Error fetching ecommerce operations:', error);
      setEcommerceHighlights([]);
      setOldestOpenOrders([]);
    } finally {
      setEcommerceOperationsLoading(false);
    }
  }, [canAccessInsights, supportsShippingOperations]);

  const fetchAnalytics = useCallback(async () => {
    if (!canAccessInsights) {
      setAnalytics(null);
      setStockPredictions([]);
      setLoading(false);
      setPredictionLoading(false);
      return;
    }
    try {
      const response = await productsAPI.getAnalytics();
      const analyticsData = response.data;
      setAnalytics(analyticsData);

      const lowStockProducts = analyticsData?.lowStock || [];
      if (lowStockProducts.length > 0) {
        const highestRiskProducts = [...lowStockProducts].sort((a, b) => {
          const aRatio = a.quantity / Math.max(1, a.minQuantity);
          const bRatio = b.quantity / Math.max(1, b.minQuantity);
          return aRatio - bRatio;
        }).slice(0, 3);

        setPredictionLoading(true);
        try {
          const predictions = (
            await Promise.all(
              highestRiskProducts.map(async (product) => {
                try {
                  const predictionResponse = await productsAPI.getStockPrediction(product._id, 60);
                  return predictionResponse.data;
                } catch {
                  return null;
                }
              })
            )
          ).filter(Boolean) as ProductStockPrediction[];

          setStockPredictions(predictions);
        } catch (predictionError) {
          console.error('Error fetching stock prediction:', predictionError);
          setStockPredictions([]);
        } finally {
          setPredictionLoading(false);
        }
      } else {
        setStockPredictions([]);
        setPredictionLoading(false);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [canAccessInsights]);

  const handleRecalculateAnalytics = async () => {
    try {
      setRecalculating(true);
      await productsAPI.recalculateAnalytics();
      await fetchAnalytics();
      await fetchWeeklyRevenue(revenueRange);
      await fetchGeographicDistribution();
      await fetchEcommerceOperations();
      await fetchExpenseAnalytics();
      window.dispatchEvent(new CustomEvent('stockly:analytics-refresh'));
    } catch (error) {
      console.error('Error recalculating analytics:', error);
    } finally {
      setRecalculating(false);
    }
  };

  const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

  const getRangeDates = (range: 'day' | 'week' | 'month') => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    if (range === 'day') {
      return { startDate: endDate, endDate };
    }
    if (range === 'week') {
      startDate.setDate(endDate.getDate() - 6);
      return { startDate, endDate };
    }
    startDate.setDate(endDate.getDate() - 29);
    return { startDate, endDate };
  };

  const fetchWeeklyRevenue = useCallback(async (range: 'day' | 'week' | 'month' | 'all') => {
    if (!canAccessInsights) {
      setWeeklyRevenue([]);
      return;
    }
    try {
      const rangeDates = range === 'all' ? null : getRangeDates(range);

      if (range === 'day') {
        const dayKey = rangeDates ? formatDateKey(rangeDates.startDate) : formatDateKey(new Date());
        const daySalesResponse = await salesAPI.getSales({
          page: 1,
          limit: 1000,
          startDate: dayKey,
          endDate: dayKey,
          sort: 'createdAt',
        });

        const daySales = (daySalesResponse.data.sales || []).filter((sale) => {
          const status = String(sale.status || '').toLowerCase();
          const paymentStatus = String(sale.paymentStatus || '').toLowerCase();
          return (
            REVENUE_ELIGIBLE_ORDER_STATUSES.has(status) &&
            REVENUE_ELIGIBLE_PAYMENT_STATUSES.has(paymentStatus)
          );
        });
        const hourlyRevenue = Array.from({ length: 24 }, (_, hour) => ({
          date: `${dayKey}T${String(hour).padStart(2, '0')}:00:00`,
          label: `${String(hour).padStart(2, '0')}:00`,
          revenue: 0,
        }));

        daySales.forEach((sale) => {
          const saleDate = new Date(sale.createdAt);
          const hour = saleDate.getHours();
          hourlyRevenue[hour].revenue += sale.total || 0;
        });

        setWeeklyRevenue(hourlyRevenue);
        return;
      }

      const salesAnalyticsResponse = await salesAPI.getAnalytics(
        rangeDates ? formatDateKey(rangeDates.startDate) : undefined,
        rangeDates ? formatDateKey(rangeDates.endDate) : undefined
      );

      const dailySales = salesAnalyticsResponse.data.dailySales || [];
      const revenueMap = new Map<string, number>();
      dailySales.forEach((entry) => {
        const dateKey = `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}-${String(entry._id.day).padStart(2, '0')}`;
        revenueMap.set(dateKey, entry.revenue || 0);
      });

      if (range === 'all') {
        const monthlyRevenueMap = new Map<string, number>();

        dailySales.forEach((entry) => {
          const monthKey = `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}`;
          monthlyRevenueMap.set(
            monthKey,
            (monthlyRevenueMap.get(monthKey) || 0) + (entry.revenue || 0)
          );
        });

        const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([monthKey, revenue]) => {
            const date = `${monthKey}-01`;
            return {
              date,
              label: new Date(`${date}T00:00:00`).toLocaleDateString(dateLocale, {
                month: 'short',
                year: 'numeric',
              }),
              revenue,
            };
          });

        setWeeklyRevenue(monthlyRevenue);
        return;
      }

      const { startDate } = rangeDates || getRangeDates(range);
      const days = range === 'week' ? 7 : 30;
      const rangeData: { date: string; label: string; revenue: number }[] = [];
      for (let i = 0; i < days; i += 1) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateKey = formatDateKey(currentDate);
        rangeData.push({
          date: dateKey,
          label:
            range === 'week'
              ? currentDate.toLocaleDateString(dateLocale, { weekday: 'short' })
              : currentDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' }),
          revenue: revenueMap.get(dateKey) || 0,
        });
      }

      setWeeklyRevenue(rangeData);
    } catch (error) {
      console.error('Error fetching sales insights:', error);
      setWeeklyRevenue([]);
    }
  }, [canAccessInsights, dateLocale]);

  const fetchGeographicDistribution = useCallback(async () => {
    if (!canAccessInsights) {
      setGeographicDistribution([]);
      return;
    }

    try {
      setGeographicLoading(true);
      const response = await salesAPI.getAnalytics();
      setGeographicDistribution(response.data.geographicDistribution || []);
    } catch (error) {
      console.error('Error fetching geographic distribution:', error);
      setGeographicDistribution([]);
    } finally {
      setGeographicLoading(false);
    }
  }, [canAccessInsights]);

  const fetchExpenseAnalytics = useCallback(async () => {
    if (!canAccessInsights || !canViewExpenses()) {
      setExpenseAnalytics(null);
      return;
    }

    try {
      const response = await expensesAPI.getAnalytics();
      setExpenseAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching expense analytics:', error);
      setExpenseAnalytics(null);
    }
  }, [canAccessInsights, canViewExpenses]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    void fetchEcommerceOperations();
  }, [fetchEcommerceOperations]);

  useEffect(() => {
    void fetchGeographicDistribution();
  }, [fetchGeographicDistribution]);

  useEffect(() => {
    void fetchExpenseAnalytics();
  }, [fetchExpenseAnalytics]);

  useEffect(() => {
    if (!canAccessInsights) return;
    void fetchWeeklyRevenue(revenueRange);
  }, [canAccessInsights, fetchWeeklyRevenue, revenueRange]);

  useEffect(() => {
    const handleAnalyticsRefresh = () => {
      void fetchAnalytics();
      void fetchWeeklyRevenue(revenueRange);
      void fetchGeographicDistribution();
      void fetchEcommerceOperations();
      void fetchExpenseAnalytics();
    };

    window.addEventListener('stockly:analytics-refresh', handleAnalyticsRefresh as EventListener);
    return () => {
      window.removeEventListener('stockly:analytics-refresh', handleAnalyticsRefresh as EventListener);
    };
  }, [
      fetchAnalytics,
      fetchExpenseAnalytics,
      fetchEcommerceOperations,
      fetchGeographicDistribution,
      fetchWeeklyRevenue,
    revenueRange
  ]);

  const getConfidenceBadgeVariant = (confidence: PredictionConfidence) => {
    if (confidence === 'low') return 'destructive';
    if (confidence === 'medium') return 'secondary';
    return 'default';
  };

  const getConfidenceLabel = (confidence: PredictionConfidence) =>
    t(`dashboard.lowStockPrediction.confidenceLevels.${confidence}`, confidence);

  const getLocalizedRecommendation = (recommendation: string) => {
    const normalized = recommendation.trim().toLowerCase();
    if (
      normalized.includes('no reliable confirmed sales history yet') &&
      normalized.includes('keep safety stock') &&
      normalized.includes('monitor daily')
    ) {
      return t(
        'dashboard.lowStockPrediction.noHistoryRecommendation',
        'No reliable confirmed sales history yet. Keep safety stock and monitor daily.'
      );
    }
    return recommendation;
  };


  // Prepare chart data
  const categoryData = analytics?.categoryDistribution.map((cat) => ({
    name: cat._id,
    products: cat.count,
    value: cat.value,
  })) || [];
  const totalCategoryProducts = categoryData.reduce((sum, category) => sum + category.products, 0);

  const rawBestsellerData =
    bestsellerView === 'category'
      ? analytics?.bestsellersByCategory || []
      : analytics?.bestsellers || [];

  const bestsellerData = rawBestsellerData.map((entry) => {
    const name = entry.name || t('analytics.uncategorized', 'Uncategorized');
    return {
      name: name.length > 28 ? `${name.substring(0, 28)}...` : name,
      sales: entry.salesCount,
      revenue: entry.revenue,
    };
  });

  const profit = (analytics?.overview?.totalStockValue || 0) - (analytics?.overview?.totalCostValue || 0);
  const profitMargin = analytics?.overview?.totalCostValue 
    ? (profit / analytics.overview.totalCostValue) * 100 
    : 0;
  const grossMargin = Number(analytics?.overview?.grossProfitMargin || 0);
  const totalStockValue = Number(analytics?.overview?.totalStockValue || 0);
  const totalCostValue = Number(analytics?.overview?.totalCostValue || 0);
  const valueToCostRatio = totalCostValue > 0 ? totalStockValue / totalCostValue : 0;
  const costShare = totalStockValue > 0 ? Math.min((totalCostValue / totalStockValue) * 100, 100) : 0;
  const profitShare = totalStockValue > 0 ? Math.min(Math.max((profit / totalStockValue) * 100, 0), 100) : 0;
  const totalSalesCount = analytics?.overview?.totalSales || 0;
  const averageOrderValue =
    totalSalesCount > 0 ? (analytics?.overview?.totalRevenue || 0) / totalSalesCount : 0;
  const hasShippedGeographyData = geographicDistribution.some(
    (entry) =>
      (Number(entry.orders) || 0) > 0 ||
      (Number(entry.itemsSold) || 0) > 0 ||
      (Number(entry.revenue) || 0) > 0
  );
  const shippingPipelineTotal =
    ecommercePipeline.confirmed +
    ecommercePipeline.processing +
    ecommercePipeline.shipping +
    ecommercePipeline.delivered;
  const shippingQueueCount = ecommercePipeline.confirmed + ecommercePipeline.processing;
  const inTransitCount = ecommercePipeline.processing + ecommercePipeline.shipping;
  const deliveredRate = shippingPipelineTotal > 0 ? (ecommercePipeline.delivered / shippingPipelineTotal) * 100 : 0;
  const inTransitRate = shippingPipelineTotal > 0 ? (inTransitCount / shippingPipelineTotal) * 100 : 0;
  const waitingRate = shippingPipelineTotal > 0 ? (shippingQueueCount / shippingPipelineTotal) * 100 : 0;
  const formatAgeToken = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return '0h';
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canAccessInsights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('common.analytics', 'Analytics')}</CardTitle>
          <CardDescription>
            {t('dashboard.insightsDisabled', 'Insights access is disabled for this workspace')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="page-shell">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">{t('analytics.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleRecalculateAnalytics}
          disabled={recalculating}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
          {t('analytics.recalculate', 'Recalculate')}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('analytics.totalProducts')}</p>
                <p className="text-xl font-bold leading-none">{analytics?.overview?.totalProducts || 0}</p>
              </div>
              <div className="w-8 h-8 bg-blue-500/10 rounded-md flex items-center justify-center">
                <Package className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('analytics.totalStockValue')}</p>
                <p className="text-xl font-bold leading-none">
                  {formatCurrency(analytics?.overview?.totalStockValue || 0)}
                </p>
              </div>
              <div className="w-8 h-8 bg-green-500/10 rounded-md flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('analytics.totalSales')}</p>
                <p className="text-xl font-bold leading-none">{analytics?.overview?.totalSales || 0}</p>
              </div>
              <div className="w-8 h-8 bg-[#BBF00F]/20 rounded-md flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-[#BBF00F]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">{t('analytics.totalRevenue')}</p>
                <p className="text-xl font-bold leading-none">
                  {formatCurrency(analytics?.overview?.totalRevenue || 0)}
                </p>
              </div>
              <div className="w-8 h-8 bg-orange-500/10 rounded-md flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex h-12 flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-none">
                  {t('analytics.averageOrderValue', 'Avg Order Value')}
                </p>
                <p className="text-xl font-bold leading-none">
                  {formatCurrency(averageOrderValue)}
                </p>
              </div>
              <div className="w-8 h-8 bg-cyan-500/10 rounded-md flex items-center justify-center">
                <Receipt className="w-4 h-4 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(supportsShippingOperations || hasShippedGeographyData) && (
        <div
          className={`grid gap-6 ${
            supportsShippingOperations ? 'xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : ''
          }`}
        >
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.geographicDistribution', 'Geographic Distribution')}</CardTitle>
              <CardDescription>
                {t(
                  'analytics.geographicDistributionDesc',
                  'Hover any wilaya to see shipped items sold and revenue.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {geographicLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span>{t('analytics.loading', 'Loading...')}</span>
                </div>
              ) : (
                <AlgeriaSalesMap
                  distribution={geographicDistribution}
                  formatCurrency={formatCurrency}
                />
              )}
            </CardContent>
          </Card>

          {supportsShippingOperations && (
            isEcommerceBusiness ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.ecommerceOperations', 'E-commerce Operations')}</CardTitle>
                  <CardDescription>{t('analytics.ecommerceOperationsDesc', 'Shipping pipeline and fulfillment risk monitoring.')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ecommerceOperationsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                      <span>{t('analytics.loadingEcommerceOperations', 'Loading e-commerce operations...')}</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">{t('status.confirmed', 'Confirmed')}</p>
                          <p className="text-2xl font-semibold">{ecommercePipeline.confirmed}</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">{t('status.processing', 'Processing')}</p>
                          <p className="text-2xl font-semibold">{ecommercePipeline.processing}</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">{t('status.shipping', 'Shipping')}</p>
                          <p className="text-2xl font-semibold">{ecommercePipeline.shipping}</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-3">
                          <p className="text-sm text-muted-foreground">{t('status.delivered', 'Delivered')}</p>
                          <p className="text-2xl font-semibold">{ecommercePipeline.delivered}</p>
                        </div>
                      </div>

                      {ecommerceHighlights.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {ecommerceHighlights.map((card) => (
                            <div key={card.id} className="rounded-md border p-3">
                              <p className="text-sm text-muted-foreground">{card.title}</p>
                              <p className="text-xl font-semibold">{card.value}</p>
                              <p className="text-sm text-muted-foreground">{card.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{t('analytics.oldestOpenOrders', 'Oldest Open Orders')}</p>
                        {oldestOpenOrders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('analytics.noDelayedOrders', 'No delayed orders right now.')}</p>
                        ) : (
                          oldestOpenOrders.map((order) => (
                            <div
                              key={order._id}
                              className="flex items-center justify-between rounded-md border p-3"
                            >
                              <div>
                                <p className="font-medium">{order.orderNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatCustomerName(order)} -{' '}
                                  {new Date(order.createdAt).toLocaleDateString(dateLocale)}
                                </p>
                              </div>
                              <Badge>{t(`status.${String(order.status || '').toLowerCase()}`, order.status)}</Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t('analytics.shippingOperations', 'Shipping Operations')}</CardTitle>
                  <CardDescription>
                    {t(
                      'analytics.shippingOperationsDesc',
                      'Track your paid shipped orders pipeline and queue.'
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ecommerceOperationsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                      <span>{t('analytics.loadingShippingOperations', 'Loading shipping operations...')}</span>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-md border bg-gradient-to-br from-sky-50 via-white to-white p-4 dark:from-slate-950/40 dark:via-slate-950/10 dark:to-slate-950/10">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t('analytics.shippingPipeline', 'Shipping pipeline')}
                            </p>
                            <p className="mt-1 text-2xl font-semibold">{shippingPipelineTotal}</p>
                            <p className="text-sm text-muted-foreground">
                              {t('analytics.paidShipmentsInPipeline', 'Paid shipped orders in pipeline')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Badge variant={shippingQueueCount > 0 ? 'secondary' : 'outline'}>
                              {t('analytics.waitingToShip', 'Waiting to ship')}: {shippingQueueCount}
                            </Badge>
                            <Badge variant="outline">
                              {t('status.shipping', 'Shipping')}: {ecommercePipeline.shipping}
                            </Badge>
                            <Badge variant="outline">
                              {t('status.delivered', 'Delivered')}: {ecommercePipeline.delivered}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Package className="h-4 w-4" />
                                <span>{t('status.confirmed', 'Confirmed')}</span>
                              </div>
                              <span className="font-semibold">{ecommercePipeline.confirmed}</span>
                            </div>
                            <Progress
                              value={shippingPipelineTotal > 0 ? (ecommercePipeline.confirmed / shippingPipelineTotal) * 100 : 0}
                              className="h-2"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <RefreshCw className="h-4 w-4" />
                                <span>{t('status.processing', 'Processing')}</span>
                              </div>
                              <span className="font-semibold">{ecommercePipeline.processing}</span>
                            </div>
                            <Progress
                              value={shippingPipelineTotal > 0 ? (ecommercePipeline.processing / shippingPipelineTotal) * 100 : 0}
                              className="h-2"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Truck className="h-4 w-4" />
                                <span>{t('status.shipping', 'Shipping')}</span>
                              </div>
                              <span className="font-semibold">{ecommercePipeline.shipping}</span>
                            </div>
                            <Progress
                              value={shippingPipelineTotal > 0 ? (ecommercePipeline.shipping / shippingPipelineTotal) * 100 : 0}
                              className="h-2"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{t('status.delivered', 'Delivered')}</span>
                              </div>
                              <span className="font-semibold">{ecommercePipeline.delivered}</span>
                            </div>
                            <Progress
                              value={shippingPipelineTotal > 0 ? (ecommercePipeline.delivered / shippingPipelineTotal) * 100 : 0}
                              className="h-2"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold">{t('analytics.oldestOpenOrders', 'Oldest Open Orders')}</p>
                          <Badge variant={shippingQueueCount > 0 ? 'secondary' : 'outline'}>
                            {t('analytics.queue', 'Queue')}: {shippingQueueCount}
                          </Badge>
                        </div>

                        {oldestOpenOrders.length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t('analytics.noDelayedOrders', 'No delayed orders right now.')}
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {oldestOpenOrders.map((order) => (
                              <div
                                key={order._id}
                                className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{order.orderNumber}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {formatCustomerName(order)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <Badge variant="outline">
                                    {t(`status.${String(order.status || '').toLowerCase()}`, order.status)}
                                  </Badge>
                                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatAgeToken(order.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('analytics.pipelineHealth', 'Pipeline Health')}
                          </p>
                          <Badge variant="outline">{shippingPipelineTotal}</Badge>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-md bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">{t('analytics.waitingToShip', 'Waiting to ship')}</p>
                            <p className="text-sm font-semibold">{shippingQueueCount}</p>
                            <p className="text-[11px] text-muted-foreground">{waitingRate.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-md bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">{t('analytics.inTransit', 'In transit')}</p>
                            <p className="text-sm font-semibold">{inTransitCount}</p>
                            <p className="text-[11px] text-muted-foreground">{inTransitRate.toFixed(1)}%</p>
                          </div>
                          <div className="rounded-md bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">{t('status.delivered', 'Delivered')}</p>
                            <p className="text-sm font-semibold">{ecommercePipeline.delivered}</p>
                            <p className="text-[11px] text-muted-foreground">{deliveredRate.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.categoryDistribution')}</CardTitle>
            <CardDescription>{t('analytics.productsAndValueByCategory', 'Products and value by category')}</CardDescription>
          </CardHeader>
          <CardContent className="table-responsive">
            <div className="h-80 min-w-[540px]" dir="ltr">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ top: 8, right: 28, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={revenueGridColor} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: revenueAxisColor }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: revenueAxisColor }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={96}
                      tickFormatter={(value) => Number(value).toLocaleString(dateLocale)}
                      tick={{ fill: revenueAxisColor }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'value') return formatCurrency(value);
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="products" fill="#10B981" name={t('analytics.productsLabel', 'Products')} />
                    <Bar yAxisId="right" dataKey="value" fill="#BBF00F" name={t('analytics.valueLabel', 'Value')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('analytics.noCategoryData', 'No category data available')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bestsellers Chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t('analytics.bestsellers')}</CardTitle>
                <CardDescription>
                  {bestsellerView === 'category'
                    ? t('analytics.topCategoriesByRevenue', 'Top selling categories by revenue')
                    : t('analytics.topSellingByRevenue', 'Top selling products by revenue')}
                </CardDescription>
              </div>
              <Select
                value={bestsellerView}
                onValueChange={(value) => setBestsellerView(value as BestsellerView)}
              >
                <SelectTrigger
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`w-full sm:w-[190px] ${
                    isRTL
                      ? 'flex-row-reverse text-right [&_[data-slot=select-value]]:justify-end [&_[data-slot=select-value]]:text-right'
                      : ''
                  }`}
                >
                  <SelectValue placeholder={t('analytics.groupBy', 'Group by')} />
                </SelectTrigger>
                <SelectContent dir={isRTL ? 'rtl' : 'ltr'} align={isRTL ? 'start' : 'end'}>
                  <SelectItem value="product" className={isRTL ? 'text-right' : ''}>
                    {t('analytics.byProduct', 'By product')}
                  </SelectItem>
                  <SelectItem value="category" className={isRTL ? 'text-right' : ''}>
                    {t('analytics.byCategory', 'By category')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="table-responsive">
            <div className="h-80 min-w-[560px]" dir="ltr">
              {bestsellerData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bestsellerData}
                    layout="vertical"
                    margin={{ top: 8, right: 12, left: 24, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={revenueGridColor} />
                    <XAxis
                      type="number"
                      tick={{ fill: revenueAxisColor }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={180}
                      interval={0}
                      tickMargin={8}
                      tick={{ fill: revenueAxisColor, fontSize: 13 }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10B981" name={t('analytics.totalRevenue', 'Revenue')} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('analytics.noSalesData', 'No sales data available')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics.categoryBreakdown', 'Category Breakdown')}</CardTitle>
            <CardDescription>{t('analytics.distributionByProductCount', 'Distribution by product count')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4" dir="ltr">
              <div className="h-56">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        innerRadius={44}
                        fill="#495FFA"
                        dataKey="products"
                      >
                        {categoryData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {t('common.noData', 'No data available')}
                  </div>
                )}
              </div>
              {categoryData.length > 0 && (
                <div className="flex flex-wrap gap-2" dir={isRTL ? 'rtl' : 'ltr'}>
                  {categoryData.map((entry, index) => {
                    const percentage = totalCategoryProducts
                      ? Math.round((entry.products / totalCategoryProducts) * 100)
                      : 0;
                    return (
                      <div
                        key={entry.name}
                        className="inline-flex items-center gap-2 rounded-full border bg-muted/30 px-3 py-1 text-xs font-medium"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="max-w-[9rem] truncate">{entry.name}</span>
                        <span className="text-muted-foreground">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profit Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('analytics.profitOverview', 'Profit Overview')}</CardTitle>
            <CardDescription>{t('analytics.stockValueVsCost', 'Stock value vs cost analysis')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('analytics.totalCost', 'Total Cost')}</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(analytics?.overview?.totalCostValue || 0)}
                  </p>
                </div>
                <div className="rounded-md bg-muted p-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('analytics.stockValue', 'Stock Value')}</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(analytics?.overview?.totalStockValue || 0)}
                  </p>
                </div>
                <div className="rounded-md bg-green-50 p-4 text-center dark:bg-green-900/20">
                  <p className="text-sm text-muted-foreground">{t('analytics.potentialProfit', 'Potential Profit')}</p>
                  <p className="text-xl font-bold text-emerald-500">
                    {formatCurrency(profit)}
                  </p>
                </div>
              </div>

              <div>
                <div dir={isRTL ? 'rtl' : 'ltr'} className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-[#10B981]">{t('analytics.profitMargin', 'Profit Margin')}</span>
                  <span className="text-sm font-medium text-[#10B981]">{profitMargin.toFixed(1)}%</span>
                </div>
                <Progress
                  value={Math.min(profitMargin, 100)}
                  className="h-3 bg-[#10B981]/20 dark:bg-[#10B981]/25 [&>[data-slot=progress-indicator]]:bg-[#10B981]"
                />
              </div>

              <div>
                <div dir={isRTL ? 'rtl' : 'ltr'} className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-[#0E8A33]">{t('analytics.grossMargin', 'Gross Margin')}</span>
                  <span className="text-sm font-medium text-[#0E8A33]">{grossMargin.toFixed(1)}%</span>
                </div>
                <Progress
                  value={Math.min(Math.max(grossMargin, 0), 100)}
                  className="h-3 bg-[#BBF00F]/25 dark:bg-[#BBF00F]/20 [&>[data-slot=progress-indicator]]:bg-[#BBF00F]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('analytics.averageProductValue', 'Average Product Value')}</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      (analytics?.overview?.totalStockValue || 0) / 
                      (analytics?.overview?.totalProducts || 1)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('analytics.totalItemsInStock', 'Total Items in Stock')}</p>
                  <p className="text-lg font-semibold">
                    {analytics?.overview?.totalQuantity || 0} {t('analytics.units', 'units')}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{t('analytics.profitabilityMix', 'Profitability Mix')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('analytics.valueToCostRatio', 'Value/Cost Ratio')}:{' '}
                    <span className="font-semibold text-foreground">{valueToCostRatio.toFixed(2)}x</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <div dir={isRTL ? 'rtl' : 'ltr'} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('analytics.costShare', 'Cost Share')}</span>
                    <span className="font-medium">{costShare.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={costShare}
                    className="h-2 bg-[#BBF00F]/20 dark:bg-[#BBF00F]/15 [&>[data-slot=progress-indicator]]:bg-[#BBF00F]"
                  />
                </div>

                <div className="space-y-2">
                  <div dir={isRTL ? 'rtl' : 'ltr'} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('analytics.profitShare', 'Profit Share')}</span>
                    <span className="font-medium">{profitShare.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={profitShare}
                    className="h-2 bg-[#10B981]/20 dark:bg-[#10B981]/15 [&>[data-slot=progress-indicator]]:bg-[#10B981]"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Revenue & Profit Analytics */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] items-start">
        <Card className="h-full">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t('analytics.weeklyRevenue', 'Revenue')}</CardTitle>
                <CardDescription>{t('analytics.weeklyRevenueDesc', 'Revenue over time')}</CardDescription>
              </div>
              <Select value={revenueRange} onValueChange={(value) => setRevenueRange(value as 'day' | 'week' | 'month' | 'all')}>
                <SelectTrigger
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`w-full sm:w-[160px] ${
                    isRTL
                      ? 'flex-row-reverse text-right [&_[data-slot=select-value]]:justify-end [&_[data-slot=select-value]]:text-right'
                      : ''
                  }`}
                >
                  <SelectValue placeholder={t('analytics.rangeLabel', 'Range')} />
                </SelectTrigger>
                <SelectContent dir={isRTL ? 'rtl' : 'ltr'} align={isRTL ? 'start' : 'end'}>
                  <SelectItem value="day" className={isRTL ? 'text-right' : ''}>{t('analytics.range.day', 'Day')}</SelectItem>
                  <SelectItem value="week" className={isRTL ? 'text-right' : ''}>{t('analytics.range.week', 'Week')}</SelectItem>
                  <SelectItem value="month" className={isRTL ? 'text-right' : ''}>{t('analytics.range.month', 'Month')}</SelectItem>
                  <SelectItem value="all" className={isRTL ? 'text-right' : ''}>{t('analytics.range.all', 'All time')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-full table-responsive">
            <div className="h-[420px] min-w-[560px]" dir="ltr">
              {weeklyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke={revenueGridColor} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: revenueAxisColor }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <YAxis
                      tick={{ fill: revenueAxisColor }}
                      axisLine={{ stroke: revenueAxisColor }}
                      tickLine={{ stroke: revenueAxisColor }}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={
                        isDarkMode
                          ? { backgroundColor: '#333333', border: '1px solid #6F6F6F', color: '#FCFCFC' }
                          : undefined
                      }
                      labelStyle={isDarkMode ? { color: '#FCFCFC' } : undefined}
                      itemStyle={isDarkMode ? { color: '#FCFCFC' } : undefined}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#10B981', stroke: '#10B981' }}
                      activeDot={{ r: 6, fill: '#10B981', stroke: '#10B981' }}
                      name={t('analytics.totalRevenue', 'Revenue')}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {t('analytics.noWeeklyRevenue', 'No revenue data available')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-6">
          <ProfitAnalytics />
        </div>
      </div>

      {/* Low Stock Prediction */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {t('dashboard.lowStockPrediction.title', 'Low Stock Prediction')}
            </CardTitle>
            {stockPredictions.length > 0 && (
              <Badge variant="secondary">
                {stockPredictions.length}
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            {t(
              'dashboard.lowStockPrediction.description',
              'AI-assisted estimate of when your most at-risk product may run out.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {predictionLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>{t('dashboard.lowStockPrediction.loading', 'Calculating prediction...')}</span>
            </div>
          ) : stockPredictions.length > 0 ? (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {stockPredictions.map((stockPrediction) => (
                <div key={stockPrediction.productId} className="rounded-md border bg-card px-3 py-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{stockPrediction.productName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t('dashboard.lowStockPrediction.runOutDate', 'Estimated run-out date')}:{' '}
                        {stockPrediction.prediction.estimatedRunOutDate
                          ? new Date(stockPrediction.prediction.estimatedRunOutDate).toLocaleDateString(dateLocale)
                          : t('dashboard.lowStockPrediction.unknown', 'Unknown')}
                      </p>
                    </div>

                    <div className={`flex flex-wrap items-center gap-1.5 text-[11px] ${isRTL ? 'sm:justify-start' : 'sm:justify-end'}`}>
                      <span className="rounded bg-muted px-2 py-1">
                        {t('dashboard.lowStockPrediction.currentStock', 'Current stock')}:{' '}
                        <strong>{stockPrediction.prediction.currentStock}</strong>
                      </span>
                      <span className="rounded bg-muted px-2 py-1">
                        {t('dashboard.lowStockPrediction.suggestedReorder', 'Suggested reorder')}:{' '}
                        <strong>{stockPrediction.prediction.suggestedReorderQuantity}</strong>
                      </span>
                      <span className="rounded bg-muted px-2 py-1">
                        {t('dashboard.lowStockPrediction.avgDailyConsumption', 'Avg daily consumption')}:{' '}
                        <strong>{stockPrediction.prediction.averageDailyConsumption}</strong>
                      </span>
                      <span className="rounded bg-muted px-2 py-1">
                        {t('dashboard.lowStockPrediction.daysRemaining', 'Estimated days remaining')}:{' '}
                        <strong>{stockPrediction.prediction.estimatedDaysRemaining ?? t('common.notAvailable', 'N/A')}</strong>
                      </span>
                      <Badge
                        variant={getConfidenceBadgeVariant(stockPrediction.prediction.confidence)}
                        className="h-6"
                      >
                        {getConfidenceLabel(stockPrediction.prediction.confidence)}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-1 text-[11px] text-muted-foreground truncate">
                    {getLocalizedRecommendation(stockPrediction.prediction.recommendation)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                'dashboard.lowStockPrediction.empty',
                'No low-stock products right now. A prediction will appear automatically when risk is detected.'
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;


