import React from 'react';
import { ShieldAlert } from 'lucide-react';
import InvoicesFinancialHub from '@/components/invoices/InvoicesFinancialHub';
import SubscriptionLock, { useFeatureAccess } from '@/components/SubscriptionLock';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const InvoicesPage: React.FC = () => {
  const { isSubUser, canManageSales } = useAuth();
  const { hasAccess, requiredPlan, loading } = useFeatureAccess('invoicing');
  const canAccess = !isSubUser() || canManageSales();

  if (loading) return null;
  if (!hasAccess) {
    return (
      <SubscriptionLock
        feature="invoicing"
        requiredPlan={requiredPlan}
        description="Upgrade to access the invoicing system in this workspace."
      />
    );
  }
  if (!canAccess) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to access this page.
        </AlertDescription>
      </Alert>
    );
  }

  return <InvoicesFinancialHub />;
};

export default InvoicesPage;
