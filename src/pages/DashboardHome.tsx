import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Package,
  TrendingUp,
  ArrowUpRight,
  MessageSquare,
  BarChart3,
  Sparkles,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  CheckCircle2,
} from "lucide-react";
import {
  MdBarChart,
  MdInventory2,
  MdLocalShipping,
  MdWarningAmber,
} from "react-icons/md";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  productsAPI,
  teamNotesAPI,
  businessAPI,
  authAPI,
} from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import type {
  AccountBalance,
  AccountBalanceTransaction,
  AIInsight,
  Analytics,
  OnboardingProgress,
  WorkspaceActivityItem,
  TeamNote,
  BusinessHighlightCard,
} from "@/types";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getWorkspacePlanId, hasPlanFeature } from "@/lib/subscriptionPlans";

// Import new components
import AIInsightCard from "@/components/AIInsightCard";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import ActionCenter from "@/components/ActionCenter";
import { useAIInsights } from "@/hooks/useAIInsights";

type BestsellerView = "product" | "category";

const DashboardHome: React.FC = () => {
  const { t } = useTranslation();
  const {
    isSubUser,
    onboarding,
    updateOnboarding,
    user,
    canViewAnalytics,
    canViewBalance,
  } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const { isRTL, language } = useLanguage();
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const canAccessInsights = canViewAnalytics();
  const canAccessBalance = canViewBalance();
  const workspacePlan = getWorkspacePlanId(user);
  const canAccessExpensesFeature = hasPlanFeature(workspacePlan, "expenses");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<
    Array<{
      id: string;
      type: "activity";
      action: string;
      title: string;
      description: string;
      date: string;
      amount?: number;
      badge?: string;
      actorName?: string;
    }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [completingNoteId, setCompletingNoteId] = useState<string | null>(null);
  const [businessHighlights, setBusinessHighlights] = useState<
    BusinessHighlightCard[]
  >([]);
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(
    user?.accountBalance || null,
  );
  const [balanceTransactions, setBalanceTransactions] = useState<
    AccountBalanceTransaction[]
  >([]);
  const [isBalanceAdjustOpen, setIsBalanceAdjustOpen] = useState(false);
  const [isBalanceHistoryOpen, setIsBalanceHistoryOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [balanceActionError, setBalanceActionError] = useState<string | null>(
    null,
  );
  const [isBalanceActionLoading, setIsBalanceActionLoading] = useState(false);
  const [isBalanceHistoryLoading, setIsBalanceHistoryLoading] = useState(false);
  const [bestsellerView, setBestsellerView] =
    useState<BestsellerView>("product");
  const {
    insights: aiInsights,
    loading: aiInsightsLoading,
    error: aiInsightsError,
    refetch: refetchAIInsights,
    setInsights: setAIInsights,
  } = useAIInsights(canAccessInsights ? { status: "new", limit: 5 } : null);

  useEffect(() => {
    if (canAccessInsights) {
      fetchAnalytics();
    } else {
      setLoading(false);
      setAnalytics(null);
    }
    fetchRecentActivity();
    fetchNotes();
    if (canAccessInsights) {
      fetchBusinessHighlights();
    } else {
      setBusinessHighlights([]);
    }
    if (canAccessBalance) {
      fetchBalance();
    } else {
      setAccountBalance(null);
    }
  }, [canAccessBalance, canAccessInsights]);

  useEffect(() => {
    if (!analytics || isSubUser()) {
      return;
    }

    const currentOnboarding: OnboardingProgress = onboarding || {
      addedFirstProduct: false,
      scannedFirstBarcode: false,
      recordedFirstSale: false,
      invitedFirstMember: false,
    };

    const nextProgress: Partial<OnboardingProgress> = {};
    const totalProducts = analytics.overview?.totalProducts || 0;
    const totalSales = analytics.overview?.totalSales || 0;
    const totalRevenue = analytics.overview?.totalRevenue || 0;
    const productsWithBarcodes = analytics.overview?.productsWithBarcodes || 0;
    const hasActiveTeamMember = (user?.subUsers || []).some(
      (member) => member.isActive,
    );

    if (totalProducts > 0 && !currentOnboarding.addedFirstProduct) {
      nextProgress.addedFirstProduct = true;
    }
    if (productsWithBarcodes > 0 && !currentOnboarding.scannedFirstBarcode) {
      nextProgress.scannedFirstBarcode = true;
    }
    if (
      (totalSales > 0 || totalRevenue > 0) &&
      !currentOnboarding.recordedFirstSale
    ) {
      nextProgress.recordedFirstSale = true;
    }
    if (hasActiveTeamMember && !currentOnboarding.invitedFirstMember) {
      nextProgress.invitedFirstMember = true;
    }

    if (Object.keys(nextProgress).length > 0) {
      void updateOnboarding(nextProgress);
    }
  }, [analytics, onboarding, isSubUser, updateOnboarding, user?.subUsers]);

  useEffect(() => {
    if (!canAccessBalance) return;
    if (!user?.accountBalance) return;
    setAccountBalance(user.accountBalance);
    setBalanceTransactions(user.accountBalance.transactions || []);
  }, [canAccessBalance, user?.accountBalance]);

  const fetchAnalytics = async () => {
    try {
      const response = await productsAPI.getAnalytics({ t: Date.now() });
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleAnalyticsRefresh = () => {
      if (canAccessInsights) {
        void fetchAnalytics();
        void fetchBusinessHighlights();
        refetchAIInsights();
      }
      if (canAccessBalance) {
        void fetchBalance();
      }
    };

    window.addEventListener(
      "stockly:analytics-refresh",
      handleAnalyticsRefresh as EventListener,
    );
    return () => {
      window.removeEventListener(
        "stockly:analytics-refresh",
        handleAnalyticsRefresh as EventListener,
      );
    };
  }, [canAccessBalance, canAccessInsights, refetchAIInsights]);

  useEffect(() => {
    const handleActivityEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        id: string;
        title: string;
        description: string;
        date?: string;
        amount?: number;
        badge?: string;
      };
      if (!detail) return;
      setRecentActivity((prev) => {
        const next = [
          {
            id: detail.id,
            type: "activity" as const,
            action: String(detail.badge || "system"),
            title: detail.title,
            description: detail.description,
            date: detail.date || new Date().toISOString(),
            amount: detail.amount,
            badge: detail.badge,
          },
          ...prev,
        ];
        return next.slice(0, 12);
      });
    };

    window.addEventListener(
      "stockly:activity",
      handleActivityEvent as EventListener,
    );
    return () => {
      window.removeEventListener(
        "stockly:activity",
        handleActivityEvent as EventListener,
      );
    };
  }, []);

  const formatShortDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(
      language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US",
      {
        month: "short",
        day: "numeric",
      },
    );

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString(
      language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  };

  const withArabicFallback = (englishText: string, arabicText: string) =>
    language === "ar" ? arabicText : englishText;

  const getBalanceEntryLabel = (entry: AccountBalanceTransaction) => {
    const sourceType = String(entry.sourceType || "")
      .trim()
      .toLowerCase();
    if (sourceType === "manual_adjustment") {
      return entry.direction === "credit"
        ? t("dashboard.balance.deposit", withArabicFallback("Deposit", "إيداع"))
        : t(
            "dashboard.balance.withdraw",
            withArabicFallback("Withdraw", "سحب"),
          );
    }
    if (sourceType === "sale_payment") {
      return t("dashboard.balance.sold", "Sold");
    }
    if (sourceType === "sale_payment_reversal") {
      return t("dashboard.balance.saleReversal", "Sale Reversal");
    }
    if (sourceType === "sale_deleted") {
      return t("dashboard.balance.saleDeleted", "Sale Deleted");
    }
    if (sourceType === "invoice_payment") {
      return t("dashboard.balance.invoicePaid", "Invoice Paid");
    }
    if (sourceType === "supplier_purchase_payment") {
      return t("dashboard.balance.supplierPaid", "Supplier Paid");
    }
    if (sourceType === "expense_payment") {
      return t("dashboard.balance.expensePaid", "Expense Paid");
    }
    if (sourceType === "expense_payment_reversal") {
      return t("dashboard.balance.expenseReversal", "Expense Reversal");
    }
    if (sourceType === "expense_reimbursement") {
      return t("dashboard.balance.reimbursementPaid", "Reimbursement Paid");
    }
    if (sourceType === "expense_reimbursement_reversal") {
      return t("dashboard.balance.reimbursementReversal", "Reimbursement Reversal");
    }
    return entry.direction === "credit"
      ? t("dashboard.balance.credit", "Credit")
      : t("dashboard.balance.debit", "Debit");
  };

  const localizeActivityBadge = (badge?: string) => {
    const key = String(badge || "").toLowerCase();
    if (!key) return "";
    if (language === "ar") {
      const arMap: Record<string, string> = {
        sale: "بيع",
        invoice: "فاتورة",
        product: "منتج",
        balance: "الرصيد",
        team: "الفريق",
        system: "النظام",
      };
      return arMap[key] || badge || "";
    }
    const map: Record<string, string> = {
      sale: t("activity.badge.sale", "Sale"),
      invoice: t("activity.badge.invoice", "Invoice"),
      product: t("activity.badge.product", "Product"),
      balance: t("activity.badge.balance", "Balance"),
      team: t("activity.badge.team", "Team"),
      system: t("activity.badge.system", "System"),
    };
    return map[key] || badge || "";
  };

  const localizeActivityTitle = (title: string) => {
    const rawTitle = String(title || "").trim();
    if (!rawTitle || language !== "ar") {
      return rawTitle;
    }

    const normalizedTitle = rawTitle.replace(/[“”]/g, '"');
    const matchRule = (
      pattern: RegExp,
      render: (match: RegExpMatchArray) => string,
    ): string | null => {
      const match = normalizedTitle.match(pattern);
      return match ? render(match) : null;
    };

    const quotedNameRule =
      matchRule(
        /^Added\s+product\s+["']?(.+?)["']?$/i,
        (m) => `تمت إضافة المنتج "${m[1].trim()}"`,
      ) ||
      matchRule(
        /^Updated\s+product\s+["']?(.+?)["']?$/i,
        (m) => `تم تحديث المنتج "${m[1].trim()}"`,
      ) ||
      matchRule(
        /^Deleted\s+product\s+["']?(.+?)["']?$/i,
        (m) => `تم حذف المنتج "${m[1].trim()}"`,
      ) ||
      matchRule(
        /^Updated\s+stock\s+for\s+["']?(.+?)["']?$/i,
        (m) => `تم تحديث مخزون "${m[1].trim()}"`,
      ) ||
      matchRule(/^Sold\s+["']?(.+?)["']?$/i, (m) => `تم بيع "${m[1].trim()}"`);
    if (quotedNameRule) {
      return quotedNameRule;
    }

    const importedProductsRule = matchRule(
      /^Imported\s+products\s+\(created:\s*(\d+),\s*updated:\s*(\d+)\)$/i,
      (m) => `تم استيراد المنتجات (تم الإنشاء: ${m[1]}, تم التحديث: ${m[2]})`,
    );
    if (importedProductsRule) {
      return importedProductsRule;
    }

    const invoiceRule =
      matchRule(
        /^Created\s+invoice\s+(.+)$/i,
        (m) => `تم إنشاء الفاتورة ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Updated\s+invoice\s+(.+)$/i,
        (m) => `تم تحديث الفاتورة ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Deleted\s+invoice\s+(.+)$/i,
        (m) => `تم حذف الفاتورة ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Sent\s+invoice\s+(.+)$/i,
        (m) => `تم إرسال الفاتورة ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Recorded\s+payment\s+on\s+invoice\s+(.+)$/i,
        (m) => `تم تسجيل دفعة على الفاتورة ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Cancelled\s+invoice\s+(.+)$/i,
        (m) => `تم إلغاء الفاتورة ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Duplicated\s+invoice\s+(.+)\s+to\s+(.+)$/i,
        (m) => `تم نسخ الفاتورة ${m[1].trim()} إلى ${m[2].trim()}`,
      ) ||
      matchRule(
        /^Payment\s+recorded\s+for\s+invoice\s+(.+)$/i,
        (m) => `تم تسجيل دفعة للفاتورة ${m[1].trim()}`,
      );
    if (invoiceRule) {
      return invoiceRule;
    }

    const orderRule =
      matchRule(
        /^Created\s+order\s+(.+)$/i,
        (m) => `تم إنشاء الطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Updated\s+order\s+(.+)\s+status$/i,
        (m) => `تم تحديث حالة الطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Deleted\s+order\s+(.+)$/i,
        (m) => `تم حذف الطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Created\s+quick\s+sale\s+(.+)$/i,
        (m) => `تم إنشاء بيع سريع ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Payment\s+received\s+for\s+order\s+(.+)$/i,
        (m) => `تم استلام الدفع للطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Payment\s+received\s+for\s+quick\s+sale\s+(.+)$/i,
        (m) => `تم استلام الدفع للبيع السريع ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Payment\s+status\s+changed\s+to\s+paid\s+for\s+order\s+(.+)$/i,
        (m) => `تم تغيير حالة الدفع إلى مدفوع للطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Payment\s+status\s+changed\s+from\s+paid\s+for\s+order\s+(.+)$/i,
        (m) => `تم تغيير حالة الدفع من مدفوع للطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^Deleted\s+paid\s+order\s+(.+)$/i,
        (m) => `تم حذف طلب مدفوع ${m[1].trim()}`,
      );
    if (orderRule) {
      return orderRule;
    }

    const balanceRule =
      matchRule(
        /^Manual\s+deposit\s+to\s+balance$/i,
        () => "إيداع يدوي في الرصيد",
      ) ||
      matchRule(
        /^Manual\s+withdrawal\s+from\s+balance$/i,
        () => "سحب يدوي من الرصيد",
      ) ||
      matchRule(
        /^Order\s+payment\s+credited\s+to\s+balance$/i,
        () => "تمت إضافة دفعة الطلب إلى الرصيد",
      ) ||
      matchRule(
        /^Order\s+payment\s+reversal\s+debited\s+from\s+balance$/i,
        () => "تم خصم عكس دفعة الطلب من الرصيد",
      ) ||
      matchRule(
        /^Deleted\s+paid\s+order\s+debited\s+from\s+balance$/i,
        () => "تم خصم طلب مدفوع محذوف من الرصيد",
      ) ||
      matchRule(
        /^Invoice\s+paid\s+using\s+balance$/i,
        () => "تم دفع الفاتورة باستخدام الرصيد",
      ) ||
      matchRule(/^Balance\s+credited$/i, () => "تمت إضافة مبلغ إلى الرصيد") ||
      matchRule(/^Balance\s+debited$/i, () => "تم خصم مبلغ من الرصيد");
    if (balanceRule) {
      return balanceRule;
    }

    const aiAssistantRule =
      matchRule(
        /^AI\s+assistant\s+restocked\s+["']?(.+?)["']?$/i,
        (m) => `قام المساعد الذكي بإعادة تخزين "${m[1].trim()}"`,
      ) ||
      matchRule(
        /^AI\s+assistant\s+created\s+order\s+(.+)$/i,
        (m) => `قام المساعد الذكي بإنشاء الطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^AI\s+assistant\s+updated\s+product\s+["']?(.+?)["']?$/i,
        (m) => `قام المساعد الذكي بتحديث المنتج "${m[1].trim()}"`,
      ) ||
      matchRule(
        /^AI\s+assistant\s+deleted\s+product\s+["']?(.+?)["']?$/i,
        (m) => `قام المساعد الذكي بحذف المنتج "${m[1].trim()}"`,
      ) ||
      matchRule(
        /^AI\s+assistant\s+deleted\s+(\d+)\s+product\(s\)\s+matching\s+["']?(.+?)["']?$/i,
        (m) => `قام المساعد الذكي بحذف ${m[1]} منتج مطابق لـ "${m[2].trim()}"`,
      ) ||
      matchRule(
        /^AI\s+assistant\s+deleted\s+order\s+(.+)$/i,
        (m) => `قام المساعد الذكي بحذف الطلب ${m[1].trim()}`,
      ) ||
      matchRule(
        /^AI\s+assistant\s+deleted\s+(\d+)\s+order\(s\)\s+matching\s+["']?(.+?)["']?$/i,
        (m) => `قام المساعد الذكي بحذف ${m[1]} طلب مطابق لـ "${m[2].trim()}"`,
      );
    if (aiAssistantRule) {
      return aiAssistantRule;
    }

    if (/^Deleted\s+item$/i.test(normalizedTitle)) {
      return "تم حذف عنصر";
    }
    if (/^Activity$/i.test(normalizedTitle)) {
      return "نشاط";
    }

    return rawTitle;
  };

  const localizeActivityDescription = (description: string) => {
    const rawDescription = String(description || "").trim();
    if (!rawDescription || language !== "ar") {
      return rawDescription;
    }

    const normalizedDescription = rawDescription.replace(/[“”]/g, '"');

    if (/^By\s+system$/i.test(normalizedDescription)) {
      return "بواسطة النظام";
    }

    const byActorMatch = normalizedDescription.match(/^By\s+(.+)$/i);
    if (byActorMatch) {
      return `بواسطة ${byActorMatch[1].trim()}`;
    }

    return localizeActivityTitle(normalizedDescription);
  };

  const localizeBusinessHighlightCard = (
    card: BusinessHighlightCard,
  ): BusinessHighlightCard => {
    const cardId = String(card.id || "").toLowerCase();

    if (cardId === "shipping_pipeline") {
      const waitingMatch = String(card.description || "").match(/\d+/);
      const waitingToShipCount = waitingMatch ? Number(waitingMatch[0]) : 0;
      return {
        ...card,
        title: t("analytics.shippingPipeline", "Shipping pipeline"),
        description: t(
          "analytics.ordersWaitingToShipCount",
          "{{count}} orders waiting to ship",
          {
            count: Number.isFinite(waitingToShipCount) ? waitingToShipCount : 0,
          },
        ),
      };
    }

    if (cardId === "late_shipments") {
      return {
        ...card,
        title: t("analytics.lateShipments", "Late Shipments"),
        description: t(
          "analytics.lateShipmentsDesc",
          "Orders older than 72h still not shipped",
        ),
      };
    }

    if (cardId === "pending_reimbursements") {
      return {
        ...card,
        title: t("expenses.pendingReimbursements", "Pending Reimbursements"),
        description: t(
          "expenses.pendingWidgetDesc",
          "Out-of-pocket business spending still owed by the store.",
        ),
      };
    }

    if (cardId === "expenses_due_soon") {
      return {
        ...card,
        title: t("expenses.dueSoon", "Expenses Due Soon"),
        description: t(
          "expenses.snapshotDesc",
          "What is due now and what the business still owes people.",
        ),
      };
    }

    return card;
  };

  const buildDeletedActivityTitle = (
    entry: WorkspaceActivityItem,
    metadata: Record<string, unknown>,
  ) => {
    const orderNumber = String(metadata.orderNumber || "").trim();
    const invoiceNumber = String(metadata.invoiceNumber || "").trim();
    const productName = String(metadata.productName || "").trim();

    if (entry.entityType === "sale") {
      return orderNumber
        ? t("analytics.deletedOrderNamed", "Deleted order {{order}}", {
            order: orderNumber,
          })
        : t("analytics.deletedOrder", "Deleted order");
    }
    if (entry.entityType === "invoice") {
      return invoiceNumber
        ? t("analytics.deletedInvoiceNamed", "Deleted invoice {{invoice}}", {
            invoice: invoiceNumber,
          })
        : t("analytics.deletedInvoice", "Deleted invoice");
    }
    if (entry.entityType === "product") {
      return productName
        ? t("analytics.deletedProductNamed", "Deleted product {{product}}", {
            product: productName,
          })
        : t("analytics.deletedProduct", "Deleted product");
    }

    return t("analytics.deletedItem", "Deleted item");
  };

  const getActivityTitle = (
    entry: WorkspaceActivityItem,
    metadata: Record<string, unknown>,
  ) => {
    const action = String(entry.action || "").toLowerCase();
    if (action.includes("deleted")) {
      return buildDeletedActivityTitle(entry, metadata);
    }
    const description = localizeActivityTitle(entry.description);
    return description || t("analytics.activity", "Activity");
  };

  const fetchRecentActivity = async () => {
    try {
      setActivityLoading(true);
      const response = await authAPI.getActivityHistory(24);
      const combined = (response.data.activity || []).map(
        (entry: WorkspaceActivityItem) => {
          const metadata = (entry.metadata || {}) as Record<string, unknown>;
          const sourceType = String(metadata.sourceType || "");
          const badge =
            entry.entityType === "sale"
              ? "sale"
              : entry.entityType === "invoice"
                ? "invoice"
                : entry.entityType === "product"
                  ? "product"
                  : sourceType
                    ? "balance"
                    : entry.entityType === "team"
                      ? "team"
                      : "system";
          const actorName = String(metadata.actorName || "").trim();
          return {
            id: entry.id,
            type: "activity" as const,
            action: entry.action,
            title: getActivityTitle(entry, metadata),
            description: actorName
              ? t(
                  "analytics.byActor",
                  withArabicFallback("By {{name}}", "بواسطة {{name}}"),
                  { name: actorName },
                )
              : t(
                  "analytics.bySystem",
                  withArabicFallback("By system", "بواسطة النظام"),
                ),
            date: entry.createdAt,
            amount: Number(entry.amount || 0),
            badge,
            actorName,
          };
        },
      );

      setRecentActivity(combined.slice(0, 12));
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      setRecentActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };
  const fetchNotes = async () => {
    try {
      setNotesLoading(true);
      const response = await teamNotesAPI.getNotes();
      setNotes(response.data.notes || []);
    } catch {
      setNotesError(t("dashboardNotes.loadFailed", "Failed to load notes"));
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchBusinessHighlights = async () => {
    if (!canAccessInsights) {
      setBusinessHighlights([]);
      return;
    }
    try {
      const response = await businessAPI.getHighlights();
      const filteredCards = (response.data.cards || []).filter(
        (card) => {
          const cardId = String(card.id || "").toLowerCase();
          if (["variant_count", "returns_queue"].includes(cardId)) {
            return false;
          }
          if (
            !canAccessExpensesFeature &&
            ["pending_reimbursements", "expenses_due_soon"].includes(cardId)
          ) {
            return false;
          }
          return true;
        },
      );
      setBusinessHighlights(filteredCards);
    } catch {
      setBusinessHighlights([]);
    }
  };

  const fetchBalance = async () => {
    if (!canAccessBalance) {
      setAccountBalance(null);
      setBalanceTransactions([]);
      return;
    }
    try {
      const response = await authAPI.getBalance();
      setAccountBalance(response.data.balance);
      setBalanceTransactions(response.data.balance?.transactions || []);
    } catch {
      setAccountBalance(user?.accountBalance || null);
      setBalanceTransactions(user?.accountBalance?.transactions || []);
    }
  };

  const fetchBalanceHistory = async () => {
    if (!canAccessBalance) return;
    try {
      setIsBalanceHistoryLoading(true);
      const response = await authAPI.getBalanceHistory(80);
      setAccountBalance(response.data.balance);
      setBalanceTransactions(response.data.transactions || []);
    } catch {
      // Keep existing values if history fetch fails.
    } finally {
      setIsBalanceHistoryLoading(false);
    }
  };

  const applyManualBalanceChange = async (direction: "credit" | "debit") => {
    const parsedAmount = Number(balanceAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setBalanceActionError(
        t(
          "dashboard.balance.amountInvalid",
          "Please enter a valid amount greater than 0.",
        ),
      );
      return;
    }

    try {
      setIsBalanceActionLoading(true);
      setBalanceActionError(null);
      const response = await authAPI.createBalanceTransaction({
        direction,
        amount: parsedAmount,
        note: balanceNote.trim(),
      });
      setAccountBalance(response.data.balance);
      if (response.data.transaction) {
        setBalanceTransactions((prev) =>
          [
            response.data.transaction as AccountBalanceTransaction,
            ...prev,
          ].slice(0, 200),
        );
      }
      setBalanceAmount("");
      setBalanceNote("");
      setIsBalanceAdjustOpen(false);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (
              error as {
                response?: {
                  data?: {
                    message?: string;
                  };
                };
              }
            ).response?.data?.message
          : undefined;
      setBalanceActionError(
        message ||
          t(
            "dashboard.balance.transactionFailed",
            "Failed to update balance. Please try again.",
          ),
      );
    } finally {
      setIsBalanceActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    const trimmed = noteContent.trim();
    if (!trimmed) return;
    if (trimmed.length > 200) {
      setNotesError(
        t(
          "dashboardNotes.maxLengthError",
          "Note must be 200 characters or less",
        ),
      );
      return;
    }

    try {
      setNotesLoading(true);
      setNotesError(null);
      const response = await teamNotesAPI.createNote(trimmed);
      setNoteContent("");
      setNotes((prev) =>
        [response.data.note as TeamNote, ...prev].slice(0, 20),
      );
    } catch {
      setNotesError(t("dashboardNotes.addFailed", "Failed to add note"));
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCompleteNote = async (noteId: string) => {
    try {
      setCompletingNoteId(noteId);
      setNotesError(null);
      const response = await teamNotesAPI.completeNote(noteId);
      const updated = response.data.note;
      setNotes((prev) =>
        prev.map((note) =>
          note._id === noteId ? (updated as TeamNote) : note,
        ),
      );
    } catch {
      setNotesError(
        t("dashboardNotes.completeFailed", "Failed to complete note"),
      );
    } finally {
      setCompletingNoteId(null);
    }
  };

  const bestsellerItems =
    bestsellerView === "category"
      ? (analytics?.bestsellersByCategory || []).map((category) => ({
          key: category._id,
          name: category.name || t("analytics.uncategorized", "Uncategorized"),
          salesCount: category.salesCount,
          revenue: category.revenue,
          secondaryLine: `${category.productCount} ${t("analytics.productsLabel", "products")}`,
        }))
      : (analytics?.bestsellers || []).map((product) => ({
          key: product._id,
          name: product.name,
          salesCount: product.salesCount,
          revenue: product.revenue,
          secondaryLine: `${formatCurrency(product.price)} ${t("analytics.each", "each")}`,
        }));
  const positiveGreenHex = isDarkMode ? "#0E8A33" : "#10B981";
  const positiveLimeHex = isDarkMode ? "#708A00" : "#BBF00F";
  const positiveBadgeToneClass = isDarkMode
    ? "bg-[#0E8A33]/20 text-[#0E8A33]"
    : "bg-[#10B981]/20 text-[#10B981]";
  const positiveSideToneClass = isDarkMode
    ? "border-[#0E8A33]/45"
    : "border-[#10B981]/40";
  const positiveTextToneClass = isDarkMode
    ? "text-[#0E8A33]"
    : "text-[#10B981]";
  const creditBadgeToneClass = isDarkMode
    ? "bg-[#0E8A33]/20 text-[#0E8A33]"
    : "bg-[#BBF00F]/20 text-[#BBF00F]";
  const creditTextToneClass = isDarkMode ? "text-[#0E8A33]" : "text-[#BBF00F]";
  const positiveActionButtonClass = isDarkMode
    ? "bg-[#0E8A33] hover:bg-[#0E8A33]/90 text-white"
    : "bg-[#10B981] hover:bg-[#10B981]/90 text-white";
  const bestsellerRankColors = [
    positiveGreenHex,
    positiveLimeHex,
    "#0A1DF5",
    "#0E92F0",
    "#F2700F",
    "#F0162F",
  ];
  const shouldDistributeBestsellers = bestsellerItems.length >= 5;
  const bestsellerSpacingClass = shouldDistributeBestsellers
    ? "h-full flex flex-col justify-between"
    : bestsellerView === "category"
      ? "space-y-7"
      : "space-y-4";
  const metricTitleClass =
    "text-lg md:text-xl font-semibold text-[#5E5E5E] dark:text-[#FCFCFC] leading-snug";
  const highlightTitleClass =
    "text-lg md:text-xl font-semibold text-[#5E5E5E] dark:text-[#FCFCFC] leading-snug";
  const metricValueClass = "text-2xl font-bold text-foreground tabular-nums";
  const userDisplayName = user?.name?.trim();
  const defaultWelcomeMessage = t(
    "dashboard.welcome",
    "Welcome back! Here's what's happening with your inventory.",
  );
  const personalizedWelcomeMessage = userDisplayName
    ? t("dashboard.welcomeWithName", {
        defaultValue:
          language === "ar"
            ? "مرحباً بعودتك {{name}}! إليك ما يحدث في مخزونك."
            : language === "fr"
              ? "Bon retour, {{name}} ! Voici ce qui se passe dans votre inventaire."
              : "Welcome back, {{name}}! Here's what's happening with your inventory.",
        name: userDisplayName,
      })
    : defaultWelcomeMessage;
  const getHighlightIcon = (cardId: string) => {
    const iconClassName = "h-5 w-5 text-[#7283FB] shrink-0";
    switch (String(cardId || "").toLowerCase()) {
      case "shipping_pipeline":
        return <MdLocalShipping className={iconClassName} aria-hidden="true" />;
      case "late_shipments":
        return <MdWarningAmber className={iconClassName} aria-hidden="true" />;
      case "low_stock":
      case "low_stock_alert":
        return <MdInventory2 className={iconClassName} aria-hidden="true" />;
      default:
        return <MdBarChart className={iconClassName} aria-hidden="true" />;
    }
  };

  // Check if onboarding is completed
  const isOnboardingComplete =
    onboarding?.completedAt ||
    (onboarding?.addedFirstProduct &&
      onboarding?.scannedFirstBarcode &&
      onboarding?.recordedFirstSale &&
      onboarding?.invitedFirstMember);
  const currentBalance = accountBalance?.current ?? user?.balance ?? 0;
  const getActivityTone = (activity: {
    badge?: string;
    action: string;
    amount?: number;
  }) => {
    const action = String(activity.action || "").toLowerCase();
    const isDeleted = action.includes("deleted");
    if (isDeleted) {
      return {
        badgeTone: "bg-red-100 text-red-700",
        sideTone: "border-red-300",
        amountTone: "text-red-600",
      };
    }

    if (activity.badge === "balance") {
      const amount = Number(activity.amount || 0);
      const isDebit =
        amount < 0 || action.includes("debit") || action.includes("withdraw");
      return {
        badgeTone: isDebit ? "bg-red-100 text-red-700" : positiveBadgeToneClass,
        sideTone: isDebit ? "border-red-200" : positiveSideToneClass,
        amountTone: isDebit ? "text-red-600" : positiveTextToneClass,
      };
    }

    if (activity.badge === "sale") {
      return {
        badgeTone: positiveBadgeToneClass,
        sideTone: positiveSideToneClass,
        amountTone: positiveTextToneClass,
      };
    }
    if (activity.badge === "invoice") {
      return {
        badgeTone: "bg-purple-100 text-purple-700",
        sideTone: "border-purple-200",
        amountTone: "text-purple-700",
      };
    }
    if (activity.badge === "product") {
      return {
        badgeTone: "bg-blue-100 text-blue-700",
        sideTone: "border-blue-200",
        amountTone: "text-blue-700",
      };
    }
    if (activity.badge === "team") {
      return {
        badgeTone: "bg-amber-100 text-amber-700",
        sideTone: "border-amber-200",
        amountTone: "text-amber-700",
      };
    }
    return {
      badgeTone: "bg-gray-100 text-gray-700",
      sideTone: "border-gray-200",
      amountTone: "text-foreground",
    };
  };

  const handleAIInsightStatusChange = (updatedInsight: AIInsight) => {
    setAIInsights((currentInsights) => {
      if (updatedInsight.status === "new") {
        return currentInsights.map((insight) =>
          insight._id === updatedInsight._id
            ? updatedInsight
            : insight,
        );
      }

      return currentInsights.filter(
        (insight) => insight._id !== updatedInsight._id,
      );
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center rounded-md border border-dashed border-border/70 bg-card/60">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span>{t("common.loading", "Loading...")}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        isRTL ? "page-shell text-right" : "page-shell"
      } [&_[data-slot=card-title]]:text-xl [&_[data-slot=card-title]]:font-semibold [&_[data-slot=card-title]]:tracking-tight [&_[data-slot=card-description]]:text-base [&_[data-slot=card-description]]:text-muted-foreground`}
    >
      {/* Page Header */}
      <div
        className={
          isRTL
            ? "page-header"
            : "page-header"
        }
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("common.dashboard", "Dashboard")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{personalizedWelcomeMessage}</p>
        </div>
        <div dir={isRTL ? "rtl" : "ltr"} className="page-actions">
          {isRTL ? (
            <>
              <Link to="/dashboard/inventory">
                <Button variant="outline">
                  {t("inventory.viewInventory", "View Inventory")}
                  <Package className="w-4 h-4 mr-2" />
                </Button>
              </Link>
              <Link to="/dashboard/inventory?action=add">
                <Button className="bg-[#0A1DF5] hover:bg-[#0A1DF5]/90 text-white">
                  {t("inventory.addProduct", "Add Product")}
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard/inventory">
                <Button variant="outline">
                  <Package className="w-4 h-4 mr-2" />
                  {t("inventory.viewInventory", "View Inventory")}
                </Button>
              </Link>
              <Link to="/dashboard/inventory?action=add">
                <Button className="bg-[#0A1DF5] hover:bg-[#0A1DF5]/90 text-white">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  {t("inventory.addProduct", "Add Product")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Onboarding Checklist - Show for new users */}
      {!isOnboardingComplete && !isSubUser() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <OnboardingChecklist />
        </motion.div>
      )}

      {canAccessInsights && businessHighlights.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:gap-5">
          {businessHighlights.map((rawCard) => {
            const card = localizeBusinessHighlightCard(rawCard);
            return (
              <Card key={card.id} className="min-h-[128px] rounded-md py-4">
                <CardContent className="pt-0 h-full">
                  <div className="h-full flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={highlightTitleClass}>{card.title}</p>
                      <p
                        className={`${metricValueClass} leading-snug break-words whitespace-normal`}
                      >
                        {card.value}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {card.description}
                      </p>
                    </div>
                    <div
                      className={`pt-0.5 ${isRTL ? "order-first" : "order-last"}`}
                    >
                      {getHighlightIcon(String(card.id || ""))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canAccessBalance && (
        <div className="space-y-3">
          <div
            dir={isRTL ? "rtl" : "ltr"}
            className={cn("page-actions", isRTL ? "justify-end" : "justify-end")}
          >
            {isRTL ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsBalanceHistoryOpen(true);
                    void fetchBalanceHistory();
                  }}
                >
                  {t(
                    "dashboard.balance.history",
                    "Balance Transaction History",
                  )}
                  <History className="h-4 w-4 mr-2" />
                </Button>
                <Button
                  type="button"
                  className="bg-[#0A1DF5] hover:bg-[#0A1DF5]/90 text-white"
                  onClick={() => {
                    setBalanceActionError(null);
                    setBalanceAmount("");
                    setBalanceNote("");
                    setIsBalanceAdjustOpen(true);
                  }}
                >
                  {t("dashboard.balance.adjustMoney", "Balance Management")}
                  <Wallet className="h-4 w-4 mr-2" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsBalanceHistoryOpen(true);
                    void fetchBalanceHistory();
                  }}
                >
                  <History className="h-4 w-4 mr-2" />
                  {t(
                    "dashboard.balance.history",
                    "Balance Transaction History",
                  )}
                </Button>
                <Button
                  type="button"
                  className="bg-[#0A1DF5] hover:bg-[#0A1DF5]/90 text-white"
                  onClick={() => {
                    setBalanceActionError(null);
                    setBalanceAmount("");
                    setBalanceNote("");
                    setIsBalanceAdjustOpen(true);
                  }}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  {t("dashboard.balance.adjustMoney", "Balance Management")}
                </Button>
              </>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3 xl:gap-5">
            <Card className="min-h-[128px] rounded-md py-4">
              <CardContent className="pt-0 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className={metricTitleClass}>
                    {t("dashboard.balance.current", "Current Balance")}
                  </p>
                  <Wallet className="h-4 w-4 text-[#0A1DF5]" />
                </div>
                <p className={`mt-2 ${metricValueClass}`}>
                  {formatCurrency(currentBalance)}
                </p>
              </CardContent>
            </Card>
            <Card className="min-h-[128px] rounded-md py-4">
              <CardContent className="pt-0 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className={metricTitleClass}>
                    {t("dashboard.balance.inflow", "Total Inflow")}
                  </p>
                  <ArrowDownCircle
                    className={`h-4 w-4 ${positiveTextToneClass}`}
                  />
                </div>
                <p className={`mt-2 ${metricValueClass}`}>
                  {formatCurrency(accountBalance?.totalCredited || 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="min-h-[128px] rounded-md py-4">
              <CardContent className="pt-0 h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <p className={metricTitleClass}>
                    {t("dashboard.balance.outflow", "Total Outflow")}
                  </p>
                  <ArrowUpCircle className="h-4 w-4 text-[#F0162F]" />
                </div>
                <p className={`mt-2 ${metricValueClass}`}>
                  {formatCurrency(accountBalance?.totalDebited || 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Action Center - Takes 2 columns */}
        <div className="flex h-full flex-col gap-5 lg:col-span-2 lg:gap-6">
          {canAccessInsights && (
            <Card className="rounded-md">
              <CardHeader className={isRTL ? "text-right" : ""}>
                <div
                  className={`flex flex-col gap-3 sm:items-center sm:justify-between ${
                    isRTL ? "sm:flex-row-reverse" : "sm:flex-row"
                  }`}
                >
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Sparkles className="h-5 w-5 text-[#0A1DF5]" />
                      {t("aiInsights.sectionTitle", "AI Sales Expert")}
                    </CardTitle>
                    <CardDescription>
                      {t(
                        "aiInsights.sectionDescription",
                        "Fresh recommendations to improve margins, retain clients, and move stock faster.",
                      )}
                    </CardDescription>
                  </div>
                  {aiInsights.length > 0 ? (
                    <Badge className="border-0 bg-[#0A1DF5]/10 text-[#0A1DF5]">
                      {t("aiInsights.newCount", "{{count}} new", {
                        count: aiInsights.length,
                      })}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiInsightsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((placeholder) => (
                      <div
                        key={placeholder}
                        className="h-28 animate-pulse rounded-md bg-muted/70"
                      />
                    ))}
                  </div>
                ) : aiInsightsError ? (
                  <div
                    className={`rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 ${
                      isRTL ? "text-right" : ""
                    }`}
                  >
                    <p>{aiInsightsError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={refetchAIInsights}
                    >
                      {t("common.retry", "Retry")}
                    </Button>
                  </div>
                ) : aiInsights.length > 0 ? (
                  aiInsights.map((insight) => (
                    <AIInsightCard
                      key={insight._id}
                      insight={insight}
                      onStatusChange={handleAIInsightStatusChange}
                    />
                  ))
                ) : (
                  <div
                    className={`rounded-md border border-dashed border-border/70 bg-muted/20 p-6 text-center text-muted-foreground ${
                      isRTL ? "text-right" : ""
                    }`}
                  >
                    <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#0A1DF5]/50" />
                    <p className="font-medium text-foreground">
                      {t(
                        "aiInsights.emptyTitle",
                        "No new AI insights right now",
                      )}
                    </p>
                    <p className="mt-1 text-sm">
                      {t(
                        "aiInsights.emptyDescription",
                        "As new pricing, client, or inventory signals appear, your daily briefing will show up here.",
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {canAccessInsights && <ActionCenter />}

          {/* Bestsellers */}
          <Card className="flex flex-1 flex-col rounded-md md:min-h-[460px]">
            <CardHeader className="space-y-3">
              <div
                className={`flex flex-col gap-3 sm:items-center sm:justify-between ${
                  isRTL ? "sm:flex-row" : "sm:flex-row"
                }`}
              >
                <div>
                  <CardTitle className="text-xl">
                    {t("analytics.bestsellers", "Bestsellers")}
                  </CardTitle>
                  <CardDescription>
                    {bestsellerView === "category"
                      ? t(
                          "analytics.topCategoriesBySales",
                          "Top categories by sales this month",
                        )
                      : t(
                          "analytics.topPerforming",
                          "Top performing products this month",
                        )}
                  </CardDescription>
                </div>
                <Select
                  value={bestsellerView}
                  onValueChange={(value) =>
                    setBestsellerView(value as BestsellerView)
                  }
                >
                  <SelectTrigger
                    dir={isRTL ? "rtl" : "ltr"}
                    className={`w-full sm:w-[190px] ${
                      isRTL
                        ? "flex-row-reverse text-right [&_[data-slot=select-value]]:justify-end [&_[data-slot=select-value]]:text-right"
                        : ""
                    }`}
                  >
                    <SelectValue
                      placeholder={t("analytics.groupBy", "Group by")}
                    />
                  </SelectTrigger>
                  <SelectContent
                    dir={isRTL ? "rtl" : "ltr"}
                    align={isRTL ? "start" : "end"}
                  >
                    <SelectItem
                      value="product"
                      className={isRTL ? "text-right" : ""}
                    >
                      {t("analytics.byProduct", "By product")}
                    </SelectItem>
                    <SelectItem
                      value="category"
                      className={isRTL ? "text-right" : ""}
                    >
                      {t("analytics.byCategory", "By category")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex">
              {!canAccessInsights ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>
                    {t(
                      "dashboard.insightsDisabled",
                      "Insights access is disabled for this workspace",
                    )}
                  </p>
                </div>
              ) : bestsellerItems.length > 0 ? (
                <div className={`w-full ${bestsellerSpacingClass}`}>
                  {bestsellerItems.map((item, index) => {
                    const rankColor =
                      bestsellerRankColors[index % bestsellerRankColors.length];

                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                            style={{
                              color: rankColor,
                              backgroundColor: `${rankColor}1A`,
                            }}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.salesCount} {t("analytics.sales", "sales")}
                            </p>
                          </div>
                        </div>
                        <div className={isRTL ? "text-left" : "text-right"}>
                          <p className="font-semibold">
                            {formatCurrency(item.revenue)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.secondaryLine}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex w-full flex-col items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/20 py-10 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>
                    {t("analytics.noSalesData", "No sales data available yet")}
                  </p>
                  <Link to="/dashboard/inventory">
                    <Button
                      variant="link"
                      className={isRTL ? "mt-2 justify-end" : "mt-2"}
                    >
                      {t("inventory.addFirstProduct", "Add your first product")}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Recent Activity & Quick Actions */}
        <div className="flex h-full flex-col gap-5 lg:gap-6">
          {/* Team Notes */}
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#0A1DF5]" />
                {t("dashboardNotes.title", "Team Notes")}
              </CardTitle>
              <CardDescription>
                {t(
                  "dashboardNotes.description",
                  "Leave quick notes for your team",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={t("dashboardNotes.placeholder", "Write a note...")}
                maxLength={200}
                className="max-h-28 overflow-y-auto resize-none"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{noteContent.length}/200</span>
                <Button
                  onClick={handleAddNote}
                  disabled={notesLoading || noteContent.trim().length === 0}
                  className={positiveActionButtonClass}
                >
                  {t("dashboardNotes.addNote", "Add Note")}
                </Button>
              </div>
              {notesError && (
                <p className="text-xs text-red-500">{notesError}</p>
              )}
              {notesLoading ? (
                <div className="text-xs text-muted-foreground">
                  {t("dashboardNotes.loading", "Loading notes...")}
                </div>
              ) : notes.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {notes.map((note) => (
                    <div
                      key={note._id}
                      className={`rounded-md border border-border/70 bg-background/40 p-3 text-sm ${
                        note.completed
                          ? "bg-muted/40 border-muted text-muted-foreground"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">
                            {note.authorName} •{" "}
                            {formatShortDate(note.createdAt)}
                          </div>
                          <div
                            className={
                              note.completed ? "line-through opacity-80" : ""
                            }
                          >
                            {note.content}
                          </div>
                          {note.completed ? (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {t(
                                "dashboardNotes.completedBy",
                                withArabicFallback(
                                  "Completed by {{name}}",
                                  "تم الإكمال بواسطة {{name}}",
                                ),
                                {
                                  name:
                                    note.completedByName ||
                                    t(
                                      "common.system",
                                      withArabicFallback("System", "النظام"),
                                    ),
                                },
                              )}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant={note.completed ? "secondary" : "outline"}
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => void handleCompleteNote(note._id)}
                          disabled={Boolean(
                            note.completed || completingNoteId === note._id,
                          )}
                          title={t("dashboardNotes.markDone", "Mark as done")}
                        >
                          <CheckCircle2
                            className={`h-4 w-4 ${note.completed ? creditTextToneClass : ""}`}
                          />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border/70 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  {t("dashboardNotes.empty", "No notes yet.")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-1 flex-col rounded-md md:min-h-[470px]">
            <CardHeader>
              <CardTitle className="text-xl">
                {t("analytics.recentActivity", "Recent Activity")}
              </CardTitle>
              <CardDescription>
                {t(
                  "analytics.recentActivityDesc",
                  "Latest updates across stock and sales",
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {activityLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span>
                    {t(
                      "analytics.loadingActivity",
                      "Loading recent activity...",
                    )}
                  </span>
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {recentActivity.map((activity) => {
                    const { badgeTone, sideTone, amountTone } =
                      getActivityTone(activity);

                    return (
                      <div
                        key={activity.id}
                         className={`flex items-center justify-between gap-3 rounded-md border border-l-4 bg-background/40 p-3 ${sideTone}`}
                        style={isRTL ? { direction: "ltr" } : undefined}
                      >
                        {isRTL ? (
                          <>
                            <div className="self-start flex flex-col gap-1 items-start text-left">
                              {activity.badge && (
                                <Badge className={`border-0 ${badgeTone}`}>
                                  {localizeActivityBadge(activity.badge)}
                                </Badge>
                              )}
                              {activity.amount !== undefined && (
                                <p className={amountTone}>
                                  {formatCurrency(activity.amount)}
                                </p>
                              )}
                            </div>
                            <div className="flex-1 text-right" dir="rtl">
                              <p
                                className="text-sm text-muted-foreground"
                                dir="rtl"
                              >
                                {formatDateTime(activity.date)}
                              </p>
                              <p
                                className="font-normal text-[#333333] dark:text-[#FCFCFC]"
                                dir="rtl"
                              >
                                {localizeActivityTitle(activity.title)}
                              </p>
                              <p
                                className="text-sm text-muted-foreground"
                                dir="rtl"
                              >
                                {localizeActivityDescription(
                                  activity.description,
                                )}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {formatDateTime(activity.date)}
                              </p>
                              <p className="font-normal text-[#333333] dark:text-[#FCFCFC]">
                                {localizeActivityTitle(activity.title)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {localizeActivityDescription(
                                  activity.description,
                                )}
                              </p>
                            </div>
                            <div className="self-start flex flex-col gap-1 items-end text-right">
                              {activity.badge && (
                                <Badge className={`border-0 ${badgeTone}`}>
                                  {localizeActivityBadge(activity.badge)}
                                </Badge>
                              )}
                              {activity.amount !== undefined && (
                                <p className={amountTone}>
                                  {formatCurrency(activity.amount)}
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                  {t("analytics.noRecentActivity", "No recent activity yet")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isBalanceAdjustOpen} onOpenChange={setIsBalanceAdjustOpen}>
        <DialogContent
          dir={isRTL ? "rtl" : "ltr"}
          className={cn(
            "sm:max-w-md",
            isRTL &&
              "text-right [&_[data-slot=dialog-close]]:left-4 [&_[data-slot=dialog-close]]:right-auto",
          )}
        >
          <DialogHeader className={isRTL ? "text-right sm:text-right" : ""}>
            <DialogTitle>
              {t("dashboard.balance.adjustMoney", "Balance Management")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "dashboard.balance.adjustMoneyDesc",
                "Record deposits and withdrawals for this workspace balance.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="balance-amount">
                {t(
                  "dashboard.balance.amount",
                  withArabicFallback("Amount", "المبلغ"),
                )}
              </Label>
              <Input
                id="balance-amount"
                type="number"
                min="0"
                step="0.01"
                value={balanceAmount}
                onChange={(event) => setBalanceAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance-note">
                {t(
                  "dashboard.balance.note",
                  withArabicFallback("Note (optional)", "ملاحظة (اختياري)"),
                )}
              </Label>
              <Textarea
                id="balance-note"
                value={balanceNote}
                onChange={(event) => setBalanceNote(event.target.value)}
                maxLength={200}
                placeholder={t(
                  "dashboard.balance.notePlaceholder",
                  withArabicFallback(
                    "Reason, reference, or comment",
                    "السبب أو المرجع أو تعليق",
                  ),
                )}
              />
            </div>
            {balanceActionError && (
              <p className="text-sm font-medium text-red-600">
                {balanceActionError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => void applyManualBalanceChange("debit")}
              disabled={isBalanceActionLoading}
            >
              {t(
                "dashboard.balance.withdraw",
                withArabicFallback("Withdraw", "سحب"),
              )}
            </Button>
            <Button
              type="button"
              onClick={() => void applyManualBalanceChange("credit")}
              disabled={isBalanceActionLoading}
            >
              {t(
                "dashboard.balance.deposit",
                withArabicFallback("Deposit", "إيداع"),
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBalanceHistoryOpen}
        onOpenChange={(open) => {
          setIsBalanceHistoryOpen(open);
          if (open) {
            void fetchBalanceHistory();
          }
        }}
      >
        <DialogContent
          dir={isRTL ? "rtl" : "ltr"}
          className={cn(
            "w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto",
            isRTL &&
              "text-right [&_[data-slot=dialog-close]]:left-4 [&_[data-slot=dialog-close]]:right-auto",
          )}
        >
          <DialogHeader className={isRTL ? "text-right sm:text-right" : ""}>
            <DialogTitle>
              {t("dashboard.balance.history", "Balance Transaction History")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "dashboard.balance.historyDesc",
                "Latest manual and system balance transactions.",
              )}
            </DialogDescription>
          </DialogHeader>
          {isBalanceHistoryLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              <span>{t("common.loading", "Loading...")}</span>
            </div>
          ) : balanceTransactions.length > 0 ? (
            <div className="space-y-2">
              {balanceTransactions.map((entry, index) => {
                const key = `${entry.createdAt || "n/a"}-${entry.sourceId || "source"}-${index}`;
                const isCredit = entry.direction === "credit";
                return (
                  <div key={key} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`border-0 ${isCredit ? creditBadgeToneClass : "bg-red-100 text-red-700"}`}
                        >
                          {getBalanceEntryLabel(entry)}
                        </Badge>
                        <span
                          className={`font-semibold ${isCredit ? creditTextToneClass : "text-red-600"}`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatCurrency(entry.amount || 0)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {t("dashboard.balance.after", "Balance after")}:{" "}
                        {formatCurrency(entry.balanceAfter || 0)}
                      </span>
                      <span className="text-muted-foreground">
                        {t(
                          "analytics.byActor",
                          withArabicFallback("By {{name}}", "بواسطة {{name}}"),
                          { name: entry.createdByName || "System" },
                        )}
                      </span>
                      {entry.note ? <span>{entry.note}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                isRTL && "text-right",
              )}
            >
              {t(
                "dashboard.balance.noHistory",
                withArabicFallback(
                  "No balance transactions yet.",
                  "لا توجد معاملات رصيد حتى الآن.",
                ),
              )}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardHome;
