import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Lock,
  Sparkles,
  ArrowRight,
  Zap,
  Users,
  Download,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getRequiredPlanForFeature,
  getWorkspacePlanId,
  hasPlanFeature,
  type SubscriptionFeatureKey
} from '@/lib/subscriptionPlans';

interface SubscriptionLockProps {
  feature: string;
  requiredPlan?: string;
  description?: string;
  children?: React.ReactNode;
}

const featureDetails: Record<string, { icon: React.ElementType; title: string; description: string }> = {
  invoicing: {
    icon: Sparkles,
    title: 'Invoicing System',
    description: 'Upgrade to create and manage invoices in this workspace',
  },
  expenses: {
    icon: Sparkles,
    title: 'Expenses System',
    description: 'Upgrade to track expenses, reimbursements, and approvals',
  },
  distributors: {
    icon: Sparkles,
    title: 'Distributor System',
    description: 'Upgrade to manage distributors and supplier purchases',
  },
  surveillance: {
    icon: Sparkles,
    title: 'Surveillance System',
    description: 'Upgrade to see team login activity and surveillance insights',
  },
  export: {
    icon: Download,
    title: 'Export Data',
    description: 'Export your inventory and sales data to CSV or Excel',
  },
  team: {
    icon: Users,
    title: 'Team Members',
    description: 'Invite more team members to collaborate',
  },
  analytics: {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Unlock profit analytics and detailed insights',
  },
  whatsapp: {
    icon: Zap,
    title: 'WhatsApp Integration',
    description: 'Send order updates via WhatsApp',
  },
  default: {
    icon: Sparkles,
    title: 'Premium Feature',
    description: 'Upgrade to unlock this feature',
  },
};

const SubscriptionLock: React.FC<SubscriptionLockProps> = ({
  feature,
  requiredPlan = 'Pro',
  description,
  children,
}) => {
  const { t } = useTranslation();
  const details = featureDetails[feature] || featureDetails.default;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative"
    >
      {/* Blurred content behind */}
      <div className="blur-sm pointer-events-none select-none">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
        <Card className="max-w-sm w-full mx-4 border-primary/20">
          <CardContent className="p-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Lock className="w-8 h-8 text-primary" />
            </motion.div>

            <Badge variant="secondary" className="mb-3">
              <Sparkles className="w-3 h-3 mr-1" />
              {requiredPlan} Feature
            </Badge>

            <h3 className="text-lg font-semibold mb-2">
              {t('subscriptionLock.title', details.title)}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-4">
              {description || t('subscriptionLock.description', details.description)}
            </p>

            <div className="space-y-2">
              <Link to="/subscribe">
                <Button className="w-full">
                  <Zap className="w-4 h-4 mr-2" />
                  {t('subscriptionLock.upgrade', 'Upgrade to {{plan}}', { plan: requiredPlan })}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              
              <p className="text-xs text-muted-foreground">
                {t('subscriptionLock.noCommitment', 'No commitment, cancel anytime')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

// Hook to check feature access
export const useFeatureAccess = (feature: string) => {
  const { user, isLoading } = useAuth();
  const normalizedFeature = feature as SubscriptionFeatureKey;
  const workspacePlan = getWorkspacePlanId(user);
  const hasAccess = hasPlanFeature(workspacePlan, normalizedFeature);
  const requiredPlan = getRequiredPlanForFeature(normalizedFeature);

  return { hasAccess, requiredPlan, loading: isLoading };
};

export default SubscriptionLock;
