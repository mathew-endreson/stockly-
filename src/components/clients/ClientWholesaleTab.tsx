import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCw,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  authAPI,
  distributorsAPI,
  productsAPI,
  supplierPurchasesAPI,
} from "@/services/api";
import type {
  AccountBalance,
  ClientRecord,
  Product,
  SupplierPurchase,
  SupplierTaxRegime,
} from "@/types";

type Props = {
  client: ClientRecord;
  formatCurrency: (value: number) => string;
  onClientPatched: (patch: Partial<ClientRecord>) => void;
  onReloadClients: () => Promise<void>;
};

type DraftPurchase = {
  expectedDate: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  taxRegime: SupplierTaxRegime;
  taxRate: string;
  nif: string;
  rc: string;
  nis: string;
  ai: string;
  notes: string;
  items: Array<{ product: string; quantity: string; unitCost: string }>;
  associatedCosts: Array<{ name: string; amount: string }>;
};

type TranslateFn = TFunction;

const createDraft = (defaults?: {
  taxRate?: number;
  taxRegime?: SupplierTaxRegime;
  nif?: string;
  rc?: string;
  nis?: string;
  ai?: string;
}): DraftPurchase => ({
  expectedDate: "",
  supplierInvoiceNumber: "",
  supplierInvoiceDate: "",
  taxRegime: defaults?.taxRegime || "tva",
  taxRate: String(defaults?.taxRate ?? 19),
  nif: defaults?.nif || "",
  rc: defaults?.rc || "",
  nis: defaults?.nis || "",
  ai: defaults?.ai || "",
  notes: "",
  items: [{ product: "", quantity: "1", unitCost: "0" }],
  associatedCosts: [{ name: "Shipping", amount: "0" }],
});

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const PAYMENT_SCOPE_OPTIONS = [
  { value: "balance", label: "Pay From Balance" },
  { value: "external", label: "Pay Outside Balance" },
] as const;

const PURCHASE_TAX_RATE_OPTIONS = [
  { value: "19", label: "19% TVA" },
  { value: "9", label: "9% TVA" },
  { value: "0", label: "0%" },
];

const STATUS_STYLES: Record<SupplierPurchase["status"], string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Ordered: "bg-blue-100 text-blue-700 border-blue-200",
  "Partially Received": "bg-amber-100 text-amber-700 border-amber-200",
  Received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

const getProductId = (product: SupplierPurchase["items"][number]["product"]) =>
  typeof product === "string" ? product : product?._id || "";

const getProductName = (
  product: SupplierPurchase["items"][number]["product"],
  fallback: string,
) => (typeof product === "string" ? fallback : product?.name || fallback);

const getClientTaxRegime = (client: ClientRecord): SupplierTaxRegime =>
  client.supplierTaxRegime || "tva";

const getClientDefaultPurchaseTaxRate = (client: ClientRecord): number => {
  if ((client.supplierTaxRegime || "tva") !== "tva") return 0;
  return typeof client.defaultPurchaseTaxRate === "number"
    ? client.defaultPurchaseTaxRate
    : 19;
};

const getTaxRegimeLabel = (t: TranslateFn, regime: SupplierTaxRegime) => {
  if (regime === "ifu") return t("distributors.taxRegime.ifu", "IFU");
  if (regime === "exempt") return t("distributors.taxRegime.exempt", "Exempt");
  return t("distributors.taxRegime.tva", "TVA Registered");
};

const getDraftDefaultsFromClient = (client: ClientRecord) => ({
  taxRegime: getClientTaxRegime(client),
  taxRate: getClientDefaultPurchaseTaxRate(client),
  nif: client.nif || "",
  rc: client.rc || "",
  nis: client.nis || "",
  ai: client.ai || "",
});

const ClientWholesaleTab: React.FC<Props> = ({
  client,
  formatCurrency,
  onClientPatched,
  onReloadClients,
}) => {
  const { t } = useTranslation();
  const { canViewBalance, updateUser, user } = useAuth();
  const clientIdentifier = client.profileId || client.clientKey;
  const canViewWorkspaceBalance = canViewBalance();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [purchases, setPurchases] = React.useState<SupplierPurchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] =
    React.useState<SupplierPurchase | null>(null);
  const [summary, setSummary] = React.useState({
    totalPurchases: 0,
    totalPurchasedAmount: 0,
    totalPaid: 0,
    balanceDue: 0,
    lastPurchaseAt: null as string | null,
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isSavingPurchase, setIsSavingPurchase] = React.useState(false);
  const [purchaseDraft, setPurchaseDraft] = React.useState<DraftPurchase>(
    createDraft(getDraftDefaultsFromClient(client)),
  );
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("cash");
  const [paymentScope, setPaymentScope] = React.useState<
    "balance" | "external"
  >("balance");
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [workspaceBalance, setWorkspaceBalance] =
    React.useState<AccountBalance | null>(user?.accountBalance || null);
  const [error, setError] = React.useState<string | null>(null);
  const canCreatePurchase = products.length > 0;
  const canReceiveSelectedPurchase = Boolean(
    selectedPurchase &&
    selectedPurchase.status !== "Received" &&
    selectedPurchase.status !== "Cancelled",
  );
  const canPaySelectedPurchase = Boolean(
    selectedPurchase && selectedPurchase.status !== "Cancelled",
  );

  const formatDate = React.useCallback(
    (value?: string | null) => {
      if (!value) return t("common.notAvailable", "N/A");
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime()))
        return t("common.notAvailable", "N/A");
      return parsed.toLocaleDateString();
    },
    [t],
  );

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [
        wholesaleResponse,
        purchasesResponse,
        productsResponse,
        balanceResponse,
      ] = await Promise.all([
        distributorsAPI.getWholesale(clientIdentifier),
        distributorsAPI.getPurchases(clientIdentifier, { limit: 40 }),
        productsAPI.getProducts({ limit: 200, sort: "name" }),
        canViewWorkspaceBalance
          ? authAPI.getBalance().catch(() => null)
          : Promise.resolve(null),
      ]);

      setSummary(wholesaleResponse.data.summary);
      setPurchases(purchasesResponse.data.purchases || []);
      setProducts(productsResponse.data.products || []);
      if (balanceResponse?.data?.balance) {
        setWorkspaceBalance(balanceResponse.data.balance);
      } else if (!canViewWorkspaceBalance) {
        setWorkspaceBalance(null);
      }
      setSelectedPurchase(
        (current) =>
          (purchasesResponse.data.purchases || []).find(
            (entry) => entry._id === current?._id,
          ) ||
          (purchasesResponse.data.purchases || [])[0] ||
          null,
      );
      onClientPatched({
        id: wholesaleResponse.data.profile.id || client.id,
        profileId: wholesaleResponse.data.profile.id || client.profileId,
        isWholesaler: true,
        supplierCode: wholesaleResponse.data.profile.supplierCode || "",
        paymentTerms: wholesaleResponse.data.profile.paymentTerms || "",
        defaultCurrency: wholesaleResponse.data.profile.defaultCurrency || "",
        supplierTaxRegime:
          wholesaleResponse.data.profile.supplierTaxRegime || "tva",
        defaultPurchaseTaxRate:
          wholesaleResponse.data.profile.defaultPurchaseTaxRate || 19,
        nif: wholesaleResponse.data.profile.nif || "",
        rc: wholesaleResponse.data.profile.rc || "",
        nis: wholesaleResponse.data.profile.nis || "",
        ai: wholesaleResponse.data.profile.ai || "",
        notes: wholesaleResponse.data.profile.notes || "",
      });
    } catch (apiError) {
      const message =
        typeof apiError === "object" &&
        apiError !== null &&
        "response" in apiError
          ? (apiError as { response?: { data?: { message?: string } } })
              .response?.data?.message
          : undefined;
      setError(
        message ||
          t("clients.wholesaleLoadFailed", "Failed to load wholesale data."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    canViewWorkspaceBalance,
    client.id,
    client.profileId,
    clientIdentifier,
    onClientPatched,
    t,
  ]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    setWorkspaceBalance(user?.accountBalance || null);
  }, [user?.accountBalance]);

  const purchaseTotals = React.useMemo(() => {
    const subtotal = purchaseDraft.items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unitCost || 0),
      0,
    );
    const extraCosts = purchaseDraft.associatedCosts.reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0,
    );
    const effectiveTaxRate =
      purchaseDraft.taxRegime === "tva"
        ? Number(purchaseDraft.taxRate || 0)
        : 0;
    const taxAmount = subtotal * (effectiveTaxRate / 100);
    return {
      subtotal,
      extraCosts,
      taxAmount,
      grandTotal: subtotal + extraCosts + taxAmount,
    };
  }, [purchaseDraft]);

  const createPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedItems = purchaseDraft.items.filter((item) => item.product);
    if (normalizedItems.length === 0) {
      setError(
        t(
          "clients.purchaseItemsRequired",
          "Add at least one product before creating a supplier purchase.",
        ),
      );
      return;
    }

    try {
      setIsSavingPurchase(true);
      setError(null);
      const purchaseItems = normalizedItems.map((item) => {
        const quantity = Number(item.quantity || 0);
        const unitCost = Number(item.unitCost || 0);
        const matchingProduct = products.find((product) => product._id === item.product);

        return {
          product: item.product,
          name: matchingProduct?.name || "",
          sku: matchingProduct?.sku || "",
          quantity,
          receivedQuantity: 0,
          unitCost,
          totalCost: quantity * unitCost,
        };
      });

      await distributorsAPI.createPurchase(clientIdentifier, {
        clientKey: client.clientKey,
        clientName: client.name,
        email: client.email,
        phone: client.phone,
        expectedDate: purchaseDraft.expectedDate || undefined,
        supplierInvoiceNumber: purchaseDraft.supplierInvoiceNumber || undefined,
        supplierInvoiceDate: purchaseDraft.supplierInvoiceDate || undefined,
        taxRegime: purchaseDraft.taxRegime,
        taxRate: Number(purchaseDraft.taxRate || 0),
        nif: purchaseDraft.nif || undefined,
        rc: purchaseDraft.rc || undefined,
        nis: purchaseDraft.nis || undefined,
        ai: purchaseDraft.ai || undefined,
        notes: purchaseDraft.notes,
        status: "Ordered",
        items: purchaseItems,
        associatedCosts: purchaseDraft.associatedCosts
          .filter((entry) => entry.name.trim())
          .map((entry) => ({
            name: entry.name,
            amount: Number(entry.amount || 0),
          })),
      });
      setIsCreateDialogOpen(false);
      setPurchaseDraft(createDraft(getDraftDefaultsFromClient(client)));
      await loadData();
      await onReloadClients();
    } catch (apiError) {
      const message =
        typeof apiError === "object" &&
        apiError !== null &&
        "response" in apiError
          ? (apiError as { response?: { data?: { message?: string } } })
              .response?.data?.message
          : undefined;
      setError(
        message ||
          t(
            "clients.purchaseCreateFailed",
            "Failed to create supplier purchase.",
          ),
      );
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const recordPayment = async () => {
    if (!selectedPurchase) return;
    if (Number(paymentAmount || 0) <= 0) {
      setError(
        t(
          "clients.purchasePaymentAmountRequired",
          "Enter a payment amount greater than zero.",
        ),
      );
      return;
    }
    if (
      paymentScope === "balance" &&
      Number(paymentAmount || 0) > selectedPurchase.balanceDue + 0.001
    ) {
      setError(
        t(
          "clients.purchasePaymentTooLarge",
          "Payment cannot exceed the remaining balance.",
        ),
      );
      return;
    }
    if (
      paymentScope === "balance" &&
      workspaceBalance &&
      Number(paymentAmount || 0) > (workspaceBalance.current || 0) + 0.001
    ) {
      setError(
        t(
          "clients.purchasePaymentInsufficientWorkspaceBalance",
          "Insufficient workspace balance for this payment.",
        ),
      );
      return;
    }

    try {
      setError(null);
      await supplierPurchasesAPI.recordPayment(selectedPurchase._id, {
        amount: Number(paymentAmount || 0),
        method: paymentMethod,
        scope: paymentScope,
        notes: paymentNotes,
      });
      if (paymentScope === "balance" && canViewWorkspaceBalance) {
        const balanceResponse = await authAPI.getBalance();
        setWorkspaceBalance(balanceResponse.data.balance);
        updateUser({ accountBalance: balanceResponse.data.balance });
      }
      setIsPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentScope("balance");
      setPaymentNotes("");
      await loadData();
      await onReloadClients();
    } catch (apiError) {
      const message =
        typeof apiError === "object" &&
        apiError !== null &&
        "response" in apiError
          ? (apiError as { response?: { data?: { message?: string } } })
              .response?.data?.message
          : undefined;
      setError(
        message ||
          t(
            "clients.purchasePaymentFailed",
            "Failed to record supplier payment.",
          ),
      );
    }
  };

  const handlePaymentDialogOpenChange = React.useCallback((open: boolean) => {
    setIsPaymentDialogOpen(open);
    if (!open) {
      setPaymentAmount("");
      setPaymentMethod("cash");
      setPaymentScope("balance");
      setPaymentNotes("");
    }
  }, []);

  const receivePurchase = async (purchase: SupplierPurchase) => {
    try {
      await supplierPurchasesAPI.receivePurchase(purchase._id);
      await loadData();
      await onReloadClients();
    } catch (apiError) {
      const message =
        typeof apiError === "object" &&
        apiError !== null &&
        "response" in apiError
          ? (apiError as { response?: { data?: { message?: string } } })
              .response?.data?.message
          : undefined;
      setError(
        message ||
          t(
            "clients.purchaseReceiveFailed",
            "Failed to receive supplier purchase.",
          ),
      );
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">{client.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {summary.lastPurchaseAt
                    ? t(
                        "clients.wholesale.lastPurchaseAt",
                        "Last purchase: {{date}}",
                        {
                          date: formatDate(summary.lastPurchaseAt),
                        },
                      )
                    : t(
                        "clients.wholesale.noPurchasesYet",
                        "No purchases recorded yet",
                      )}
                </p>
              </div>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
              <WorkspaceChip
                label={t("clients.wholesale.totalPurchases", "Total Purchases")}
                value={String(summary.totalPurchases)}
              />
              <WorkspaceChip
                label={t(
                  "clients.wholesale.totalPurchasedAmount",
                  "Total Purchased",
                )}
                value={formatCurrency(summary.totalPurchasedAmount)}
              />
              <WorkspaceChip
                label={t("clients.wholesale.totalPaid", "Total Paid")}
                value={formatCurrency(summary.totalPaid)}
              />
              <WorkspaceChip
                label={t("clients.wholesale.balanceDue", "Balance Due")}
                value={formatCurrency(summary.balanceDue)}
                accent="balance"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <PurchaseHistoryCard
          t={t}
          isLoading={isLoading}
          purchases={purchases}
          selectedPurchaseId={selectedPurchase?._id || null}
          purchaseCount={summary.totalPurchases}
          lastPurchaseAt={summary.lastPurchaseAt}
          productsCount={products.length}
          canCreatePurchase={canCreatePurchase}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onReload={loadData}
          onCreatePurchase={() => {
            setPurchaseDraft(createDraft(getDraftDefaultsFromClient(client)));
            setIsCreateDialogOpen(true);
          }}
          onSelectPurchase={setSelectedPurchase}
        />

        <PurchaseDetailsCard
          t={t}
          client={client}
          purchase={selectedPurchase}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          canReceive={canReceiveSelectedPurchase}
          canPay={canPaySelectedPurchase}
          onRecordPayment={() => {
            setPaymentScope(
              selectedPurchase &&
                (selectedPurchase.balanceDue <= 0 ||
                  Boolean(
                    workspaceBalance &&
                    Number(workspaceBalance.current || 0) <= 0,
                  ))
                ? "external"
                : "balance",
            );
            setIsPaymentDialogOpen(true);
          }}
          onReceive={receivePurchase}
        />
      </div>

      <CreatePurchaseDialog
        t={t}
        open={isCreateDialogOpen}
        canCreatePurchase={canCreatePurchase}
        isSavingPurchase={isSavingPurchase}
        products={products}
        client={client}
        purchaseDraft={purchaseDraft}
        purchaseTotals={purchaseTotals}
        formatCurrency={formatCurrency}
        onOpenChange={setIsCreateDialogOpen}
        onDraftChange={setPurchaseDraft}
        onSubmit={createPurchase}
      />

      <PaymentDialog
        t={t}
        open={isPaymentDialogOpen}
        purchase={selectedPurchase}
        workspaceBalance={workspaceBalance}
        paymentAmount={paymentAmount}
        paymentMethod={paymentMethod}
        paymentScope={paymentScope}
        paymentNotes={paymentNotes}
        canPay={canPaySelectedPurchase}
        formatCurrency={formatCurrency}
        onAmountChange={setPaymentAmount}
        onMethodChange={setPaymentMethod}
        onScopeChange={setPaymentScope}
        onNotesChange={setPaymentNotes}
        onOpenChange={handlePaymentDialogOpenChange}
        onSubmit={recordPayment}
      />
    </div>
  );
};

const WorkspaceChip: React.FC<{
  label: string;
  value: string;
  accent?: "default" | "balance";
}> = ({ label, value, accent = "default" }) => (
  <div
    className={`min-w-[150px] rounded-md border px-4 py-3 ${
      accent === "balance"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30"
        : "bg-muted/30"
    }`}
  >
    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
      {label}
    </p>
    <p className="mt-2 text-lg font-semibold">{value}</p>
  </div>
);

const SummaryLine: React.FC<{
  label: string;
  value: string;
  emphasize?: boolean;
}> = ({ label, value, emphasize = false }) => (
  <div
    className={`flex items-center justify-between gap-3 ${emphasize ? "font-semibold" : ""}`}
  >
    <span className={emphasize ? "text-foreground" : "text-muted-foreground"}>
      {label}
    </span>
    <span>{value}</span>
  </div>
);

const DetailMetric: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="rounded-md border p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <div className="mt-2 text-sm font-medium">{value}</div>
  </div>
);

const PurchaseStatusBadge: React.FC<{ status: SupplierPurchase["status"] }> = ({
  status,
}) => (
  <Badge
    variant="outline"
    className={STATUS_STYLES[status] || STATUS_STYLES.Draft}
  >
    {status}
  </Badge>
);

const PurchaseProductPicker: React.FC<{
  t: TranslateFn;
  products: Product[];
  value: string;
  onChange: (value: string) => void;
}> = ({ t, products, value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const selectedProduct =
    products.find((product) => product._id === value) || null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-3 font-normal"
        >
          <span className="truncate">
            {selectedProduct
              ? `${selectedProduct.name}${selectedProduct.sku ? ` (${selectedProduct.sku})` : ""}`
              : t("clients.wholesale.selectProduct", "Select product")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder={t(
              "ecommerce.searchProducts",
              "Search products to add...",
            )}
          />
          <CommandList>
            <CommandEmpty>
              {t("inventory.noProductsFound", "No products found")}
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product._id}
                  value={`${product.name} ${product.sku || ""} ${product._id}`}
                  onSelect={() => {
                    onChange(product._id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product._id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {product.sku || t("common.notAvailable", "N/A")}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const PurchaseHistoryCard: React.FC<{
  t: TranslateFn;
  isLoading: boolean;
  purchases: SupplierPurchase[];
  selectedPurchaseId: string | null;
  purchaseCount: number;
  lastPurchaseAt: string | null;
  productsCount: number;
  canCreatePurchase: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value?: string | null) => string;
  onReload: () => Promise<void>;
  onCreatePurchase: () => void;
  onSelectPurchase: (purchase: SupplierPurchase) => void;
}> = ({
  t,
  isLoading,
  purchases,
  selectedPurchaseId,
  purchaseCount,
  lastPurchaseAt,
  productsCount,
  canCreatePurchase,
  formatCurrency,
  formatDate,
  onReload,
  onCreatePurchase,
  onSelectPurchase,
}) => (
  <Card>
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <CardTitle>
            {t("clients.wholesale.purchaseHistory", "Purchase History")}
          </CardTitle>
          <Badge variant="outline">
            {purchaseCount} {t("clients.wholesale.items", "items")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {lastPurchaseAt
            ? t("clients.wholesale.lastPurchaseAt", "Last purchase: {{date}}", {
                date: formatDate(lastPurchaseAt),
              })
            : t(
                "clients.wholesale.purchaseHistoryDesc",
                "Track supplier purchases, balances, and received stock in one place.",
              )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void onReload()}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t("common.refresh", "Refresh")}
        </Button>
        <Button
          size="sm"
          onClick={onCreatePurchase}
          disabled={!canCreatePurchase}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("clients.wholesale.newPurchase", "New Purchase")}
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {productsCount === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t(
              "clients.wholesale.noProductsHint",
              "Add products to inventory before building supplier purchases.",
            )}
          </AlertDescription>
        </Alert>
      )}
      {isLoading && purchases.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("common.loading", "Loading...")}</span>
        </div>
      ) : purchases.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t(
            "clients.wholesale.emptyPurchases",
            "No supplier purchases yet. Create the first purchase to start tracking stock intake and payables.",
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("clients.wholesale.purchase", "Purchase")}
                </TableHead>
                <TableHead>{t("common.status", "Status")}</TableHead>
                <TableHead>
                  {t("clients.wholesale.expected", "Expected")}
                </TableHead>
                <TableHead className="text-right">
                  {t("common.total", "Total")}
                </TableHead>
                <TableHead className="text-right">
                  {t("clients.wholesale.balance", "Balance")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((purchase) => (
                <TableRow
                  key={purchase._id}
                  className={`cursor-pointer transition-colors ${
                    purchase._id === selectedPurchaseId
                      ? "bg-muted/50"
                      : "hover:bg-muted/40"
                  }`}
                  onClick={() => onSelectPurchase(purchase)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{purchase.purchaseNumber}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {purchase.items.length}{" "}
                          {purchase.items.length === 1
                            ? t("clients.wholesale.item", "item")
                            : t("clients.wholesale.items", "items")}
                        </span>
                        {purchase.balanceDue > 0 ? (
                          <Badge variant="outline">
                            {t("clients.wholesale.balanceDue", "Balance Due")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {t("common.paid", "Paid")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PurchaseStatusBadge status={purchase.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(purchase.expectedDate || null)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(purchase.grandTotal)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(purchase.balanceDue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

const PurchaseDetailsCard: React.FC<{
  t: TranslateFn;
  client: ClientRecord;
  purchase: SupplierPurchase | null;
  formatCurrency: (value: number) => string;
  formatDate: (value?: string | null) => string;
  canReceive: boolean;
  canPay: boolean;
  onRecordPayment: () => void;
  onReceive: (purchase: SupplierPurchase) => Promise<void>;
}> = ({
  t,
  client,
  purchase,
  formatCurrency,
  formatDate,
  canReceive,
  canPay,
  onRecordPayment,
  onReceive,
}) => {
  const supplierSnapshot = purchase?.supplierSnapshot || {
    name: client.name,
    supplierCode: client.supplierCode || "",
    paymentTerms: client.paymentTerms || "",
    defaultCurrency: client.defaultCurrency || "",
  };
  const externalPaymentTotal = (purchase?.payments || []).reduce(
    (sum, payment) =>
      (payment.scope || "balance") === "external"
        ? sum + Number(payment.amount || 0)
        : sum,
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>
            {t("clients.wholesale.purchaseDetails", "Purchase Details")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {purchase
              ? purchase.purchaseNumber
              : t(
                  "clients.wholesale.selectPurchase",
                  "Select a purchase from the table to inspect stock intake, costs, payments, and receiving progress.",
                )}
          </p>
        </div>
        {purchase && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRecordPayment}
              disabled={!canPay}
            >
              <Wallet className="mr-2 h-4 w-4" />
              {t("clients.wholesale.recordPayment", "Record Payment")}
            </Button>
            <Button
              size="sm"
              onClick={() => void onReceive(purchase)}
              disabled={!canReceive}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              {t("clients.wholesale.markReceived", "Mark as Received")}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!purchase ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t(
              "clients.wholesale.selectPurchaseEmpty",
              "Choose a supplier purchase to review line items, extra costs, payments, and received quantities.",
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <DetailMetric
                label={t("common.status", "Status")}
                value={<PurchaseStatusBadge status={purchase.status} />}
              />
              <DetailMetric
                label={t("clients.wholesale.supplier", "Supplier")}
                value={supplierSnapshot.name || client.name}
              />
              <DetailMetric
                label={t("clients.wholesale.expected", "Expected")}
                value={formatDate(purchase.expectedDate || null)}
              />
              <DetailMetric
                label={t("clients.wholesale.receivedAt", "Received At")}
                value={formatDate(purchase.receivedAt || null)}
              />
              <DetailMetric
                label={t(
                  "clients.wholesale.supplierInvoice",
                  "Supplier Invoice",
                )}
                value={
                  purchase.supplierInvoiceNumber ||
                  t("common.notAvailable", "N/A")
                }
              />
              <DetailMetric
                label={t("clients.wholesale.invoiceDate", "Invoice Date")}
                value={formatDate(purchase.supplierInvoiceDate || null)}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("clients.wholesale.lineItems", "Line Items")}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {purchase.items.length}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("clients.wholesale.grandTotal", "Grand Total")}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatCurrency(purchase.grandTotal)}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("clients.wholesale.amountPaid", "Amount Paid")}
                </p>
                <p className="mt-2 text-lg font-semibold text-emerald-700">
                  {formatCurrency(purchase.amountPaid)}
                </p>
              </div>
              <div className="rounded-md border bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/30">
                <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {t("clients.wholesale.balanceDue", "Balance Due")}
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatCurrency(purchase.balanceDue)}
                </p>
              </div>
            </div>

            <Alert>
              <ReceiptText className="h-4 w-4" />
              <AlertDescription>
                {t(
                  "clients.wholesale.landedCostNote",
                  "Landed cost is calculated from product cost plus associated costs, so the landed-cost column shows the operational cost per item after extra charges.",
                )}
              </AlertDescription>
            </Alert>

            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.product", "Product")}</TableHead>
                    <TableHead className="text-right">
                      {t("common.quantity", "Quantity")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("clients.wholesale.received", "Received")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("clients.wholesale.unitCost", "Unit Cost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("clients.wholesale.landedCost", "Landed Cost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("common.total", "Total")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items.map((item) => {
                    const productId = getProductId(item.product);
                    const landedCost =
                      purchase.landedCostPerItem?.[productId] ?? item.unitCost;

                    return (
                      <TableRow
                        key={`${purchase._id}-${productId}-${item.sku}`}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">
                              {getProductName(item.product, item.name)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.sku || t("common.notAvailable", "N/A")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.receivedQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-700">
                          {formatCurrency(landedCost)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.totalCost)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <div className="rounded-md border p-4">
                  <p className="mb-2 font-medium">
                    {t("clients.wholesale.associatedCosts", "Associated Costs")}
                  </p>
                  {purchase.associatedCosts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "clients.wholesale.noAssociatedCosts",
                        "No extra costs recorded for this purchase.",
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {purchase.associatedCosts.map((entry, index) => (
                        <div
                          key={`${purchase._id}-cost-${index}`}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{entry.name}</span>
                          <span className="font-medium">
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-md border p-4">
                  <p className="mb-2 font-medium">
                    {t("clients.wholesale.paymentHistory", "Payment History")}
                  </p>
                  {purchase.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "clients.wholesale.noPayments",
                        "No payments recorded yet.",
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {purchase.payments.map((payment, index) => (
                        <div
                          key={`${purchase._id}-payment-${index}`}
                          className="rounded-md border bg-muted/30 p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {formatCurrency(payment.amount)}
                              </span>
                              <Badge variant="outline">
                                {(payment.scope || "balance") === "external"
                                  ? t(
                                      "clients.wholesale.paymentScopeExternal",
                                      "Outside Balance",
                                    )
                                  : t(
                                      "clients.wholesale.paymentScopeBalance",
                                      "From Balance",
                                    )}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground">
                              {formatDate(payment.date)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                            <span>
                              {payment.method ||
                                t("common.notAvailable", "N/A")}
                            </span>
                            <span>
                              {payment.notes || t("common.none", "No notes")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <p className="mb-3 font-medium">
                  {t("clients.wholesale.financialSummary", "Financial Summary")}
                </p>
                <div className="space-y-3 text-sm">
                  <SummaryLine
                    label={t("common.subtotal", "Subtotal")}
                    value={formatCurrency(purchase.subtotal)}
                  />
                  <SummaryLine
                    label={t("clients.wholesale.extraCosts", "Extra Costs")}
                    value={formatCurrency(purchase.extraCostsTotal)}
                  />
                  <SummaryLine
                    label={t("common.total", "Total")}
                    value={formatCurrency(purchase.grandTotal)}
                  />
                  <SummaryLine
                    label={t("clients.wholesale.amountPaid", "Amount Paid")}
                    value={formatCurrency(purchase.amountPaid)}
                  />
                  {externalPaymentTotal > 0 ? (
                    <SummaryLine
                      label={t(
                        "clients.wholesale.outsideBalancePayments",
                        "Outside Balance Payments",
                      )}
                      value={formatCurrency(externalPaymentTotal)}
                    />
                  ) : null}
                  <SummaryLine
                    label={t("clients.wholesale.balanceDue", "Balance Due")}
                    value={formatCurrency(purchase.balanceDue)}
                    emphasize
                  />
                </div>
                <div className="mt-4 rounded-md border bg-background p-3 text-sm">
                  <SummaryLine
                    label={t("common.currency", "Currency")}
                    value={
                      supplierSnapshot.defaultCurrency ||
                      t("common.notAvailable", "N/A")
                    }
                  />
                  <div className="mt-3 border-t pt-3">
                    <SummaryLine
                      label={t("distributors.paymentTerms", "Payment Terms")}
                      value={
                        supplierSnapshot.paymentTerms ||
                        t("common.notAvailable", "N/A")
                      }
                    />
                  </div>
                </div>
                {purchase.notes ? (
                  <div className="mt-4 rounded-md border bg-background p-3 text-sm text-muted-foreground">
                    {purchase.notes}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CreatePurchaseDialog: React.FC<{
  t: TranslateFn;
  open: boolean;
  canCreatePurchase: boolean;
  isSavingPurchase: boolean;
  products: Product[];
  client: ClientRecord;
  purchaseDraft: DraftPurchase;
  purchaseTotals: {
    subtotal: number;
    extraCosts: number;
    taxAmount: number;
    grandTotal: number;
  };
  formatCurrency: (value: number) => string;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<DraftPurchase>>;
  onSubmit: (event: React.FormEvent) => Promise<void>;
}> = ({
  t,
  open,
  canCreatePurchase,
  isSavingPurchase,
  products,
  client,
  purchaseDraft,
  purchaseTotals,
  formatCurrency,
  onOpenChange,
  onDraftChange,
  onSubmit,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          {t("clients.wholesale.newPurchase", "New Purchase")}
        </DialogTitle>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <div className="space-y-4 rounded-md border p-4">
            <div>
              <p className="font-medium">
                {t("clients.wholesale.purchaseBasics", "Purchase Basics")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(
                  "clients.wholesale.purchaseBasicsDesc",
                  "Capture the supplier invoice reference, expected date, and the purchase-specific tax details for this shipment.",
                )}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase-expected-date">
                  {t("clients.wholesale.expectedDate", "Expected Date")}
                </Label>
                <Input
                  id="purchase-expected-date"
                  type="date"
                  value={purchaseDraft.expectedDate}
                  onChange={(event) =>
                    onDraftChange((prev) => ({
                      ...prev,
                      expectedDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-invoice-number">
                  {t("clients.wholesale.supplierInvoice", "Supplier Invoice")}
                </Label>
                <Input
                  id="supplier-invoice-number"
                  value={purchaseDraft.supplierInvoiceNumber}
                  onChange={(event) =>
                    onDraftChange((prev) => ({
                      ...prev,
                      supplierInvoiceNumber: event.target.value,
                    }))
                  }
                  placeholder="FAC-2026-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-invoice-date">
                  {t("clients.wholesale.invoiceDate", "Invoice Date")}
                </Label>
                <Input
                  id="supplier-invoice-date"
                  type="date"
                  value={purchaseDraft.supplierInvoiceDate}
                  onChange={(event) =>
                    onDraftChange((prev) => ({
                      ...prev,
                      supplierInvoiceDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t("clients.wholesale.taxRegime", "Tax Regime")}</Label>
                <Select
                  value={purchaseDraft.taxRegime}
                  onValueChange={(value) =>
                    onDraftChange((prev) => ({
                      ...prev,
                      taxRegime: value as SupplierTaxRegime,
                      taxRate:
                        value === "tva"
                          ? prev.taxRate === "0"
                            ? "19"
                            : prev.taxRate
                          : "0",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tva">
                      {getTaxRegimeLabel(t, "tva")}
                    </SelectItem>
                    <SelectItem value="ifu">
                      {getTaxRegimeLabel(t, "ifu")}
                    </SelectItem>
                    <SelectItem value="exempt">
                      {getTaxRegimeLabel(t, "exempt")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("clients.wholesale.taxRate", "TVA Rate")}</Label>
                <Select
                  value={purchaseDraft.taxRate}
                  onValueChange={(value) =>
                    onDraftChange((prev) => ({ ...prev, taxRate: value }))
                  }
                  disabled={purchaseDraft.taxRegime !== "tva"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURCHASE_TAX_RATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div>
              <p className="font-medium">
                {t("clients.wholesale.taxPreview", "Tax Preview")}
              </p>
              <p className="text-sm text-muted-foreground">
                {purchaseDraft.taxRegime === "tva"
                  ? t(
                      "clients.wholesale.taxDialogNote",
                      "TVA is calculated on the product subtotal. Associated costs stay in landed cost, while TVA stays visible in payables.",
                    )
                  : t(
                      "clients.wholesale.taxDialogNoteNoTva",
                      "This purchase uses 0% TVA while still keeping the supplier legal identifiers and invoice reference.",
                    )}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <SummaryLine
                label={t("common.subtotal", "Subtotal")}
                value={formatCurrency(purchaseTotals.subtotal)}
              />
              <SummaryLine
                label={t("clients.wholesale.extraCosts", "Extra Costs")}
                value={formatCurrency(purchaseTotals.extraCosts)}
              />
              <SummaryLine
                label={t("clients.wholesale.taxAmount", "TVA {{rate}}%", {
                  rate:
                    purchaseDraft.taxRegime === "tva"
                      ? Number(purchaseDraft.taxRate || 0)
                      : 0,
                })}
                value={formatCurrency(purchaseTotals.taxAmount)}
              />
              <SummaryLine
                label={t("clients.wholesale.grandTotal", "Grand Total")}
                value={formatCurrency(purchaseTotals.grandTotal)}
                emphasize
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border p-4">
          <div className="mb-4">
            <p className="font-medium">
              {t(
                "clients.wholesale.algerianTaxDetails",
                "Algerian Tax Details",
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "clients.wholesale.algerianTaxDetailsDesc",
                "These legal identifiers are saved with this purchase only, so the distributor workspace stays clean and focused.",
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-nif">
                {t("distributors.nif", "NIF")}
              </Label>
              <Input
                id="purchase-nif"
                value={purchaseDraft.nif}
                onChange={(event) =>
                  onDraftChange((prev) => ({
                    ...prev,
                    nif: event.target.value,
                  }))
                }
                placeholder={client.nif || "NIF"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-rc">{t("distributors.rc", "RC")}</Label>
              <Input
                id="purchase-rc"
                value={purchaseDraft.rc}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, rc: event.target.value }))
                }
                placeholder={client.rc || "RC"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-nis">
                {t("distributors.nis", "NIS")}
              </Label>
              <Input
                id="purchase-nis"
                value={purchaseDraft.nis}
                onChange={(event) =>
                  onDraftChange((prev) => ({
                    ...prev,
                    nis: event.target.value,
                  }))
                }
                placeholder={client.nis || "NIS"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-ai">{t("distributors.ai", "AI")}</Label>
              <Input
                id="purchase-ai"
                value={purchaseDraft.ai}
                onChange={(event) =>
                  onDraftChange((prev) => ({ ...prev, ai: event.target.value }))
                }
                placeholder={client.ai || "AI"}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>
              {t("clients.wholesale.purchaseItems", "Purchase Items")}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onDraftChange((prev) => ({
                  ...prev,
                  items: [
                    ...prev.items,
                    { product: "", quantity: "1", unitCost: "0" },
                  ],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("common.add", "Add")}
            </Button>
          </div>
          <div className="space-y-3">
            {purchaseDraft.items.map((item, index) => (
              <div
                key={`purchase-item-${index}`}
                className="grid gap-3 rounded-md border p-3 lg:grid-cols-[minmax(0,1fr)_120px_140px_120px]"
              >
                <div className="space-y-2">
                  <Label>{t("common.product", "Product")}</Label>
                  <PurchaseProductPicker
                    t={t}
                    products={products}
                    value={item.product}
                    onChange={(value) =>
                      onDraftChange((prev) => {
                        const nextItems = [...prev.items];
                        nextItems[index] = {
                          ...nextItems[index],
                          product: value,
                        };
                        return { ...prev, items: nextItems };
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.quantity", "Quantity")}</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      onDraftChange((prev) => {
                        const nextItems = [...prev.items];
                        nextItems[index] = {
                          ...nextItems[index],
                          quantity: event.target.value,
                        };
                        return { ...prev, items: nextItems };
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("clients.wholesale.unitCost", "Unit Cost")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitCost}
                    onChange={(event) =>
                      onDraftChange((prev) => {
                        const nextItems = [...prev.items];
                        nextItems[index] = {
                          ...nextItems[index],
                          unitCost: event.target.value,
                        };
                        return { ...prev, items: nextItems };
                      })
                    }
                  />
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("common.total", "Total")}
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">
                    {formatCurrency(
                      Number(item.quantity || 0) * Number(item.unitCost || 0),
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={purchaseDraft.items.length === 1}
                    onClick={() =>
                      onDraftChange((prev) => ({
                        ...prev,
                        items: prev.items.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    {t("common.remove", "Remove")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>
              {t("clients.wholesale.associatedCosts", "Associated Costs")}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onDraftChange((prev) => ({
                  ...prev,
                  associatedCosts: [
                    ...prev.associatedCosts,
                    { name: "", amount: "0" },
                  ],
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("common.add", "Add")}
            </Button>
          </div>
          {purchaseDraft.associatedCosts.map((entry, index) => (
            <div
              key={`purchase-cost-${index}`}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_180px_100px]"
            >
              <div className="space-y-2">
                <Label>{t("common.name", "Name")}</Label>
                <Input
                  value={entry.name}
                  onChange={(event) =>
                    onDraftChange((prev) => {
                      const nextCosts = [...prev.associatedCosts];
                      nextCosts[index] = {
                        ...nextCosts[index],
                        name: event.target.value,
                      };
                      return { ...prev, associatedCosts: nextCosts };
                    })
                  }
                  placeholder={t(
                    "clients.wholesale.costNamePlaceholder",
                    "Shipping, customs, handling",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("common.amount", "Amount")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={entry.amount}
                  onChange={(event) =>
                    onDraftChange((prev) => {
                      const nextCosts = [...prev.associatedCosts];
                      nextCosts[index] = {
                        ...nextCosts[index],
                        amount: event.target.value,
                      };
                      return { ...prev, associatedCosts: nextCosts };
                    })
                  }
                />
              </div>
              <div className="flex flex-col justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={purchaseDraft.associatedCosts.length === 1}
                  onClick={() =>
                    onDraftChange((prev) => ({
                      ...prev,
                      associatedCosts: prev.associatedCosts.filter(
                        (_, costIndex) => costIndex !== index,
                      ),
                    }))
                  }
                >
                  {t("common.remove", "Remove")}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase-notes">{t("common.notes", "Notes")}</Label>
          <Textarea
            id="purchase-notes"
            rows={4}
            value={purchaseDraft.notes}
            onChange={(event) =>
              onDraftChange((prev) => ({ ...prev, notes: event.target.value }))
            }
            placeholder={t(
              "clients.wholesale.purchaseNotesPlaceholder",
              "Terms agreed, shipment info, or special instructions.",
            )}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={isSavingPurchase || !canCreatePurchase}
          >
            {isSavingPurchase && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("clients.wholesale.createPurchase", "Create Purchase")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);

const PaymentDialog: React.FC<{
  t: TranslateFn;
  open: boolean;
  purchase: SupplierPurchase | null;
  workspaceBalance: AccountBalance | null;
  paymentAmount: string;
  paymentMethod: string;
  paymentScope: "balance" | "external";
  paymentNotes: string;
  canPay: boolean;
  formatCurrency: (value: number) => string;
  onAmountChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onScopeChange: (value: "balance" | "external") => void;
  onNotesChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => Promise<void>;
}> = ({
  t,
  open,
  purchase,
  workspaceBalance,
  paymentAmount,
  paymentMethod,
  paymentScope,
  paymentNotes,
  canPay,
  formatCurrency,
  onAmountChange,
  onMethodChange,
  onScopeChange,
  onNotesChange,
  onOpenChange,
  onSubmit,
}) => {
  const parsedAmount = Number(paymentAmount || 0);
  const hasWorkspaceBalance = Boolean(
    workspaceBalance && Number.isFinite(workspaceBalance.current),
  );
  const hasEnoughWorkspaceBalance =
    paymentScope !== "balance" ||
    !hasWorkspaceBalance ||
    parsedAmount <= Number(workspaceBalance?.current || 0) + 0.001;
  const isBalanceOptionDisabled = Boolean(
    purchase?.balanceDue !== undefined && purchase.balanceDue <= 0,
  ) || (hasWorkspaceBalance && Number(workspaceBalance?.current || 0) <= 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("clients.wholesale.recordPayment", "Record Payment")}
            {purchase ? ` - ${purchase.purchaseNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <SummaryLine
              label={t("clients.wholesale.balanceDue", "Balance Due")}
              value={
                purchase
                  ? formatCurrency(purchase.balanceDue)
                  : formatCurrency(0)
              }
              emphasize
            />
          </div>
          {hasWorkspaceBalance ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <SummaryLine
                label={t("dashboard.balance.current", "Current Balance")}
                value={formatCurrency(workspaceBalance?.current || 0)}
                emphasize
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>
              {t("clients.wholesale.paymentScope", "Payment Scope")}
            </Label>
            <Select
              value={paymentScope}
              onValueChange={(value) =>
                onScopeChange(value as "balance" | "external")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_SCOPE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.value === "balance" && isBalanceOptionDisabled}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {paymentScope === "balance"
                ? t(
                    "clients.wholesale.paymentScopeBalanceHint",
                    "This payment reduces the remaining balance on this purchase.",
                  )
                : t(
                    "clients.wholesale.paymentScopeExternalHint",
                    "This payment is recorded in history but does not reduce the purchase balance.",
                  )}
            </p>
            {paymentScope === "balance" &&
            hasWorkspaceBalance &&
            !hasEnoughWorkspaceBalance ? (
              <p className="text-xs font-medium text-destructive">
                {t(
                  "clients.purchasePaymentInsufficientWorkspaceBalance",
                  "Insufficient workspace balance for this payment.",
                )}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-payment-amount">
              {t("common.amount", "Amount")}
            </Label>
            <Input
              id="supplier-payment-amount"
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>
              {t("clients.wholesale.paymentMethod", "Payment Method")}
            </Label>
            <Select value={paymentMethod} onValueChange={onMethodChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-payment-notes">
              {t("common.notes", "Notes")}
            </Label>
            <Textarea
              id="supplier-payment-notes"
              rows={3}
              value={paymentNotes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={t(
                "clients.wholesale.paymentNotesPlaceholder",
                "Bank reference, receipt number, or note",
              )}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={() => void onSubmit()}
            disabled={!canPay || !hasEnoughWorkspaceBalance}
          >
            {t("clients.wholesale.recordPayment", "Record Payment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientWholesaleTab;
