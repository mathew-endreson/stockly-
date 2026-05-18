import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  ShieldAlert,
  Trash2,
  Wallet,
} from "lucide-react";
import {
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { expensesAPI } from "@/services/api";
import SubscriptionLock, { useFeatureAccess } from "@/components/SubscriptionLock";
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_COST_NATURE_OPTIONS,
  EXPENSE_PAYMENT_METHOD_OPTIONS,
  EXPENSE_PAYMENT_SOURCE_OPTIONS,
  EXPENSE_SENSITIVE_CATEGORIES,
  EXPENSE_STATUS_OPTIONS,
  EXPENSE_UTILITY_TYPE_OPTIONS,
} from "@/constants/expenses";
import type {
  Expense,
  ExpenseAnalytics,
  ExpenseAttachment,
  ExpenseCategory,
  ExpenseCostNature,
  ExpenseFilters,
  ExpensePaymentMethod,
  ExpensePaymentSource,
  ExpensePayrollSummary,
  ExpensePayrollWorker,
  ExpenseStatus,
  ExpenseUtilityType,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ExpensesTab = "all" | "reimbursements" | "recurring" | "workers";

type ExpenseFormState = {
  title: string;
  description: string;
  category: ExpenseCategory;
  utilityType: ExpenseUtilityType;
  costNature: ExpenseCostNature;
  amount: string;
  paymentSource: ExpensePaymentSource;
  paymentMethod: ExpensePaymentMethod;
  expenseDate: string;
  dueDate: string;
  status: ExpenseStatus;
  referenceNumber: string;
  vendorName: string;
  vendorPhone: string;
  vendorEmail: string;
  paidByName: string;
  notes: string;
  initialPaidAmount: string;
  initialPaymentNote: string;
  recurringEnabled: boolean;
  recurringFrequency: "weekly" | "monthly" | "quarterly" | "yearly";
  recurringInterval: string;
  recurringDayOfMonth: string;
  attachments: ExpenseAttachment[];
};

type MoneyActionState = {
  amount: string;
  date: string;
  paymentMethod: ExpensePaymentMethod;
  note: string;
  referenceNumber: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const defaultExpenseForm = (): ExpenseFormState => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    description: "",
    category: "utilities",
    utilityType: "electricity",
    costNature: "fixed",
    amount: "",
    paymentSource: "store_funds",
    paymentMethod: "cash",
    expenseDate: today,
    dueDate: "",
    status: "unpaid",
    referenceNumber: "",
    vendorName: "",
    vendorPhone: "",
    vendorEmail: "",
    paidByName: "",
    notes: "",
    initialPaidAmount: "",
    initialPaymentNote: "",
    recurringEnabled: false,
    recurringFrequency: "monthly",
    recurringInterval: "1",
    recurringDayOfMonth: String(new Date().getDate()),
    attachments: [],
  };
};

const defaultMoneyAction = (): MoneyActionState => ({
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash",
  note: "",
  referenceNumber: "",
});

const emptyPayrollSummary = (): ExpensePayrollSummary => ({
  totalAmount: 0,
  paidAmount: 0,
  remainingAmount: 0,
  pendingReimbursements: 0,
  expenseCount: 0,
  workersCount: 0,
});

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ */
/*  Reusable stat card                                                 */
/* ------------------------------------------------------------------ */

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}> = ({ icon, label, value, sub }) => (
  <Card>
    <CardContent className="flex items-center justify-between p-5">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className="shrink-0">{icon}</span>
    </CardContent>
  </Card>
);

/* ================================================================== */
/*  ExpensesPage                                                       */
/* ================================================================== */

const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { formatCurrency } = useCurrencyFormatter();
  const { hasAccess, requiredPlan, loading: featureLoading } = useFeatureAccess("expenses");
  const {
    user,
    canViewExpenses,
    canManageExpenses,
    canApproveExpenses,
    canManageReimbursements,
    canViewSensitiveExpenses,
    canViewBalance,
    canDelete,
  } = useAuth();

  /* ---- state ---- */
  const [activeTab, setActiveTab] = useState<ExpensesTab>("all");
  const [filters, setFilters] = useState<ExpenseFilters>({
    search: "",
    status: "all",
    category: "all",
    paymentSource: "all",
    reimbursementStatus: "all",
    dueState: "all",
  } as ExpenseFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payrollWorkers, setPayrollWorkers] = useState<ExpensePayrollWorker[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<ExpensePayrollSummary>(emptyPayrollSummary());
  const [summary, setSummary] = useState({ totalAmount: 0, paidAmount: 0, remainingAmount: 0, pendingReimbursements: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reimbursementOpen, setReimbursementOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [formState, setFormState] = useState<ExpenseFormState>(defaultExpenseForm());
  const [paymentState, setPaymentState] = useState<MoneyActionState>(defaultMoneyAction());
  const [reimbursementState, setReimbursementState] = useState<MoneyActionState>(defaultMoneyAction());
  const [submitting, setSubmitting] = useState(false);

  const locale = language === "ar" ? "ar-DZ" : language === "fr" ? "fr-FR" : "en-US";

  /* ---- derived ---- */
  const categoryBreakdownRows = useMemo(() => analytics?.byCategory || [], [analytics?.byCategory]);

  const visibleExpenseCategories = useMemo(
    () => EXPENSE_CATEGORY_OPTIONS.filter((o) => !EXPENSE_SENSITIVE_CATEGORIES.has(o.value) || canViewSensitiveExpenses()),
    [canViewSensitiveExpenses],
  );

  const formExpenseCategoryOptions = useMemo(
    () => EXPENSE_CATEGORY_OPTIONS.filter((o) => !EXPENSE_SENSITIVE_CATEGORIES.has(o.value) || canViewSensitiveExpenses()),
    [canViewSensitiveExpenses],
  );

  const teamWorkerOptions = useMemo(
    () => (user?.subUsers || []).filter((m) => m.isActive).map((m) => ({
      userId: m.userId,
      name: m.name || m.email || t("team.worker", "Worker"),
      email: m.email || "",
      role: m.role || "viewer",
    })),
    [t, user?.subUsers],
  );

  const selectedPayrollWorkerValue =
    formState.category === "payroll"
      ? teamWorkerOptions.find((m) => (m.email && m.email === formState.vendorEmail) || m.name === formState.vendorName)?.userId || "manual"
      : "manual";

  const pendingReimbursementAmount =
    selectedExpense && selectedExpense.paymentSource === "outside_store_funds"
      ? Math.max(0, Number(selectedExpense.reimbursementEligibleAmount || 0) - Number(selectedExpense.reimbursedAmount || 0))
      : 0;

  /* ---- api ---- */
  const buildApiFilters = useCallback((): ExpenseFilters => {
    const f: ExpenseFilters = {
      page,
      limit: 20,
      search: filters.search || undefined,
      sort: activeTab === "recurring" ? "recurring.nextOccurrenceDate" : "-expenseDate",
      status: filters.status && filters.status !== "all" ? filters.status : undefined,
      category: filters.category && filters.category !== "all" ? filters.category : undefined,
      paymentSource: filters.paymentSource && filters.paymentSource !== "all" ? filters.paymentSource : undefined,
      reimbursementStatus: filters.reimbursementStatus && filters.reimbursementStatus !== "all" ? filters.reimbursementStatus : undefined,
      dueState: filters.dueState && filters.dueState !== "all" ? filters.dueState : undefined,
    };
    if (activeTab === "reimbursements") {
      f.paymentSource = "outside_store_funds";
      if (!f.reimbursementStatus) f.reimbursementStatus = "pending";
    }
    if (activeTab === "recurring") f.templatesOnly = true;
    return f;
  }, [activeTab, filters, page]);

  const fetchExpenses = useCallback(async () => {
    if (featureLoading || !hasAccess || !canViewExpenses()) return;
    setLoading(true);
    try {
      const [listRes, analyticsRes, payrollRes] = await Promise.all([
        activeTab === "workers" ? Promise.resolve(null) : expensesAPI.getExpenses(buildApiFilters()),
        expensesAPI.getAnalytics(),
        canViewSensitiveExpenses() ? expensesAPI.getPayrollWorkers() : Promise.resolve(null),
      ]);
      setExpenses(listRes?.data.expenses || []);
      setSummary(listRes?.data.summary || { totalAmount: 0, paidAmount: 0, remainingAmount: 0, pendingReimbursements: 0 });
      setPagination(listRes?.data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
      setAnalytics(analyticsRes.data);
      setPayrollWorkers(payrollRes?.data.workers || []);
      setPayrollSummary(payrollRes?.data.summary || emptyPayrollSummary());
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast.error(t("expenses.loadFailed", "Failed to load expenses"));
    } finally {
      setLoading(false);
    }
  }, [activeTab, buildApiFilters, canViewExpenses, canViewSensitiveExpenses, featureLoading, hasAccess, t]);

  useEffect(() => {
    if (featureLoading || !hasAccess || !canViewExpenses()) return;
    void fetchExpenses();
  }, [canViewExpenses, fetchExpenses, featureLoading, hasAccess]);
  useEffect(() => { setPage(1); }, [activeTab]);
  useEffect(() => { if (activeTab === "workers" && !canViewSensitiveExpenses()) setActiveTab("all"); }, [activeTab, canViewSensitiveExpenses]);

  /* ---- dialog openers ---- */
  const openCreateDialog = () => {
    setEditingExpense(null);
    setFormState(defaultExpenseForm());
    setFormOpen(true);
  };

  const openPayrollDialog = (worker?: Partial<ExpensePayrollWorker>) => {
    const today = new Date().toISOString().slice(0, 10);
    setEditingExpense(null);
    setFormState({
      ...defaultExpenseForm(),
      title: worker?.name ? t("expenses.payWorkerTitle", "Worker payment - {{name}}", { name: worker.name }) : t("expenses.payWorkerDefaultTitle", "Worker payment"),
      category: "payroll",
      costNature: "fixed",
      expenseDate: today,
      dueDate: today,
      vendorName: worker?.name || "",
      vendorEmail: worker?.email || "",
    });
    setFormOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setDetailOpen(false);
    setEditingExpense(expense);
    setFormState({
      title: expense.title || "",
      description: expense.description || "",
      category: expense.category || "utilities",
      utilityType: expense.utilityType || "electricity",
      costNature: expense.costNature || "fixed",
      amount: String(expense.amount || ""),
      paymentSource: expense.paymentSource || "store_funds",
      paymentMethod: expense.paymentMethod || "cash",
      expenseDate: toDateInputValue(expense.expenseDate),
      dueDate: toDateInputValue(expense.dueDate),
      status: expense.status || "unpaid",
      referenceNumber: expense.referenceNumber || "",
      vendorName: expense.vendor?.name || "",
      vendorPhone: expense.vendor?.phone || "",
      vendorEmail: expense.vendor?.email || "",
      paidByName: expense.paidByName || "",
      notes: expense.notes || "",
      initialPaidAmount: "",
      initialPaymentNote: "",
      recurringEnabled: Boolean(expense.recurring?.isTemplate),
      recurringFrequency: expense.recurring?.frequency || "monthly",
      recurringInterval: String(expense.recurring?.interval || 1),
      recurringDayOfMonth: String(expense.recurring?.dayOfMonth || new Date().getDate()),
      attachments: expense.attachments || [],
    });
    setFormOpen(true);
  };

  const loadExpenseDetails = async (expenseId: string) => {
    try {
      const response = await expensesAPI.getExpense(expenseId);
      setSelectedExpense(response.data.expense);
      setDetailOpen(true);
    } catch {
      toast.error(t("expenses.detailFailed", "Failed to load expense details"));
    }
  };

  /* ---- form handlers ---- */
  const handleAttachmentFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      const attachments = await Promise.all(files.map(async (file) => ({ url: await fileToDataUrl(file), name: file.name, mimeType: file.type, size: file.size })));
      setFormState((prev) => ({ ...prev, attachments: [...prev.attachments, ...attachments] }));
    } catch {
      toast.error(t("expenses.attachmentFailed", "Failed to read attachment"));
    } finally {
      event.target.value = "";
    }
  };

  const handleRemoveAttachment = (url: string) => {
    setFormState((prev) => ({ ...prev, attachments: prev.attachments.filter((a) => a.url !== url) }));
  };

  const submitExpense = async () => {
    const payload = {
      title: formState.title,
      description: formState.description,
      category: formState.category,
      utilityType: formState.category === "utilities" ? formState.utilityType : undefined,
      costNature: formState.costNature,
      amount: Number(formState.amount || 0),
      paymentSource: formState.paymentSource,
      paymentMethod: formState.paymentMethod,
      expenseDate: formState.expenseDate,
      dueDate: formState.dueDate || undefined,
      status: formState.status,
      referenceNumber: formState.referenceNumber,
      vendor: { name: formState.vendorName, phone: formState.vendorPhone, email: formState.vendorEmail },
      paidByName: formState.paymentSource === "outside_store_funds" ? formState.paidByName : "",
      notes: formState.notes,
      attachments: formState.attachments,
      recurring: {
        isTemplate: formState.recurringEnabled,
        enabled: formState.recurringEnabled,
        frequency: formState.recurringFrequency,
        interval: Number(formState.recurringInterval || 1),
        dayOfMonth: formState.recurringEnabled ? Number(formState.recurringDayOfMonth || 1) : undefined,
        startDate: formState.recurringEnabled ? formState.expenseDate : undefined,
        nextOccurrenceDate: formState.recurringEnabled ? formState.expenseDate : undefined,
      },
    };
    setSubmitting(true);
    try {
      if (editingExpense?._id) {
        await expensesAPI.updateExpense(editingExpense._id, payload);
        toast.success(t("expenses.updated", "Expense updated"));
      } else {
        await expensesAPI.createExpense({ ...payload, initialPaidAmount: Number(formState.initialPaidAmount || 0), initialPaymentNote: formState.initialPaymentNote });
        toast.success(t("expenses.created", "Expense created"));
      }
      setFormOpen(false);
      setEditingExpense(null);
      setFormState(defaultExpenseForm());
      await fetchExpenses();
    } catch (error) {
      console.error(error);
      toast.error(t("expenses.saveFailed", "Failed to save expense"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitPayment = async () => {
    if (!selectedExpense?._id) return;
    const amount = Number(paymentState.amount || 0);
    if (amount <= 0) {
      toast.error(t("expenses.invalidAmount", "Please enter a valid amount"));
      return;
    }
    if (amount > selectedExpense.remainingAmount + 0.01) {
      toast.error(t("expenses.amountExceedsRemaining", "Amount exceeds the remaining balance of {{value}}", { value: formatCurrency(selectedExpense.remainingAmount) }));
      return;
    }
    setSubmitting(true);
    try {
      const response = await expensesAPI.recordPayment(selectedExpense._id, {
        amount,
        paidAt: paymentState.date,
        paymentMethod: paymentState.paymentMethod,
        note: paymentState.note,
        referenceNumber: paymentState.referenceNumber,
      });
      setSelectedExpense(response.data.expense);
      setPaymentOpen(false);
      setPaymentState(defaultMoneyAction());
      toast.success(t("expenses.paymentRecorded", "Payment recorded"));
      await fetchExpenses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t("expenses.paymentFailed", "Failed to record payment"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReimbursement = async () => {
    if (!selectedExpense?._id) return;
    const amount = Number(reimbursementState.amount || 0);
    if (amount <= 0) {
      toast.error(t("expenses.invalidAmount", "Please enter a valid amount"));
      return;
    }
    if (amount > pendingReimbursementAmount + 0.01) {
      toast.error(t("expenses.amountExceedsPending", "Amount exceeds the pending reimbursement of {{value}}", { value: formatCurrency(pendingReimbursementAmount) }));
      return;
    }
    setSubmitting(true);
    try {
      const response = await expensesAPI.recordReimbursement(selectedExpense._id, {
        amount,
        reimbursedAt: reimbursementState.date,
        paymentMethod: reimbursementState.paymentMethod,
        note: reimbursementState.note,
        referenceNumber: reimbursementState.referenceNumber,
      });
      setSelectedExpense(response.data.expense);
      setReimbursementOpen(false);
      setReimbursementState(defaultMoneyAction());
      toast.success(t("expenses.reimbursementRecorded", "Reimbursement recorded"));
      await fetchExpenses();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || t("expenses.reimbursementFailed", "Failed to record reimbursement"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    try {
      const response = await expensesAPI.approveExpense(expenseId);
      setSelectedExpense(response.data.expense);
      toast.success(t("expenses.approved", "Expense approved"));
      await fetchExpenses();
    } catch {
      toast.error(t("expenses.approveFailed", "Failed to approve expense"));
    }
  };

  const handleCancelExpense = async (expenseId: string) => {
    try {
      const response = await expensesAPI.cancelExpense(expenseId);
      setSelectedExpense(response.data.expense);
      toast.success(t("expenses.cancelled", "Expense cancelled"));
      await fetchExpenses();
    } catch {
      toast.error(t("expenses.cancelFailed", "Failed to cancel expense"));
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm(t("expenses.deleteConfirm", "Delete this expense?"))) return;
    try {
      await expensesAPI.deleteExpense(expenseId);
      setDetailOpen(false);
      toast.success(t("expenses.deleted", "Expense deleted"));
      await fetchExpenses();
    } catch {
      toast.error(t("expenses.deleteFailed", "Failed to delete expense"));
    }
  };

  const handleGenerateRecurring = async () => {
    try {
      const response = await expensesAPI.generateRecurring();
      toast.success(t("expenses.generatedRecurring", "Generated {{count}} recurring expenses", { count: response.data.generated || 0 }));
      await fetchExpenses();
    } catch {
      toast.error(t("expenses.generateRecurringFailed", "Failed to generate recurring expenses"));
    }
  };

  const handleExport = async () => {
    try {
      const blob = await expensesAPI.exportExpenses();
      downloadBlob(blob, "expenses.csv");
    } catch {
      toast.error(t("expenses.exportFailed", "Failed to export expenses"));
    }
  };

  if (featureLoading) return null;
  if (!hasAccess) {
    return (
      <SubscriptionLock
        feature="expenses"
        requiredPlan={requiredPlan}
        description="Upgrade to access the expenses system in this workspace."
      />
    );
  }

  /* ---- access guard ---- */
  if (!canViewExpenses()) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{t("expenses.noAccess", "You do not have access to the expenses module.")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="page-shell">
      {/* ---- header ---- */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold">{t("expenses.title", "Expenses")}</h1>
          <p className="text-muted-foreground">{t("expenses.subtitle", "Track operating costs, reimbursements, and recurring obligations.")}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void fetchExpenses()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {t("common.refresh", "Refresh")}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" />
            {t("common.export", "Export")}
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void handleGenerateRecurring()}>
            <Repeat className="mr-2 h-4 w-4" />
            {t("expenses.generateRecurring", "Generate Recurring")}
          </Button>
          {canManageExpenses() && (
            <Button className="w-full sm:w-auto" onClick={activeTab === "workers" && canViewSensitiveExpenses() ? () => openPayrollDialog() : openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {activeTab === "workers" && canViewSensitiveExpenses() ? t("expenses.newWorkerPayment", "New Worker Payment") : t("expenses.new", "New Expense")}
            </Button>
          )}
        </div>
      </div>

      {/* ---- summary cards ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<CircleDollarSign className="h-5 w-5 text-primary" />} label={t("expenses.thisMonth", "This Month")} value={formatCurrency(analytics?.overview.totalAmount || 0)} />
        <StatCard icon={<Wallet className="h-5 w-5 text-emerald-600" />} label={t("expenses.paidVsUnpaid", "Paid vs Unpaid")} value={formatCurrency(analytics?.overview.totalPaid || 0)} sub={t("expenses.remainingLabel", "{{value}} remaining", { value: formatCurrency(analytics?.overview.totalRemaining || 0) })} />
        <StatCard icon={<Repeat className="h-5 w-5 text-amber-600" />} label={t("expenses.pendingReimbursements", "Pending Reimbursements")} value={formatCurrency(analytics?.overview.pendingReimbursements || 0)} />
        <StatCard icon={<Check className="h-5 w-5 text-blue-600" />} label={t("expenses.netAfterExpenses", "Net After Expenses")} value={formatCurrency(analytics?.overview.netAfterExpenses || 0)} sub={t("expenses.grossProfitHint", "Gross profit minus paid expenses")} />
      </div>

      {/* ---- tabs ---- */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExpensesTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">{t("expenses.allTab", "All Expenses")}</TabsTrigger>
          <TabsTrigger value="reimbursements">{t("expenses.reimbursementsTab", "Reimbursements")}</TabsTrigger>
          <TabsTrigger value="recurring">{t("expenses.recurringTab", "Recurring")}</TabsTrigger>
          {canViewSensitiveExpenses() && <TabsTrigger value="workers">{t("expenses.workersTab", "Workers")}</TabsTrigger>}
        </TabsList>
      </Tabs>

      {/* ---- workers tab content ---- */}
      {activeTab === "workers" && canViewSensitiveExpenses() ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: t("expenses.workersPaidTotal", "Worker Payroll"), value: formatCurrency(payrollSummary.totalAmount) },
              { label: t("expenses.workersPaidAmount", "Paid"), value: formatCurrency(payrollSummary.paidAmount) },
              { label: t("expenses.workersOutstanding", "Outstanding"), value: formatCurrency(payrollSummary.remainingAmount) },
              { label: t("expenses.workersPendingReimbursement", "Pending Reimb."), value: formatCurrency(payrollSummary.pendingReimbursements) },
              { label: t("expenses.workersTracked", "Workers"), value: String(payrollWorkers.length) },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("expenses.workersTableTitle", "Workers Payment Table")}</CardTitle>
              <CardDescription>{t("expenses.workersTableDesc", "Payroll grouped by worker. Same entries also appear in All Expenses.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="table-responsive rounded-md border">
                <Table className="min-w-[780px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("expenses.worker", "Worker")}</TableHead>
                      <TableHead>{t("expenses.amount", "Amount")}</TableHead>
                      <TableHead>{t("expenses.paid", "Paid")}</TableHead>
                      <TableHead>{t("expenses.remaining", "Remaining")}</TableHead>
                      <TableHead>{t("expenses.lastPayment", "Last Payment")}</TableHead>
                      <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                    ) : payrollWorkers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t("expenses.noWorkersPayroll", "No worker payments recorded yet.")}</TableCell></TableRow>
                    ) : (
                      payrollWorkers.map((worker) => (
                        <TableRow key={worker.workerKey}>
                          <TableCell>
                            <p className="font-medium">{worker.name}</p>
                            <p className="text-xs text-muted-foreground">{worker.email || t("expenses.manualPayrollWorker", "Manual entry")}</p>
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(worker.totalAmount)}</TableCell>
                          <TableCell>
                            <p className="font-medium">{formatCurrency(worker.paidAmount)}</p>
                            <p className="text-xs text-muted-foreground">{worker.expenseCount} {t("expenses.entries", "entries")}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{formatCurrency(worker.remainingAmount)}</p>
                            {worker.pendingReimbursements > 0 && <p className="text-xs text-muted-foreground">{formatCurrency(worker.pendingReimbursements)} {t("expenses.reimbursable", "reimbursable")}</p>}
                          </TableCell>
                          <TableCell>{worker.lastPaidAt ? new Date(worker.lastPaidAt).toLocaleDateString(locale) : "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {canManageExpenses() && <Button variant="ghost" size="icon" onClick={() => openPayrollDialog(worker)}><Wallet className="h-4 w-4" /></Button>}
                              {worker.latestExpenseId && <Button variant="ghost" size="icon" onClick={() => void loadExpenseDetails(worker.latestExpenseId || "")}><Eye className="h-4 w-4" /></Button>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ---- expense list tab ---- */
        <div className="space-y-4">
          {/* filters card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={String(filters.search || "")} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder={t("common.search", "Search...")} />
                </div>
                <Select value={String(filters.status || "all")} onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={String(filters.category || "all")} onValueChange={(v) => setFilters((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("expenses.category", "Category")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("expenses.allCategories", "All categories")}</SelectItem>
                    {visibleExpenseCategories.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(filters.paymentSource || "all")} onValueChange={(v) => setFilters((p) => ({ ...p, paymentSource: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("expenses.paymentSource", "Source")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("expenses.allSources", "All sources")}</SelectItem>
                    {EXPENSE_PAYMENT_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                <Select value={String(filters.reimbursementStatus || "all")} onValueChange={(v) => setFilters((p) => ({ ...p, reimbursementStatus: v }))}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder={t("expenses.reimbursement", "Reimbursement")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("expenses.allReimbursements", "All reimbursement states")}</SelectItem>
                    <SelectItem value="pending">{t("expenses.pending", "Pending")}</SelectItem>
                    <SelectItem value="partially_reimbursed">{t("expenses.partial", "Partial")}</SelectItem>
                    <SelectItem value="reimbursed">{t("expenses.reimbursed", "Reimbursed")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(filters.dueState || "all")} onValueChange={(v) => setFilters((p) => ({ ...p, dueState: v }))}>
                  <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={t("expenses.dueFilter", "Due filter")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("expenses.allDueStates", "All due states")}</SelectItem>
                    <SelectItem value="overdue">{t("expenses.overdue", "Overdue")}</SelectItem>
                    <SelectItem value="due_soon">{t("expenses.dueSoon", "Due soon")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* filtered summary */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t("expenses.filteredTotal", "Total"), value: formatCurrency(summary.totalAmount) },
              { label: t("expenses.filteredPaid", "Paid"), value: formatCurrency(summary.paidAmount) },
              { label: t("expenses.filteredRemaining", "Remaining"), value: formatCurrency(summary.remainingAmount) },
              { label: t("expenses.filteredReimbursements", "Reimbursements"), value: formatCurrency(summary.pendingReimbursements) },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-lg font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* expense table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{t("expenses.register", "Expense Register")}</CardTitle>
              <CardDescription>{t("expenses.registerDesc", "Operating costs and worker payments.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="table-responsive rounded-md border">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("expenses.expense", "Expense")}</TableHead>
                      <TableHead>{t("expenses.amount", "Amount")}</TableHead>
                      <TableHead>{t("expenses.statusLabel", "Status")}</TableHead>
                      <TableHead>{t("expenses.source", "Source")}</TableHead>
                      <TableHead>{t("expenses.due", "Due")}</TableHead>
                      <TableHead className="text-right">{t("common.actions", "Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                    ) : expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center">
                          <CircleDollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="font-medium">{t("expenses.empty", "No expenses found.")}</p>
                        </TableCell>
                      </TableRow>
                    ) : expenses.map((exp) => (
                      <TableRow key={exp._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{exp.title}</p>
                            {exp.category === "payroll" && <Badge variant="default" className="text-[10px]">{t("expenses.workerPayment", "Worker")}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{exp.expenseNumber} &middot; {exp.category.replace(/_/g, " ")}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{formatCurrency(exp.amount)}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(exp.paidAmount)} {t("expenses.paid", "paid")}</p>
                        </TableCell>
                        <TableCell><Badge variant={exp.status === "paid" ? "default" : "outline"}>{exp.status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-sm">{exp.paymentSource.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          <p className="text-sm">{exp.dueDate ? new Date(exp.dueDate).toLocaleDateString(locale) : "-"}</p>
                          {exp.isOverdue && <p className="text-xs text-red-600">{t("expenses.overdue", "Overdue")}</p>}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void loadExpenseDetails(exp._id)}>
                                <Eye className="mr-2 h-4 w-4" />{t("expenses.viewDetails", "View Details")}
                              </DropdownMenuItem>
                              {canManageExpenses() && (
                                <DropdownMenuItem onClick={() => openEditDialog(exp)}>
                                  <Pencil className="mr-2 h-4 w-4" />{t("common.edit", "Edit")}
                                </DropdownMenuItem>
                              )}
                              {canManageExpenses() && exp.status !== "cancelled" && exp.status !== "paid" && (
                                <DropdownMenuItem onClick={() => { void loadExpenseDetails(exp._id).then(() => setPaymentOpen(true)); }}>
                                  <Wallet className="mr-2 h-4 w-4" />{t("expenses.recordPayment", "Record Payment")}
                                </DropdownMenuItem>
                              )}
                              {canManageReimbursements() && exp.paymentSource === "outside_store_funds" && exp.status !== "cancelled" && (
                                <DropdownMenuItem onClick={() => { void loadExpenseDetails(exp._id).then(() => setReimbursementOpen(true)); }}>
                                  <Repeat className="mr-2 h-4 w-4" />{t("expenses.recordReimbursement", "Record Reimbursement")}
                                </DropdownMenuItem>
                              )}
                              {canApproveExpenses() && !exp.approval?.isApproved && exp.status !== "cancelled" && (
                                <DropdownMenuItem onClick={() => void handleApproveExpense(exp._id)}>
                                  <Check className="mr-2 h-4 w-4" />{t("expenses.approve", "Approve")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {canDelete() && exp.status !== "cancelled" && (
                                <DropdownMenuItem onClick={() => void handleCancelExpense(exp._id)}>
                                  <AlertTriangle className="mr-2 h-4 w-4" />{t("common.cancel", "Cancel")}
                                </DropdownMenuItem>
                              )}
                              {canDelete() && (
                                <DropdownMenuItem className="text-destructive" onClick={() => void handleDeleteExpense(exp._id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />{t("common.delete", "Delete")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>{t("expenses.pagination", "Showing {{current}} of {{total}}", { current: expenses.length, total: pagination.total })}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>{t("common.previous", "Previous")}</Button>
                  <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((v) => v + 1)}>{t("common.next", "Next")}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---- bottom cards ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("expenses.categories", "By Category")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoryBreakdownRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("expenses.noCategoryData", "No category data yet.")}</p>
            ) : categoryBreakdownRows.slice(0, 6).map((item) => (
              <div key={item.category} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium capitalize">{item.category.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{item.count} {t("expenses.entries", "entries")}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">{formatCurrency(item.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(item.paidAmount)} {t("expenses.paid", "paid")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("expenses.pendingWidget", "Pending Reimbursements")}</CardTitle>
            <CardDescription>{t("expenses.pendingWidgetDesc", "Out-of-pocket spending still owed by the store.")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(analytics?.pendingReimbursementsList || []).length > 0 ? analytics?.pendingReimbursementsList.map((exp) => (
              <button key={exp._id} type="button" onClick={() => void loadExpenseDetails(exp._id)} className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-xs text-muted-foreground">{exp.paidByName || exp.expenseNumber}</p>
                </div>
                <p className="shrink-0 font-medium">{formatCurrency(Math.max(0, Number(exp.reimbursementEligibleAmount || 0) - Number(exp.reimbursedAmount || 0)))}</p>
              </button>
            )) : (
              <p className="text-sm text-muted-foreground">{t("expenses.noPendingReimbursements", "No pending reimbursements.")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  DIALOGS                                                         */}
      {/* ================================================================ */}

      {/* ---- create/edit form ---- */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? t("expenses.edit", "Edit Expense") : t("expenses.create", "Create Expense")}</DialogTitle>
            <DialogDescription>{t("expenses.formDesc", "Capture expense details, payment source, and optional recurring schedule.")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("expenses.expenseTitle", "Title")}</Label>
              <Input value={formState.title} onChange={(e) => setFormState((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.amount", "Amount")}</Label>
              <Input type="number" value={formState.amount} onChange={(e) => setFormState((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.category", "Category")}</Label>
              <Select value={formState.category} onValueChange={(v) => setFormState((p) => ({ ...p, category: v as ExpenseCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{formExpenseCategoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.costNature", "Cost Nature")}</Label>
              <Select value={formState.costNature} onValueChange={(v) => setFormState((p) => ({ ...p, costNature: v as ExpenseCostNature }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_COST_NATURE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.paymentSource", "Payment Source")}</Label>
              <Select value={formState.paymentSource} onValueChange={(v) => setFormState((p) => ({ ...p, paymentSource: v as ExpensePaymentSource }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_PAYMENT_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.paymentMethod", "Payment Method")}</Label>
              <Select value={formState.paymentMethod} onValueChange={(v) => setFormState((p) => ({ ...p, paymentMethod: v as ExpensePaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_PAYMENT_METHOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.expenseDate", "Expense Date")}</Label>
              <Input type="date" value={formState.expenseDate} onChange={(e) => setFormState((p) => ({ ...p, expenseDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.due", "Due Date")}</Label>
              <Input type="date" value={formState.dueDate} onChange={(e) => setFormState((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            {formState.category === "utilities" && (
              <div className="space-y-1">
                <Label>{t("expenses.utilityType", "Utility Type")}</Label>
                <Select value={formState.utilityType} onValueChange={(v) => setFormState((p) => ({ ...p, utilityType: v as ExpenseUtilityType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_UTILITY_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {formState.category === "payroll" && (
              <div className="space-y-1 sm:col-span-2">
                <Label>{t("expenses.workerSelection", "Pay Worker")}</Label>
                <Select value={selectedPayrollWorkerValue} onValueChange={(v) => {
                  if (v === "manual") { setFormState((p) => ({ ...p, vendorName: "", vendorEmail: "" })); return; }
                  const w = teamWorkerOptions.find((m) => m.userId === v);
                  if (!w) return;
                  setFormState((p) => ({ ...p, vendorName: w.name, vendorEmail: w.email }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t("expenses.manualWorker", "Manual worker (outside Stockly)")}</SelectItem>
                    {teamWorkerOptions.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}{m.role ? ` — ${m.role}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{formState.category === "payroll" ? t("expenses.workerName", "Worker Name") : t("expenses.vendor", "Vendor / Payee")}</Label>
              <Input value={formState.vendorName} onChange={(e) => setFormState((p) => ({ ...p, vendorName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{formState.category === "payroll" ? t("expenses.workerPhone", "Worker Phone") : t("expenses.vendorPhone", "Vendor Phone")}</Label>
              <Input value={formState.vendorPhone} onChange={(e) => setFormState((p) => ({ ...p, vendorPhone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{formState.category === "payroll" ? t("expenses.workerEmail", "Worker Email") : t("expenses.vendorEmail", "Vendor Email")}</Label>
              <Input value={formState.vendorEmail} onChange={(e) => setFormState((p) => ({ ...p, vendorEmail: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("expenses.reference", "Reference")}</Label>
              <Input value={formState.referenceNumber} onChange={(e) => setFormState((p) => ({ ...p, referenceNumber: e.target.value }))} />
            </div>
            {formState.paymentSource === "outside_store_funds" && (
              <div className="space-y-1">
                <Label>{t("expenses.paidBy", "Paid By")}</Label>
                <Input value={formState.paidByName} onChange={(e) => setFormState((p) => ({ ...p, paidByName: e.target.value }))} />
              </div>
            )}
            {!editingExpense && (
              <>
                <div className="space-y-1">
                  <Label>{t("expenses.initialPaid", "Initial Paid Amount")}</Label>
                  <Input type="number" value={formState.initialPaidAmount} onChange={(e) => setFormState((p) => ({ ...p, initialPaidAmount: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("expenses.initialPaymentNote", "Payment Note")}</Label>
                  <Input value={formState.initialPaymentNote} onChange={(e) => setFormState((p) => ({ ...p, initialPaymentNote: e.target.value }))} />
                </div>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label>{t("expenses.notes", "Notes")}</Label>
            <Textarea value={formState.notes} onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))} rows={2} />
          </div>
          <div className="rounded-md border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("expenses.recurringTemplate", "Recurring Template")}</p>
                <p className="text-xs text-muted-foreground">{t("expenses.recurringTemplateDesc", "For rent, internet, payroll, and other repeating expenses.")}</p>
              </div>
              <Checkbox checked={formState.recurringEnabled} onCheckedChange={(c) => setFormState((p) => ({ ...p, recurringEnabled: Boolean(c) }))} />
            </div>
            {formState.recurringEnabled && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>{t("expenses.frequency", "Frequency")}</Label>
                  <Select value={formState.recurringFrequency} onValueChange={(v) => setFormState((p) => ({ ...p, recurringFrequency: v as ExpenseFormState["recurringFrequency"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("expenses.interval", "Interval")}</Label>
                  <Input type="number" value={formState.recurringInterval} onChange={(e) => setFormState((p) => ({ ...p, recurringInterval: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("expenses.dayOfMonth", "Day of Month")}</Label>
                  <Input type="number" value={formState.recurringDayOfMonth} onChange={(e) => setFormState((p) => ({ ...p, recurringDayOfMonth: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>{t("expenses.attachments", "Attachments")}</Label>
            <Input type="file" multiple onChange={handleAttachmentFiles} />
            {formState.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {formState.attachments.map((a) => (
                  <Badge key={a.url} variant="secondary" className="gap-1">
                    {a.name || t("expenses.attachment", "Attachment")}
                    <button type="button" onClick={() => handleRemoveAttachment(a.url)}>×</button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {formState.paymentSource === "store_funds" && canViewBalance() && !editingExpense && (
            <Alert><AlertDescription className="text-blue-700">{t("expenses.balancePreview", "This will reduce store balance by {{value}} when paid.", { value: formatCurrency(Number(formState.initialPaidAmount || 0)) })}</AlertDescription></Alert>
          )}
          {formState.paymentSource === "outside_store_funds" && !editingExpense && (
            <Alert><AlertDescription className="text-amber-700">{t("expenses.reimbursementPreview", "This will create a reimbursement obligation of {{value}} once paid.", { value: formatCurrency(Number(formState.initialPaidAmount || 0)) })}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={() => void submitExpense()} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingExpense ? t("common.save", "Save") : t("common.create", "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- detail dialog ---- */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {selectedExpense && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedExpense.title}</DialogTitle>
                <DialogDescription>{selectedExpense.expenseNumber}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("expenses.total", "Total")}</p><p className="text-lg font-bold">{formatCurrency(selectedExpense.amount)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("expenses.paid", "Paid")}</p><p className="text-lg font-bold">{formatCurrency(selectedExpense.paidAmount)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{t("expenses.remaining", "Remaining")}</p><p className="text-lg font-bold">{formatCurrency(selectedExpense.remainingAmount)}</p></CardContent></Card>
              </div>
              <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <p><span className="font-medium">{t("expenses.category", "Category")}:</span> {selectedExpense.category.replace(/_/g, " ")}</p>
                <p><span className="font-medium">{t("expenses.statusLabel", "Status")}:</span> {selectedExpense.status.replace(/_/g, " ")}</p>
                <p><span className="font-medium">{t("expenses.paymentSource", "Source")}:</span> {selectedExpense.paymentSource.replace(/_/g, " ")}</p>
                <p><span className="font-medium">{t("expenses.paymentMethod", "Method")}:</span> {selectedExpense.paymentMethod}</p>
                <p><span className="font-medium">{t("expenses.expenseDate", "Expense date")}:</span> {new Date(selectedExpense.expenseDate).toLocaleDateString(locale)}</p>
                <p><span className="font-medium">{t("expenses.due", "Due")}:</span> {selectedExpense.dueDate ? new Date(selectedExpense.dueDate).toLocaleDateString(locale) : "-"}</p>
                <p><span className="font-medium">{t("expenses.reimbursementStatus", "Reimbursement")}:</span> {selectedExpense.reimbursementStatus.replace(/_/g, " ")}</p>
                {selectedExpense.vendor?.name && <p><span className="font-medium">{t("expenses.vendor", "Vendor")}:</span> {selectedExpense.vendor.name}</p>}
                {selectedExpense.paidByName && <p><span className="font-medium">{t("expenses.paidBy", "Paid by")}:</span> {selectedExpense.paidByName}</p>}
                {selectedExpense.referenceNumber && <p><span className="font-medium">{t("expenses.reference", "Reference")}:</span> {selectedExpense.referenceNumber}</p>}
                {selectedExpense.balanceImpact && canViewBalance() && <p><span className="font-medium">{t("expenses.balanceImpact", "Balance impact")}:</span> {formatCurrency(selectedExpense.balanceImpact.totalApplied)}</p>}
              </div>
              {selectedExpense.notes && <div className="rounded-md border p-3 text-sm">{selectedExpense.notes}</div>}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t("expenses.paymentHistory", "Payment History")}</h3>
                  {(selectedExpense.payments || []).length > 0 ? selectedExpense.payments?.map((p) => (
                    <div key={p._id || `${p.amount}-${p.paidAt}`} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-muted-foreground">{p.paidAt ? new Date(p.paidAt).toLocaleDateString(locale) : "-"}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">{t("expenses.noPayments", "No payments yet.")}</p>}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t("expenses.reimbursementHistory", "Reimbursement History")}</h3>
                  {(selectedExpense.reimbursements || []).length > 0 ? selectedExpense.reimbursements?.map((r) => (
                    <div key={r._id || `${r.amount}-${r.reimbursedAt}`} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{formatCurrency(r.amount)}</p>
                      <p className="text-xs text-muted-foreground">{r.reimbursedAt ? new Date(r.reimbursedAt).toLocaleDateString(locale) : "-"}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">{t("expenses.noReimbursements", "No reimbursements yet.")}</p>}
                </div>
              </div>
              <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {canManageExpenses() && selectedExpense.status !== "cancelled" && (
                    <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}><Wallet className="mr-2 h-4 w-4" />{t("expenses.recordPayment", "Record Payment")}</Button>
                  )}
                  {canManageReimbursements() && selectedExpense.paymentSource === "outside_store_funds" && pendingReimbursementAmount > 0.001 && (
                    <Button variant="outline" size="sm" onClick={() => setReimbursementOpen(true)}><Repeat className="mr-2 h-4 w-4" />{t("expenses.recordReimbursement", "Record Reimbursement")}</Button>
                  )}
                  {canApproveExpenses() && !selectedExpense.approval?.isApproved && (
                    <Button variant="outline" size="sm" onClick={() => void handleApproveExpense(selectedExpense._id)}><Check className="mr-2 h-4 w-4" />{t("expenses.approve", "Approve")}</Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManageExpenses() && <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedExpense)}><Pencil className="mr-2 h-4 w-4" />{t("common.edit", "Edit")}</Button>}
                  {canDelete() && <Button variant="outline" size="sm" onClick={() => void handleCancelExpense(selectedExpense._id)}><AlertTriangle className="mr-2 h-4 w-4" />{t("common.cancel", "Cancel")}</Button>}
                  {canDelete() && <Button variant="destructive" size="sm" onClick={() => void handleDeleteExpense(selectedExpense._id)}><Trash2 className="mr-2 h-4 w-4" />{t("common.delete", "Delete")}</Button>}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- payment dialog ---- */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("expenses.recordPayment", "Record Payment")}</DialogTitle>
            <DialogDescription>{t("expenses.recordPaymentDesc", "Add a payment against this expense.")}</DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("expenses.remaining", "Remaining")}</p>
                <p className="text-lg font-bold">{formatCurrency(selectedExpense.remainingAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("expenses.total", "Total")}</p>
                <p className="text-sm font-medium">{formatCurrency(selectedExpense.amount)}</p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>{t("expenses.amount", "Amount")}</Label>
                {selectedExpense && selectedExpense.remainingAmount > 0 && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setPaymentState((p) => ({ ...p, amount: String(selectedExpense.remainingAmount) }))}>
                    {t("expenses.payFullAmount", "Pay Full Amount")}
                  </Button>
                )}
              </div>
              <Input
                type="number"
                min={0}
                max={selectedExpense?.remainingAmount || undefined}
                step="0.01"
                value={paymentState.amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (selectedExpense && Number(val) > selectedExpense.remainingAmount) {
                    setPaymentState((p) => ({ ...p, amount: String(selectedExpense.remainingAmount) }));
                  } else {
                    setPaymentState((p) => ({ ...p, amount: val }));
                  }
                }}
              />
              {selectedExpense && Number(paymentState.amount || 0) > selectedExpense.remainingAmount && (
                <p className="text-xs text-destructive">{t("expenses.amountExceedsRemaining", "Amount exceeds the remaining balance of {{value}}", { value: formatCurrency(selectedExpense.remainingAmount) })}</p>
              )}
            </div>
            <div className="space-y-1"><Label>{t("expenses.date", "Date")}</Label><Input type="date" value={paymentState.date} onChange={(e) => setPaymentState((p) => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>{t("expenses.paymentMethod", "Payment Method")}</Label>
              <Select value={paymentState.paymentMethod} onValueChange={(v) => setPaymentState((p) => ({ ...p, paymentMethod: v as ExpensePaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_PAYMENT_METHOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("expenses.reference", "Reference")}</Label><Input value={paymentState.referenceNumber} onChange={(e) => setPaymentState((p) => ({ ...p, referenceNumber: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{t("expenses.note", "Note")}</Label><Textarea value={paymentState.note} onChange={(e) => setPaymentState((p) => ({ ...p, note: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={() => void submitPayment()} disabled={submitting || Number(paymentState.amount || 0) <= 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("expenses.savePayment", "Save Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- reimbursement dialog ---- */}
      <Dialog open={reimbursementOpen} onOpenChange={setReimbursementOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("expenses.recordReimbursement", "Record Reimbursement")}</DialogTitle>
            <DialogDescription>{t("expenses.recordReimbursementDesc", "Mark part or all of the out-of-pocket amount as reimbursed.")}</DialogDescription>
          </DialogHeader>
          {selectedExpense && pendingReimbursementAmount > 0 && (
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t("expenses.pendingReimbursement", "Pending Reimbursement")}</p>
                <p className="text-lg font-bold">{formatCurrency(pendingReimbursementAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("expenses.eligible", "Eligible")}</p>
                <p className="text-sm font-medium">{formatCurrency(selectedExpense.reimbursementEligibleAmount || 0)}</p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>{t("expenses.amount", "Amount")}</Label>
                {pendingReimbursementAmount > 0 && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setReimbursementState((p) => ({ ...p, amount: String(pendingReimbursementAmount) }))}>
                    {t("expenses.reimburseFullAmount", "Reimburse Full Amount")}
                  </Button>
                )}
              </div>
              <Input
                type="number"
                min={0}
                max={pendingReimbursementAmount || undefined}
                step="0.01"
                value={reimbursementState.amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (Number(val) > pendingReimbursementAmount) {
                    setReimbursementState((p) => ({ ...p, amount: String(pendingReimbursementAmount) }));
                  } else {
                    setReimbursementState((p) => ({ ...p, amount: val }));
                  }
                }}
              />
              {Number(reimbursementState.amount || 0) > pendingReimbursementAmount && (
                <p className="text-xs text-destructive">{t("expenses.amountExceedsPending", "Amount exceeds the pending reimbursement of {{value}}", { value: formatCurrency(pendingReimbursementAmount) })}</p>
              )}
            </div>
            <div className="space-y-1"><Label>{t("expenses.date", "Date")}</Label><Input type="date" value={reimbursementState.date} onChange={(e) => setReimbursementState((p) => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>{t("expenses.paymentMethod", "Payment Method")}</Label>
              <Select value={reimbursementState.paymentMethod} onValueChange={(v) => setReimbursementState((p) => ({ ...p, paymentMethod: v as ExpensePaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_PAYMENT_METHOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("expenses.reference", "Reference")}</Label><Input value={reimbursementState.referenceNumber} onChange={(e) => setReimbursementState((p) => ({ ...p, referenceNumber: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{t("expenses.note", "Note")}</Label><Textarea value={reimbursementState.note} onChange={(e) => setReimbursementState((p) => ({ ...p, note: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReimbursementOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={() => void submitReimbursement()} disabled={submitting || Number(reimbursementState.amount || 0) <= 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("expenses.saveReimbursement", "Save Reimbursement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpensesPage;
