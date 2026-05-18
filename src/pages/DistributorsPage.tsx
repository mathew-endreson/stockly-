import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeDollarSign,
  Building2,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import ClientWholesaleTab from "@/components/clients/ClientWholesaleTab";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { distributorsAPI } from "@/services/api";
import SubscriptionLock, { useFeatureAccess } from "@/components/SubscriptionLock";
import type {
  ClientRecord,
  DistributorRecord,
  DistributorsOverviewData,
} from "@/types";

type DistributorFormState = {
  name: string;
  email: string;
  phone: string;
  supplierCode: string;
  paymentTerms: string;
  defaultCurrency: string;
  notes: string;
};

const createFormState = (currency = "DZD"): DistributorFormState => ({
  name: "",
  email: "",
  phone: "",
  supplierCode: "",
  paymentTerms: "",
  defaultCurrency: currency,
  notes: "",
});

const toWorkspaceRecord = (distributor: DistributorRecord): ClientRecord => ({
  id: distributor.id,
  profileId: distributor.profileId,
  clientKey: distributor.clientKey,
  name: distributor.name,
  email: distributor.email,
  phone: distributor.phone,
  isWholesaler: distributor.isWholesaler,
  supplierCode: distributor.supplierCode,
  paymentTerms: distributor.paymentTerms,
  defaultCurrency: distributor.defaultCurrency,
  supplierTaxRegime: distributor.supplierTaxRegime,
  defaultPurchaseTaxRate: distributor.defaultPurchaseTaxRate,
  nif: distributor.nif,
  rc: distributor.rc,
  nis: distributor.nis,
  ai: distributor.ai,
  pricingTier: "default",
  notes: distributor.notes,
  tags: [],
  addedManually: true,
  debt: {
    isMarked: false,
    hasDebt: distributor.balanceDue > 0,
    manualAmount: 0,
    invoiceOutstanding: 0,
    totalDebt: distributor.balanceDue,
    note: "",
    markedAt: null,
  },
  metrics: {
    totalOrders: 0,
    purchasedOrders: 0,
    totalSpent: 0,
    totalItemsPurchased: 0,
    reversedOrders: 0,
    totalInvoices: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    overdueInvoices: 0,
    totalReturns: 0,
    totalReturnedItems: 0,
    totalRefundAmount: 0,
    returnRate: 0,
    lastPurchaseAt: distributor.lastPurchaseAt,
    topProducts: [],
  },
});

const applyDistributorPatch = (
  distributor: DistributorRecord,
  patch: Partial<ClientRecord>,
): DistributorRecord => ({
  ...distributor,
  id: typeof patch.id === "string" && patch.id ? patch.id : distributor.id,
  profileId:
    typeof patch.profileId === "string" && patch.profileId
      ? patch.profileId
      : distributor.profileId,
  clientKey:
    typeof patch.clientKey === "string" && patch.clientKey
      ? patch.clientKey
      : distributor.clientKey,
  name:
    typeof patch.name === "string" && patch.name
      ? patch.name
      : distributor.name,
  email: typeof patch.email === "string" ? patch.email : distributor.email,
  phone: typeof patch.phone === "string" ? patch.phone : distributor.phone,
  isWholesaler:
    typeof patch.isWholesaler === "boolean"
      ? patch.isWholesaler
      : distributor.isWholesaler,
  supplierCode:
    typeof patch.supplierCode === "string"
      ? patch.supplierCode
      : distributor.supplierCode,
  paymentTerms:
    typeof patch.paymentTerms === "string"
      ? patch.paymentTerms
      : distributor.paymentTerms,
  defaultCurrency:
    typeof patch.defaultCurrency === "string"
      ? patch.defaultCurrency
      : distributor.defaultCurrency,
  supplierTaxRegime:
    patch.supplierTaxRegime === "tva" ||
    patch.supplierTaxRegime === "ifu" ||
    patch.supplierTaxRegime === "exempt"
      ? patch.supplierTaxRegime
      : distributor.supplierTaxRegime,
  defaultPurchaseTaxRate:
    typeof patch.defaultPurchaseTaxRate === "number"
      ? patch.defaultPurchaseTaxRate
      : distributor.defaultPurchaseTaxRate,
  nif: typeof patch.nif === "string" ? patch.nif : distributor.nif,
  rc: typeof patch.rc === "string" ? patch.rc : distributor.rc,
  nis: typeof patch.nis === "string" ? patch.nis : distributor.nis,
  ai: typeof patch.ai === "string" ? patch.ai : distributor.ai,
  notes: typeof patch.notes === "string" ? patch.notes : distributor.notes,
});

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}> = ({ icon, label, value, description }) => {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-md bg-muted p-3 text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
};

const DistributorDirectoryCard: React.FC<{
  distributor: DistributorRecord;
  isSelected: boolean;
  isDeleting: boolean;
  editLabel: string;
  deleteLabel: string;
  formatCurrency: (value: number) => string;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({
  distributor,
  isSelected,
  isDeleting,
  editLabel,
  deleteLabel,
  formatCurrency,
  onSelect,
  onEdit,
  onDelete,
}) => (
  <div
    className={`rounded-md border p-4 transition-colors ${
      isSelected ? "border-primary/40 bg-accent/50" : "hover:bg-accent/30"
    }`}
  >
    <button type="button" onClick={onSelect} className="w-full text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{distributor.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {[distributor.phone, distributor.email]
              .filter(Boolean)
              .join(" | ") || "No contact info"}
          </p>
        </div>
        {distributor.supplierCode ? (
          <Badge variant="outline">{distributor.supplierCode}</Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Purchases
          </p>
          <p className="mt-1 font-semibold">{distributor.totalPurchases}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Balance Due
          </p>
          <p
            className={`mt-1 font-semibold ${distributor.balanceDue > 0 ? "text-amber-700" : ""}`}
          >
            {formatCurrency(distributor.balanceDue)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {distributor.paymentTerms ? (
          <span>{distributor.paymentTerms}</span>
        ) : (
          <span>No payment terms</span>
        )}
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>{distributor.defaultCurrency || "DZD"}</span>
      </div>
    </button>

    <div className="mt-4 flex gap-2 border-t pt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1"
        onClick={onEdit}
      >
        <Pencil className="mr-2 h-4 w-4" />
        {editLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1 text-destructive hover:text-destructive"
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        {deleteLabel}
      </Button>
    </div>
  </div>
);

const DistributorsPage: React.FC = () => {
  const { t } = useTranslation();
  const { hasAccess, requiredPlan, loading: featureLoading } = useFeatureAccess("distributors");
  const { user, isSubUser, canManageSales } = useAuth();
  const { formatCurrency } = useCurrencyFormatter();
  const canAccess = !isSubUser() || canManageSales();

  const [data, setData] = useState<DistributorsOverviewData | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedDistributorId, setSelectedDistributorId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDistributor, setEditingDistributor] =
    useState<DistributorRecord | null>(null);
  const [isSavingDistributor, setIsSavingDistributor] = useState(false);
  const [deletingDistributorId, setDeletingDistributorId] = useState<
    string | null
  >(null);
  const [form, setForm] = useState<DistributorFormState>(
    createFormState(user?.settings?.currency || "DZD"),
  );

  const distributors = data?.distributors || [];
  const selectedDistributor = useMemo(
    () =>
      distributors.find((entry) => entry.id === selectedDistributorId) ||
      distributors[0] ||
      null,
    [distributors, selectedDistributorId],
  );

  const loadDistributors = useCallback(
    async (preferredDistributorId?: string) => {
      if (featureLoading || !hasAccess || !canAccess) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await distributorsAPI.getDistributors(
          deferredSearch.trim() || undefined,
        );
        const nextData = response.data;
        const nextDistributors = nextData.distributors || [];

        setData(nextData);
        setSelectedDistributorId((current) => {
          const fallbackId =
            preferredDistributorId ||
            current ||
            nextDistributors[0]?.id ||
            null;
          return (
            nextDistributors.find((entry) => entry.id === fallbackId)?.id ||
            nextDistributors[0]?.id ||
            null
          );
        });
      } catch (apiError: unknown) {
        const message =
          typeof apiError === "object" &&
          apiError !== null &&
          "response" in apiError
            ? (apiError as { response?: { data?: { message?: string } } })
                .response?.data?.message
            : undefined;
        setError(
          message ||
            t("distributors.loadFailed", "Failed to load distributors"),
        );
        setData(null);
        setSelectedDistributorId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [canAccess, deferredSearch, featureLoading, hasAccess, t],
  );

  useEffect(() => {
    if (featureLoading || !hasAccess || !canAccess) return;
    void loadDistributors();
  }, [canAccess, featureLoading, hasAccess, loadDistributors]);

  const openCreateDialog = () => {
    setEditingDistributor(null);
    setError(null);
    setForm(createFormState(user?.settings?.currency || "DZD"));
    setIsDialogOpen(true);
  };

  const openEditDialog = (distributor: DistributorRecord) => {
    setEditingDistributor(distributor);
    setError(null);
    setForm({
      name: distributor.name,
      email: distributor.email,
      phone: distributor.phone,
      supplierCode: distributor.supplierCode,
      paymentTerms: distributor.paymentTerms,
      defaultCurrency:
        distributor.defaultCurrency || user?.settings?.currency || "DZD",
      notes: distributor.notes,
    });
    setIsDialogOpen(true);
  };

  const saveDistributor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError(t("distributors.nameRequired", "Distributor name is required"));
      return;
    }

    setIsSavingDistributor(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        supplierCode: form.supplierCode.trim(),
        paymentTerms: form.paymentTerms.trim(),
        defaultCurrency: form.defaultCurrency.trim(),
        notes: form.notes.trim(),
      };

      const response = editingDistributor
        ? await distributorsAPI.updateDistributor(
            editingDistributor.id,
            payload,
          )
        : await distributorsAPI.createDistributor(payload);

      const savedDistributor = response.data.distributor;
      setIsDialogOpen(false);
      setEditingDistributor(null);
      setForm(createFormState(user?.settings?.currency || "DZD"));
      await loadDistributors(savedDistributor.id);
    } catch (apiError: unknown) {
      const message =
        typeof apiError === "object" &&
        apiError !== null &&
        "response" in apiError
          ? (apiError as { response?: { data?: { message?: string } } })
              .response?.data?.message
          : undefined;
      setError(
        message || t("distributors.saveFailed", "Failed to save distributor"),
      );
    } finally {
      setIsSavingDistributor(false);
    }
  };

  const handleDistributorPatched = useCallback(
    (patch: Partial<ClientRecord>) => {
      setData((current) => {
        if (!current) return current;

        const targetId =
          (typeof patch.profileId === "string" && patch.profileId) ||
          (typeof patch.id === "string" && patch.id) ||
          selectedDistributorId;
        if (!targetId) return current;

        return {
          ...current,
          distributors: current.distributors.map((entry) =>
            entry.id === targetId || entry.profileId === targetId
              ? applyDistributorPatch(entry, patch)
              : entry,
          ),
        };
      });
    },
    [selectedDistributorId],
  );

  const handleDeleteDistributor = async (distributor: DistributorRecord) => {
    if (
      !confirm(
        t(
          "distributors.deleteConfirm",
          "Are you sure you want to delete this distributor?",
        ),
      )
    ) {
      return;
    }

    setDeletingDistributorId(distributor.id);
    setError(null);
    try {
      await distributorsAPI.deleteDistributor(distributor.id);
      await loadDistributors();
    } catch (apiError: unknown) {
      const message =
        typeof apiError === "object" &&
        apiError !== null &&
        "response" in apiError
          ? (apiError as { response?: { data?: { message?: string } } })
              .response?.data?.message
          : undefined;
      setError(
        message ||
          t("distributors.deleteFailed", "Failed to delete distributor"),
      );
    } finally {
      setDeletingDistributorId(null);
    }
  };

  if (featureLoading) return null;
  if (!hasAccess) {
    return (
      <SubscriptionLock
        feature="distributors"
        requiredPlan={requiredPlan}
        description="Upgrade to access the distributor system in this workspace."
      />
    );
  }

  if (!canAccess) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          {t(
            "team.noPermission",
            "You do not have permission to access this page.",
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("distributors.title", "Distributors")}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t(
              "distributors.description",
              "Manage supplier accounts, purchase intake, landed costs, and balances from one separate workspace.",
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void loadDistributors()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t("common.refresh", "Refresh")}
          </Button>
          <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("distributors.add", "Add Distributor")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Building2 className="h-4 w-4" />}
          label={t("distributors.total", "Total Distributors")}
          value={String(data?.summary.totalDistributors || 0)}
          description={t(
            "distributors.totalDesc",
            "Supplier accounts currently active",
          )}
        />
        <SummaryCard
          icon={<BadgeDollarSign className="h-4 w-4" />}
          label={t("distributors.totalPurchased", "Total Purchased")}
          value={formatCurrency(data?.summary.totalPurchasedAmount || 0)}
          description={t(
            "distributors.purchasedDesc",
            "Gross procurement value across distributors",
          )}
        />
        <SummaryCard
          icon={<Wallet className="h-4 w-4" />}
          label={t("distributors.totalPaid", "Total Paid")}
          value={formatCurrency(data?.summary.totalPaid || 0)}
          description={t(
            "distributors.paidDesc",
            "Payments already recorded to suppliers",
          )}
        />
        <SummaryCard
          icon={<Truck className="h-4 w-4" />}
          label={t("distributors.balanceDue", "Balance Due")}
          value={formatCurrency(data?.summary.balanceDue || 0)}
          description={t(
            "distributors.balanceDesc",
            "Outstanding payables still open",
          )}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="xl:sticky xl:top-24 xl:h-fit">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>
                {t("distributors.directory", "Distributor Directory")}
              </CardTitle>
              <CardDescription>
                {t(
                  "distributors.directoryDesc",
                  "Browse supplier accounts and switch the right-side workspace instantly.",
                )}
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t(
                  "distributors.searchPlaceholder",
                  "Search name, code, phone...",
                )}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {isLoading && !data ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("common.loading", "Loading...")}</span>
              </div>
            ) : distributors.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <PackageCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-4 font-medium">
                  {t("distributors.empty", "No distributors yet")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(
                    "distributors.emptyDesc",
                    "Create a distributor profile, then record purchases, payments, and stock receipts under it.",
                  )}
                </p>
                <Button className="mt-5" onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("distributors.add", "Add Distributor")}
                </Button>
              </div>
            ) : (
              distributors.map((distributor) => (
                <DistributorDirectoryCard
                  key={distributor.id}
                  distributor={distributor}
                  isSelected={distributor.id === selectedDistributor?.id}
                  isDeleting={deletingDistributorId === distributor.id}
                  editLabel={t("common.edit", "Edit")}
                  deleteLabel={t("common.delete", "Delete")}
                  formatCurrency={formatCurrency}
                  onSelect={() => setSelectedDistributorId(distributor.id)}
                  onEdit={() => openEditDialog(distributor)}
                  onDelete={() => void handleDeleteDistributor(distributor)}
                />
              ))
            )}
          </CardContent>
        </Card>

        {selectedDistributor ? (
          <ClientWholesaleTab
            client={toWorkspaceRecord(selectedDistributor)}
            formatCurrency={formatCurrency}
            onClientPatched={handleDistributorPatched}
            onReloadClients={loadDistributors}
          />
        ) : (
          <Card>
            <CardContent className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <Truck className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">
                {t("distributors.selectTitle", "Select a distributor")}
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t(
                  "distributors.selectDesc",
                  "Choose a distributor from the left to manage purchases, payments, and receiving.",
                )}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingDistributor(null);
            setForm(createFormState(user?.settings?.currency || "DZD"));
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDistributor
                ? t("distributors.edit", "Edit Distributor")
                : t("distributors.add", "Add Distributor")}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-5" onSubmit={saveDistributor}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="distributor-name">
                  {t("common.name", "Name")}
                </Label>
                <Input
                  id="distributor-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder={t(
                    "distributors.namePlaceholder",
                    "Distributor name",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distributor-code">
                  {t("distributors.code", "Supplier Code")}
                </Label>
                <Input
                  id="distributor-code"
                  value={form.supplierCode}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      supplierCode: event.target.value,
                    }))
                  }
                  placeholder={t("distributors.codePlaceholder", "SUP-001")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distributor-phone">
                  {t("common.phone", "Phone")}
                </Label>
                <Input
                  id="distributor-phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="+213..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distributor-email">
                  {t("common.email", "Email")}
                </Label>
                <Input
                  id="distributor-email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="supplier@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distributor-terms">
                  {t("distributors.paymentTerms", "Payment Terms")}
                </Label>
                <Input
                  id="distributor-terms"
                  value={form.paymentTerms}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentTerms: event.target.value,
                    }))
                  }
                  placeholder={t(
                    "distributors.paymentTermsPlaceholder",
                    "30 days, bank transfer",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="distributor-currency">
                  {t("common.currency", "Currency")}
                </Label>
                <Input
                  id="distributor-currency"
                  value={form.defaultCurrency}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultCurrency: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="DZD"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="distributor-notes">
                {t("common.notes", "Notes")}
              </Label>
              <Textarea
                id="distributor-notes"
                rows={5}
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder={t(
                  "distributors.notesPlaceholder",
                  "Main contact, bank details, delivery habits, or customs notes.",
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={isSavingDistributor}>
                {isSavingDistributor && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.save", "Save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DistributorsPage;
