import type {
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpensePaymentSource,
  ExpenseStatus,
  ExpenseUtilityType,
  ExpenseCostNature,
} from "@/types";

export const EXPENSE_CATEGORY_OPTIONS: Array<{
  value: ExpenseCategory;
  label: string;
}> = [
  { value: "utilities", label: "Utilities" },
  { value: "taxes_fees", label: "Taxes & Fees" },
  { value: "payroll", label: "Payroll" },
  { value: "rent", label: "Rent" },
  { value: "transport", label: "Transport" },
  { value: "maintenance", label: "Maintenance" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "inventory_related", label: "Inventory Related" },
  { value: "other", label: "Other" },
];

export const EXPENSE_UTILITY_TYPE_OPTIONS: Array<{
  value: ExpenseUtilityType;
  label: string;
}> = [
  { value: "electricity", label: "Electricity" },
  { value: "gas", label: "Gas" },
  { value: "water", label: "Water" },
  { value: "internet", label: "Internet" },
  { value: "other", label: "Other" },
];

export const EXPENSE_PAYMENT_SOURCE_OPTIONS: Array<{
  value: ExpensePaymentSource;
  label: string;
}> = [
  { value: "store_funds", label: "Store funds" },
  { value: "outside_store_funds", label: "Outside store funds" },
];

export const EXPENSE_PAYMENT_METHOD_OPTIONS: Array<{
  value: ExpensePaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "ccp", label: "CCP" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
];

export const EXPENSE_STATUS_OPTIONS: Array<{
  value: ExpenseStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export const EXPENSE_COST_NATURE_OPTIONS: Array<{
  value: ExpenseCostNature;
  label: string;
}> = [
  { value: "fixed", label: "Fixed" },
  { value: "variable", label: "Variable" },
];

export const EXPENSE_SENSITIVE_CATEGORIES = new Set<ExpenseCategory>([
  "payroll",
  "taxes_fees",
]);
