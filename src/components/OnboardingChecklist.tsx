import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Package,
  ScanLine,
  ShoppingCart,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  link: string;
  completed: boolean;
}

const OnboardingChecklist: React.FC = () => {
  const { t } = useTranslation();
  const { onboarding } = useAuth();

  // Don't show if onboarding is completed
  if (onboarding?.completedAt) {
    return null;
  }

  const steps: OnboardingStep[] = [
    {
      id: 'addedFirstProduct',
      label: t('onboarding.addFirstProduct', 'Add Your First Product'),
      description: t('onboarding.addFirstProductDesc', 'Start by adding a product to your inventory'),
      icon: Package,
      link: '/dashboard/inventory?action=add',
      completed: onboarding?.addedFirstProduct || false,
    },
    {
      id: 'scannedFirstBarcode',
      label: t('onboarding.scanFirstBarcode', 'Scan Your First Barcode'),
      description: t('onboarding.scanFirstBarcodeDesc', 'Use the barcode scanner to quickly add products'),
      icon: ScanLine,
      link: '/dashboard/inventory?action=scan',
      completed: onboarding?.scannedFirstBarcode || false,
    },
    {
      id: 'recordedFirstSale',
      label: t('onboarding.recordFirstSale', 'Record Your First Sale'),
      description: t('onboarding.recordFirstSaleDesc', 'Track a sale and see your revenue grow'),
      icon: ShoppingCart,
      link: '/dashboard/ecommerce',
      completed: onboarding?.recordedFirstSale || false,
    },
    {
      id: 'invitedFirstMember',
      label: t('onboarding.inviteFirstMember', 'Invite a Team Member'),
      description: t('onboarding.inviteFirstMemberDesc', 'Collaborate by inviting your team'),
      icon: Users,
      link: '/dashboard/users',
      completed: onboarding?.invitedFirstMember || false,
    },
  ];

  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const progress = Math.round((completedSteps / totalSteps) * 100);

  const getCompletionMessage = () => {
    if (progress === 0) return t('onboarding.getStarted', 'Get started with Stockly');
    if (progress < 50) return t('onboarding.goodStart', 'Good start! Keep going');
    if (progress < 100) return t('onboarding.almostThere', 'Almost there!');
    return t('onboarding.completed', 'Setup complete! 🎉');
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              {t('onboarding.title', 'Welcome to Stockly!')}
            </CardTitle>
            <CardDescription>
              {getCompletionMessage()}
            </CardDescription>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={step.link}>
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      step.completed
                        ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/50'
                        : 'bg-card hover:bg-muted/50 border-border'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        step.completed
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium text-sm ${
                            step.completed ? 'line-through text-muted-foreground' : ''
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    {!step.completed && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
                    )}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {progress === 100 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 text-center"
          >
            <p className="text-sm text-muted-foreground mb-2">
              {t('onboarding.readyToGo', "You're all set! Start managing your inventory like a pro.")}
            </p>
            <Link to="/dashboard/inventory">
              <Button>
                {t('onboarding.goToInventory', 'Go to Inventory')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;
