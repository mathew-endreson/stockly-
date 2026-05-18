import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Lightbulb,
  Package,
  Users
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { aiInsightsAPI } from '@/services/api';
import { useLanguage } from '@/context/LanguageContext';
import type { AIInsight, AIInsightStatus, AIInsightType } from '@/types';

type AIInsightCardProps = {
  insight: AIInsight;
  onStatusChange?: (updatedInsight: AIInsight) => void;
};

const getInsightMeta = (type: AIInsightType) => {
  switch (type) {
    case 'PROFIT_MARGIN_WARNING':
      return {
        icon: AlertTriangle,
        accentClass: 'border-l-[#F2700F]',
        iconClass: 'text-[#F2700F]',
        label: 'Profit margin warning'
      };
    case 'CLIENT_CHURN_RISK':
      return {
        icon: Users,
        accentClass: 'border-l-[#F0162F]',
        iconClass: 'text-[#F0162F]',
        label: 'Client churn risk'
      };
    case 'UPSELL_OPPORTUNITY':
      return {
        icon: Lightbulb,
        accentClass: 'border-l-[#0A1DF5]',
        iconClass: 'text-[#0A1DF5]',
        label: 'Upsell opportunity'
      };
    case 'SLOW_MOVING_STOCK':
      return {
        icon: Package,
        accentClass: 'border-l-[#6B7280]',
        iconClass: 'text-[#6B7280]',
        label: 'Slow moving stock'
      };
    default:
      return {
        icon: AlertCircle,
        accentClass: 'border-l-slate-300 dark:border-l-slate-700',
        iconClass: 'text-muted-foreground',
        label: String(type || 'AI insight')
          .replace(/_/g, ' ')
          .toLowerCase()
      };
  }
};

const statusToneMap: Record<AIInsightStatus, string> = {
  new: 'bg-[#0A1DF5]/10 text-[#0A1DF5]',
  seen: 'bg-emerald-100 text-emerald-700',
  archived: 'bg-muted text-muted-foreground'
};

const formatStatusLabel = (status: AIInsightStatus) => {
  switch (status) {
    case 'new':
      return 'New';
    case 'seen':
      return 'Seen';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
};

const formatInsightLabel = (label: string) =>
  label
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const AIInsightCard: React.FC<AIInsightCardProps> = ({ insight, onStatusChange }) => {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const [currentInsight, setCurrentInsight] = useState(insight);
  const [updatingStatus, setUpdatingStatus] = useState<AIInsightStatus | null>(null);

  useEffect(() => {
    setCurrentInsight(insight);
  }, [insight]);

  const handleStatusUpdate = async (nextStatus: AIInsightStatus) => {
    if (nextStatus === currentInsight.status || updatingStatus) {
      return;
    }

    setUpdatingStatus(nextStatus);

    try {
      const response = await aiInsightsAPI.updateInsightStatus(currentInsight._id, nextStatus);
      const updatedInsight = response.data.insight;

      setCurrentInsight(updatedInsight);
      onStatusChange?.(updatedInsight);

      toast.success(
        nextStatus === 'archived'
          ? t('aiInsights.archived', 'Insight archived.')
          : t('aiInsights.markedSeen', 'Insight marked as seen.')
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t('aiInsights.updateFailed', 'Failed to update insight.'));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const meta = getInsightMeta(currentInsight.type);
  const InsightIcon = meta.icon;
  const createdAtLabel = new Date(currentInsight.createdAt).toLocaleDateString(
    language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }
  );

  return (
    <Card className={`rounded-md border-l-4 py-4 ${meta.accentClass}`}>
      <CardContent className="pt-0">
        <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
          <div className="mt-1 shrink-0">
            <InsightIcon className={`h-5 w-5 ${meta.iconClass}`} />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'justify-end' : ''}`}>
              <Badge className={`border-0 ${statusToneMap[currentInsight.status]}`}>
                {t(`aiInsights.status.${currentInsight.status}`, formatStatusLabel(currentInsight.status))}
              </Badge>
              <Badge variant="outline">{t('aiInsights.recommendationType', formatInsightLabel(meta.label))}</Badge>
              {currentInsight.entityType ? <Badge variant="outline">{currentInsight.entityType}</Badge> : null}
            </div>

            <p className="text-sm leading-6 text-foreground">{currentInsight.recommendation}</p>

            <div
              className={`flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between ${
                isRTL ? 'sm:flex-row-reverse' : ''
              }`}
            >
              <span>{t('aiInsights.generatedOn', 'Generated on {{date}}', { date: createdAtLabel })}</span>

              <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : ''}`}>
                {currentInsight.status === 'new' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate('seen')}
                    disabled={Boolean(updatingStatus)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t('aiInsights.markAsSeen', 'Mark as seen')}
                  </Button>
                ) : null}

                {currentInsight.status !== 'archived' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatusUpdate('archived')}
                    disabled={Boolean(updatingStatus)}
                  >
                    <Archive className="h-4 w-4" />
                    {t('aiInsights.archive', 'Archive')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIInsightCard;
