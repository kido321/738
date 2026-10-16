export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "738 Afties";

export const CATEGORIES = [
  { key: "bottle", label: "Bottles" },
  { key: "drink", label: "Drinks" },
  { key: "hookah", label: "Hookah" },
  { key: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["key"];

export const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "other", label: "Other" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];

export function categoryLabel(key: string) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function paymentLabel(key: string) {
  return PAYMENT_METHODS.find((p) => p.key === key)?.label ?? key;
}
