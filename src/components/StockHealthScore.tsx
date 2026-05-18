import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { actionCenterAPI } from '@/services/api';
import type { StockHealthScore as StockHealthScoreType } from '@/types';

const StockHealthScore: React.FC = () => {
  const { t } = useTranslation();
  const [health, setHealth] = useState<StockHealthScoreType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthScore();
  }, []);

  const fetchHealthScore = async () => {
    try {
      const response = await actionCenterAPI.getStockHealth();
      setHealth(response.data);
    } catch (error) {
      console.error('Error fetching stock health:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreIcon = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    if (percentage >= 60) return <TrendingUp className="w-6 h-6 text-yellow-500" />;
    if (percentage >= 40) return <AlertCircle className="w-6 h-6 text-orange-500" />;
    return <TrendingDown className="w-6 h-6 text-red-500" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            {t('stockHealth.title', 'Stock Health Score')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          {t('stockHealth.title', 'Stock Health Score')}
        </CardTitle>
        <CardDescription>
          {t('stockHealth.description', 'Overall health of your inventory management')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className={`w-32 h-32 rounded-full border-8 flex items-center justify-center ${getScoreBgColor(health.score, health.maxScore)} bg-opacity-10`}
            >
              <div className="text-center">
                <span className={`text-4xl font-bold ${getScoreColor(health.score, health.maxScore)}`}>
                  {health.score}
                </span>
                <span className="text-muted-foreground text-sm">/{health.maxScore}</span>
              </div>
            </motion.div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-lg">
              {getScoreIcon(health.score, health.maxScore)}
            </div>
          </div>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{t('stockHealth.dataCompleteness', 'Data Completeness')}</span>
              <span>{health.factors.dataCompleteness}%</span>
            </div>
            <Progress value={health.factors.dataCompleteness} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{t('stockHealth.stockLevels', 'Stock Levels')}</span>
              <span>{health.factors.lowStockIssues}%</span>
            </div>
            <Progress value={health.factors.lowStockIssues} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{t('stockHealth.deadStock', 'Dead Stock Management')}</span>
              <span>{health.factors.deadStockImpact}%</span>
            </div>
            <Progress value={health.factors.deadStockImpact} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{t('stockHealth.salesActivity', 'Sales Activity')}</span>
              <span>{health.factors.salesActivity}%</span>
            </div>
            <Progress value={health.factors.salesActivity} className="h-2" />
          </div>
        </div>

        {/* Suggestions */}
        {health.suggestions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm">
                {t('stockHealth.improvementTips', 'Improvement Tips')}
              </span>
            </div>
            <ul className="space-y-2">
              {health.suggestions.slice(0, 3).map((suggestion, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockHealthScore;
