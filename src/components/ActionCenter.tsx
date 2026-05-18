import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
} from 'lucide-react';
import {
  MdOutlineWarningAmber,
  MdInventory2,
  MdTrendingUp,
  MdErrorOutline,
  MdShoppingCart,
  MdOutlineAccessTime,
  MdCheckCircleOutline,
} from 'react-icons/md';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { actionCenterAPI, productsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import type { ActionItem } from '@/types';
import { Link } from 'react-router-dom';

const ActionCenter: React.FC = () => {
  const { t } = useTranslation();
  const { canManageEcommerce } = useAuth();
  const { isRTL } = useLanguage();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    try {
      const [prioritiesResponse, analyticsResponse] = await Promise.all([
        actionCenterAPI.getTodayPriorities(),
        productsAPI.getAnalytics(),
      ]);
      const nextActions = prioritiesResponse.data.priorities || [];
      const lossProducts = analyticsResponse.data.profitAnalytics?.productsSellingAtLoss || 0;

      if (lossProducts > 0) {
        nextActions.unshift({
          id: 'selling_at_loss',
          type: 'selling_at_loss',
          priority: 'high',
          title: t('profitAnalytics.sellingAtLoss', 'Selling at Loss'),
          description: t('profitAnalytics.lossProducts', '{{count}} products need attention', { count: lossProducts }),
          actionLabel: t('actionCenter.review', 'Review'),
          actionLink: '/dashboard/inventory?highlightSellingAtLoss=1',
        });
      }

      const filteredActions = nextActions.filter((action) => {
        if (!canManageEcommerce()) {
          if (action.type === 'pending_shipment') return false;
          if (action.actionLink?.startsWith('/dashboard/ecommerce')) return false;
        }
        return true;
      });

      setActions(filteredActions);
    } catch (error) {
      console.error('Error fetching actions:', error);
    } finally {
      setLoading(false);
    }
  }, [canManageEcommerce, t]);

  useEffect(() => {
    void fetchActions();

    const refresh = () => {
      void fetchActions();
    };
    const interval = window.setInterval(refresh, 20000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchActions]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-[#F0162F] text-white';
      case 'medium':
        return 'bg-[#F2700F] text-white';
      case 'low':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <MdOutlineWarningAmber className="w-5 h-5 text-orange-500" />;
      case 'pending_shipment':
        return <MdInventory2 className="w-5 h-5 text-blue-500" />;
      case 'fast_selling':
        return <MdTrendingUp className="w-5 h-5 text-green-500" />;
      case 'dead_stock':
        return <MdErrorOutline className="w-5 h-5 text-red-500" />;
      case 'reorder':
        return <MdShoppingCart className="w-5 h-5 text-purple-500" />;
      case 'selling_at_loss':
        return <MdOutlineWarningAmber className="w-5 h-5 text-red-500" />;
      case 'expiring_soon':
        return <MdOutlineAccessTime className="w-5 h-5 text-amber-500" />;
      default:
        return <MdErrorOutline className="w-5 h-5 text-gray-500" />;
    }
  };

  const localizePriority = (priority: string) =>
    t(`actionCenter.priority.${priority}`, priority);

  const localizeActionLabel = (action: ActionItem) => {
    const rawLabel = String(action.actionLabel || '').trim();
    if (action.type === 'pending_shipment' || /ship now/i.test(rawLabel)) {
      return t('actionCenter.shipNow', 'Ship Now');
    }
    if (action.type === 'low_stock' || action.type === 'reorder' || /restock/i.test(rawLabel)) {
      return t('actionCenter.restock', 'Restock');
    }
    if (action.type === 'expiring_soon') {
      return t('actionCenter.review', 'Review');
    }
    if (/review/i.test(rawLabel)) {
      return t('actionCenter.review', 'Review');
    }
    return rawLabel || t('actionCenter.view', 'View');
  };

  const localizeTitle = (action: ActionItem) => {
    const rawTitle = String(action.title || '').trim();

    const urgentOutOfStockMatch = rawTitle.match(
      /^urgent\s*:\s*(.+?)\s+is\s+out\s+of\s+stock$/i
    );
    if (urgentOutOfStockMatch) {
      return t(
        'actionCenter.outOfStockTitle',
        isRTL ? 'عاجل: {{product}} نفد من المخزون' : 'URGENT: {{product}} is out of stock',
        { product: urgentOutOfStockMatch[1].trim() }
      );
    }

    const outOfStockMatch = rawTitle.match(/^(.+?)\s+is\s+out\s+of\s+stock$/i);
    if (outOfStockMatch) {
      return t(
        'actionCenter.outOfStockTitle',
        isRTL ? 'عاجل: {{product}} نفد من المخزون' : 'URGENT: {{product}} is out of stock',
        { product: outOfStockMatch[1].trim() }
      );
    }

    const pendingMatch = rawTitle.match(/^Order\s*#(.+)\s+needs\s+shipping$/i);
    if (pendingMatch) {
      return t('actionCenter.pendingShipmentTitle', 'Order #{{order}} needs shipping', {
        order: pendingMatch[1],
      });
    }

    const lowStockMatch = rawTitle.match(/^(.+)\s+is\s+running\s+low$/i);
    if (lowStockMatch) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: lowStockMatch[1],
      });
    }

    const lowStockReverseMatch = rawTitle.match(/^is\s+running\s+low\s+(.+)$/i);
    if (lowStockReverseMatch) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: lowStockReverseMatch[1],
      });
    }

    const lowStockArabicPrefixMatch = rawTitle.match(/^منخفض\s+في\s+المخزون\s+(.+)$/i);
    if (lowStockArabicPrefixMatch) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: lowStockArabicPrefixMatch[1].trim(),
      });
    }

    if (action.type === 'low_stock' && action.productName) {
      return t('actionCenter.lowStockTitle', '{{product}} is running low', {
        product: action.productName,
      });
    }

    return rawTitle;
  };

  const localizeDescription = (action: ActionItem) => {
    const rawDescription = String(action.description || '').trim();

    if (/^restock\s+immediately\s+to\s+avoid\s+lost\s+sales\.?$/i.test(rawDescription)) {
      return t(
        'actionCenter.outOfStockDescription',
        isRTL
          ? 'أعد التخزين فوراً لتجنب فقدان المبيعات'
          : 'Restock immediately to avoid lost sales'
      );
    }

    const unitsLeftMatch = rawDescription.match(/^Only\s+(\d+(?:\.\d+)?)\s+units?\s+left\.?$/i);
    if (unitsLeftMatch) {
      return t(
        'actionCenter.unitsLeftDescription',
        isRTL ? 'لم يتبق سوى {{remaining}} وحدات' : 'Only {{remaining}} units left',
        { remaining: unitsLeftMatch[1] }
      );
    }

    const unitsRemainingMatch = rawDescription.match(
      /^Only\s+(\d+(?:\.\d+)?)\s+units?\s+remaining\.?$/i
    );
    if (unitsRemainingMatch) {
      return t(
        'actionCenter.unitsLeftDescription',
        isRTL ? 'لم يتبق سوى {{remaining}} وحدات' : 'Only {{remaining}} units left',
        { remaining: unitsRemainingMatch[1] }
      );
    }

    const stockMatch = rawDescription.match(
      /^Only\s+(\d+(?:\.\d+)?)\s+units?\s+remaining\.\s+Minimum\s+required:\s+(\d+(?:\.\d+)?)$/i
    );
    if (stockMatch) {
      return t('actionCenter.lowStockDescription', 'Only {{remaining}} units remaining. Minimum required: {{minimum}}', {
        remaining: stockMatch[1],
        minimum: stockMatch[2],
      });
    }

    const itemsForMatch = rawDescription.match(/^(\d+)\s+items?\s+for\s+(.+)$/i);
    if (itemsForMatch) {
      return t('actionCenter.itemsForDescription', '{{count}} items for {{customer}}', {
        count: Number(itemsForMatch[1]),
        customer: itemsForMatch[2],
      });
    }

    const itemsForReverseMatch = rawDescription.match(/^items?\s+for\s+(.+)\s+(\d+)$/i);
    if (itemsForReverseMatch) {
      return t('actionCenter.itemsForDescription', '{{count}} items for {{customer}}', {
        count: Number(itemsForReverseMatch[2]),
        customer: itemsForReverseMatch[1],
      });
    }

    return rawDescription;
  };

  const buildActionLink = (action: ActionItem) => {
    const [path, queryString] = action.actionLink.split('?');
    const params = new URLSearchParams(queryString || '');

    if (path.startsWith('/dashboard/inventory')) {
      if (action.productId && !params.has('highlightProductId')) {
        params.set('highlightProductId', action.productId);
      }
      if (!params.has('highlightPriority')) {
        params.set('highlightPriority', action.priority);
      }
    }

    if (path.startsWith('/dashboard/ecommerce')) {
      if (action.saleId && !params.has('highlightSaleId')) {
        params.set('highlightSaleId', action.saleId);
      }
      if (!params.has('highlightPriority')) {
        params.set('highlightPriority', action.priority);
      }
    }

    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
  };

  const highPriorityCount = actions.filter(a => a.priority === 'high').length;

  if (loading) {
    return (
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MdOutlineAccessTime className="w-5 h-5" />
            {t('actionCenter.title', "Today's Priorities")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-none animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MdCheckCircleOutline className="w-5 h-5 text-green-500" />
            {t('actionCenter.title', "Today's Priorities")}
          </CardTitle>
          <CardDescription>{t('actionCenter.allCaughtUp', "You're all caught up!")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MdCheckCircleOutline className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-muted-foreground">
              {t('actionCenter.noActions', 'No urgent actions needed. Great job managing your inventory!')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MdOutlineAccessTime className="w-5 h-5" />
              {t('actionCenter.title', "Today's Priorities")}
              {highPriorityCount > 0 && (
                <Badge variant="destructive" className={isRTL ? 'mr-2' : 'ml-2'}>
                  {isRTL ? (
                    <span className="inline-flex items-center gap-1">
                      <span dir="ltr">{highPriorityCount}</span>
                      <span>{t('actionCenter.urgent', 'urgent')}</span>
                    </span>
                  ) : (
                    `${highPriorityCount} ${t('actionCenter.urgent', 'urgent')}`
                  )}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t('actionCenter.description', 'Actions that need your attention today')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {actions.map((action, index) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-3 rounded-none border hover:bg-muted/50 transition-colors"
              >
                {isRTL ? (
                  <>
                    <Link to={buildActionLink(action)} className="shrink-0 w-32">
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        <span>{localizeActionLabel(action)}</span>
                        <ArrowRight className="w-4 h-4 rotate-180" />
                      </Button>
                    </Link>
                    <div className="w-20 shrink-0">
                      <Badge className={`w-full justify-center px-0 text-xs ${getPriorityColor(action.priority)}`}>
                        {localizePriority(action.priority)}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <span className="font-medium text-sm min-w-0 line-clamp-1 block mb-1">{localizeTitle(action)}</span>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {localizeDescription(action)}
                      </p>
                    </div>
                    <div className="mt-0.5">{getActionIcon(action.type)}</div>
                  </>
                ) : (
                  <>
                    <div className="mt-0.5">{getActionIcon(action.type)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm min-w-0 line-clamp-1 block mb-1">{localizeTitle(action)}</span>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {localizeDescription(action)}
                      </p>
                    </div>
                    <div className="w-20 shrink-0">
                      <Badge className={`w-full justify-center px-0 text-xs ${getPriorityColor(action.priority)}`}>
                        {localizePriority(action.priority)}
                      </Badge>
                    </div>
                    <Link to={buildActionLink(action)} className="shrink-0 w-32">
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        {localizeActionLabel(action)}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default ActionCenter;
