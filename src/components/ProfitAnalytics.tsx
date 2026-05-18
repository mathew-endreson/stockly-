import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { expensesAPI, productsAPI, salesAPI } from '@/services/api';
import type { Analytics, ExpenseAnalytics, SalesAnalytics } from '@/types';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

const ProfitAnalytics: React.FC = () => {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [expenseAnalytics, setExpenseAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useCurrencyFormatter();
  const { isRTL } = useLanguage();
  const { canViewExpenses } = useAuth();

  const fetchAnalytics = useCallback(async () => {
    try {
      const [productsRes, salesRes, expensesRes] = await Promise.all([
        productsAPI.getAnalytics({ t: Date.now() }),
        salesAPI.getAnalytics(),
        canViewExpenses() ? expensesAPI.getAnalytics() : Promise.resolve(null),
      ]);
      setAnalytics(productsRes.data);
      setSalesAnalytics(salesRes.data);
      setExpenseAnalytics(expensesRes?.data || null);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [canViewExpenses]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const handleRefresh = () => {
      void fetchAnalytics();
    };

    window.addEventListener('stockly:analytics-refresh', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('stockly:analytics-refresh', handleRefresh as EventListener);
    };
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('profitAnalytics.title', 'Profit Analytics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const toNumber = (value: unknown) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value === 'object' && 'value' in value) {
      const parsed = Number.parseFloat(String((value as { value?: unknown }).value));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const profitData = analytics?.profitAnalytics;
  const mostProfitable = profitData?.mostProfitableProduct;
  const mostProfitableProfit = toNumber(
    mostProfitable?.profit ?? (mostProfitable as { totalProfit?: unknown } | undefined)?.totalProfit
  );
  const mostProfitableMargin = toNumber(mostProfitable?.profitMargin);
  const lossProducts = profitData?.productsSellingAtLoss || 0;

  const formatPercent = (value: unknown) => `${toNumber(value).toFixed(1)}%`;

  const grossProfit = toNumber(salesAnalytics?.overview?.totalProfit);
  const profitMargin = toNumber(salesAnalytics?.overview?.profitMargin);
  const paidExpenses = toNumber(expenseAnalytics?.overview?.totalPaid);
  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth() + 1;
  const todayDay = todayDate.getDate();
  const dailySales = salesAnalytics?.dailySales || [];
  const todayProfit = dailySales
    .filter((entry) =>
      entry._id.year === todayYear &&
      entry._id.month === todayMonth &&
      entry._id.day === todayDay
    )
    .reduce((sum, entry) => sum + toNumber(entry.profit), 0);
  const monthProfit = dailySales
    .filter((entry) =>
      entry._id.year === todayYear &&
      entry._id.month === todayMonth
    )
    .reduce((sum, entry) => sum + toNumber(entry.profit), 0);
  const monthNetAfterExpenses = monthProfit - paidExpenses;
  const reorderSuggestions = analytics?.actionCenter?.reorderSuggestions || [];
  const reorderHighlightProductIds = Array.from(
    new Set(
      reorderSuggestions
        .map((suggestion) => String(suggestion.productId || '').trim())
        .filter(Boolean)
    )
  );
  const reorderInventoryLink =
    reorderHighlightProductIds.length > 0
      ? `/dashboard/inventory?highlightProductIds=${encodeURIComponent(reorderHighlightProductIds.join(','))}`
      : '/dashboard/inventory';
  const lossInventoryLink = '/dashboard/inventory?highlightSellingAtLoss=1';
  const mostProfitableProductId = String(mostProfitable?._id || '').trim();
  const mostProfitableInventoryLink = mostProfitableProductId
    ? `/dashboard/inventory?highlightProductId=${encodeURIComponent(mostProfitableProductId)}&highlightPriority=low`
    : '';

  const statCards = [
    {
      label: t('profitAnalytics.todayProfit', "Today's Profit"),
      value: formatCurrency(todayProfit),
      icon: DollarSign,
      trend: todayProfit >= 0 ? 'up' : 'down',
      color: todayProfit >= 0 ? 'text-[#0018C3]' : 'text-red-500',
      bgColor: todayProfit >= 0 ? 'bg-[#0018C3]/10' : 'bg-red-500/10',
    },
    {
      label: t('profitAnalytics.grossProfit', 'Gross Profit'),
      value: formatCurrency(grossProfit),
      icon: TrendingUp,
      trend: 'up',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: t('profitAnalytics.profitMargin', 'Profit Margin'),
      value: formatPercent(salesAnalytics?.overview?.profitMargin),
      icon: BarChart3,
      trend: profitMargin >= 30 ? 'up' : 'down',
      color: profitMargin >= 30 ? 'text-green-500' : 'text-orange-500',
      bgColor: profitMargin >= 30 ? 'bg-green-500/10' : 'bg-orange-500/10',
    },
    {
      label: t('profitAnalytics.netAfterExpenses', 'Net This Month'),
      value: formatCurrency(monthNetAfterExpenses),
      icon: TrendingUp,
      trend: monthNetAfterExpenses >= 0 ? 'up' : 'down',
      color: monthNetAfterExpenses >= 0 ? 'text-blue-500' : 'text-red-500',
      bgColor: monthNetAfterExpenses >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          {t('profitAnalytics.title', 'Profit Analytics')}
        </CardTitle>
        <CardDescription>
          {t('profitAnalytics.description', 'Track your profitability and margins')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg ${stat.bgColor}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Insights */}
        <div className="space-y-3">
          {/* Most Profitable Product */}
          {mostProfitable && (
            mostProfitableInventoryLink ? (
              <Link className="block" to={mostProfitableInventoryLink}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{t('profitAnalytics.mostProfitable', 'Most Profitable')}</p>
                    <p className="text-sm">{mostProfitable.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(mostProfitableProfit)}</p>
                    <p className="text-xs text-green-600">{formatPercent(mostProfitableMargin)} margin</p>
                  </div>
                </motion.div>
              </Link>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
              >
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{t('profitAnalytics.mostProfitable', 'Most Profitable')}</p>
                  <p className="text-sm">{mostProfitable.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(mostProfitableProfit)}</p>
                  <p className="text-xs text-green-600">{formatPercent(mostProfitableMargin)} margin</p>
                </div>
              </motion.div>
            )
          )}

          {/* Products at Loss */}
          {lossProducts > 0 && (
            <Link className="block" to={lossInventoryLink}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{t('profitAnalytics.sellingAtLoss', 'Selling at Loss')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('profitAnalytics.lossProducts', '{{count}} products need attention', { count: lossProducts })}
                  </p>
                </div>
              </motion.div>
            </Link>
          )}

          {/* Dead Stock Insight */}
          {toNumber(analytics?.actionCenter?.deadStockValue) > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className={`flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                <p className="font-medium text-sm">{t('profitAnalytics.deadStock', 'Dead Stock')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('profitAnalytics.deadStockValue', '{{value}} not sold in 60 days', {
                    value: formatCurrency(toNumber(analytics?.actionCenter?.deadStockValue)),
                  })}
                </p>
              </div>
            </motion.div>
          )}

          {/* Reorder Suggestions */}
          {reorderSuggestions.length > 0 && (
            <Link className="block" to={reorderInventoryLink}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className={`flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5 text-white" />
                </div>
                <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                  <p className="font-medium text-sm">{t('profitAnalytics.reorderSuggested', 'Reorder Suggested')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('profitAnalytics.reorderItems', '{{count}} items need restocking', {
                      count: reorderSuggestions.length,
                    })}
                  </p>
                </div>
              </motion.div>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitAnalytics;
