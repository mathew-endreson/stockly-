import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Zap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Tip {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  action?: string;
  actionLink?: string;
}

const TipsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const tips: Tip[] = [
    {
      id: 'barcode-scanning',
      icon: Zap,
      title: t('tips.barcodeScanning.title', 'Speed up with Barcode Scanning'),
      description: t('tips.barcodeScanning.description', 'Use the barcode scanner to quickly add products, update stock, or record sales in seconds.'),
      action: t('tips.barcodeScanning.action', 'Try it now'),
      actionLink: '/dashboard/inventory?action=scan',
    },
    {
      id: 'low-stock-alerts',
      icon: AlertCircle,
      title: t('tips.lowStockAlerts.title', 'Set Low Stock Alerts'),
      description: t('tips.lowStockAlerts.description', 'Configure minimum quantities for each product to get notified when stock runs low.'),
      action: t('tips.lowStockAlerts.action', 'Manage inventory'),
      actionLink: '/dashboard/inventory',
    },
    {
      id: 'profit-tracking',
      icon: TrendingUp,
      title: t('tips.profitTracking.title', 'Track Your Profits'),
      description: t('tips.profitTracking.description', 'Add cost information to products to see real profit margins and identify your most profitable items.'),
      action: t('tips.profitTracking.action', 'View analytics'),
      actionLink: '/dashboard/analytics',
    },
    {
      id: 'team-collaboration',
      icon: Users,
      title: t('tips.teamCollaboration.title', 'Invite Your Team'),
      description: t('tips.teamCollaboration.description', 'Add team members with different permission levels to help manage your inventory together.'),
      action: t('tips.teamCollaboration.action', 'Invite team'),
      actionLink: '/dashboard/users',
    },
    {
      id: 'quick-sell',
      icon: Package,
      title: t('tips.quickSell.title', 'Quick Sell from Inventory'),
      description: t('tips.quickSell.description', 'Record sales directly from the inventory page without navigating to the sales section.'),
      action: t('tips.quickSell.action', 'Go to inventory'),
      actionLink: '/dashboard/inventory',
    },
    {
      id: 'whatsapp-integration',
      icon: CheckCircle2,
      title: t('tips.whatsapp.title', 'Connect with WhatsApp'),
      description: t('tips.whatsapp.description', 'Send order updates to customers via WhatsApp for a better customer experience.'),
      action: t('tips.whatsapp.action', 'View orders'),
      actionLink: '/dashboard/ecommerce',
    },
    {
      id: 'categories',
      icon: BarChart3,
      title: t('tips.categories.title', 'Organize with Categories'),
      description: t('tips.categories.description', 'Group products into categories for better organization and easier reporting.'),
      action: t('tips.categories.action', 'Add products'),
      actionLink: '/dashboard/inventory?action=add',
    },
    {
      id: 'export-data',
      icon: Package,
      title: t('tips.exportData.title', 'Export Your Data'),
      description: t('tips.exportData.description', 'Export your inventory to CSV for backup, accounting, or analysis in other tools.'),
      action: t('tips.exportData.action', 'Export now'),
      actionLink: '/dashboard/inventory',
    },
  ];

  const visibleTips = tips.filter(tip => !dismissed.includes(tip.id));

  if (visibleTips.length === 0) {
    return null;
  }

  const currentTip = visibleTips[currentTipIndex % visibleTips.length];
  const Icon = currentTip.icon;

  const handleNext = () => {
    setCurrentTipIndex((prev) => (prev + 1) % visibleTips.length);
  };

  const handlePrev = () => {
    setCurrentTipIndex((prev) => (prev - 1 + visibleTips.length) % visibleTips.length);
  };

  const handleDismiss = () => {
    setDismissed((prev) => [...prev, currentTip.id]);
    if (currentTipIndex >= visibleTips.length - 1) {
      setCurrentTipIndex(0);
    }
  };

  return (
    <Card className="border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            {t('tips.title', 'Pro Tip')}
            <span className="text-xs text-muted-foreground ml-2">
              {currentTipIndex + 1} / {visibleTips.length}
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handlePrev}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTip.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">{currentTip.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentTip.description}
                </p>
                {currentTip.action && currentTip.actionLink && (
                  <a href={currentTip.actionLink}>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mt-2 text-xs"
                    >
                      {currentTip.action}
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default TipsPanel;
