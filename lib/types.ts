export type Staff = {
  id: string;
  clerk_user_id: string | null;
  email: string;
  name: string;
  role: "admin" | "staff";
  active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  low_stock_at: number;
  track_stock: boolean;
  active: boolean;
};

export type SaleItem = {
  product_id: string | null;
  name: string;
  category: string;
  unit_price: number;
  qty: number;
  line_total: number;
};

export type Sale = {
  id: string;
  staff_id: string;
  business_date: string;
  payment_method: string;
  subtotal: number;
  tip: number;
  total: number;
  note: string | null;
  voided: boolean;
  voided_by: string | null;
  voided_at: string | null;
  created_at: string;
  sale_items: SaleItem[];
};

export type DayAudit = {
  business_date: string;
  closed_by: string | null;
  expected_cash: number;
  counted_cash: number;
  difference: number;
  notes: string | null;
  closed_at: string;
};

export type StockMovement = {
  id: string;
  product_id: string;
  staff_id: string | null;
  change: number;
  reason: string;
  note: string | null;
  created_at: string;
};
