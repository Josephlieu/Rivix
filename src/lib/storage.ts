import { supabaseBrowser } from './supabase-browser';

// Browser reads name their columns (never select('*')): a customer is only ever sent the columns the page shows.
// Staff-only columns are left out: orders.pricing, orders.special_requirements, orders.inspector_name, and every
// "who on the staff did it" column. scripts/e2e/no-select-star.test.mjs checks this.
export const CUSTOMER_COLUMNS = 'id, user_id, customer_code, company_name, contact_email';
// One string (not joined with +), so the Supabase types can read the columns.
export const ORDER_COLUMNS = 'id, batch_number, product_name, quantity, material, origin, order_date, ship_date, status, certs_generated, safety_standard, po_number, delivery_location, carrier, tracking_number, created_at';
export const PRODUCT_SPEC_COLUMNS = 'id, customer_id, product_name, safety_standard, fabric, description, file_url, file_label, created_at';

export interface CustomerData {
  id: string;
  user_id: string;
  customer_code: string;
  company_name: string;
  contact_email: string | null;
}

// Real, RLS-scoped: returns the logged-in customer's own record, or null
// if no customer profile has been set up for this user yet.
export const getCurrentCustomer = async (): Promise<CustomerData | null> => {
  const { data: { user } } = await supabaseBrowser.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseBrowser
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching current customer:', error);
    return null;
  }

  return data;
};

// Real, RLS-scoped: returns only the logged-in customer's own orders.
// RLS on `orders` already restricts this to the right rows — no manual
// name-matching needed.
export const getMyOrders = async (): Promise<OrderData[]> => {
  const { data, error } = await supabaseBrowser
    .from('orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching my orders:', error);
    return [];
  }

  return data || [];
};

export interface AssignedRep {
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
}

// Real, RLS-scoped: the logged-in customer's assigned rep, or null if none.
// The database only lets a customer read the rep they're assigned to.
export const getMyRep = async (): Promise<AssignedRep | null> => {
  const { data: { user } } = await supabaseBrowser.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabaseBrowser
    .from('customers')
    .select('rep:reps(name, title, email, phone)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching assigned rep:', error);
    return null;
  }
  return (data?.rep as unknown as AssignedRep | null) ?? null;
};

export interface ProductSpecData {
  id: string;
  customer_id: string;
  product_name: string;
  safety_standard: string | null;
  fabric: string | null;
  description: string | null;
  file_url: string | null;
  file_label: string | null;
  created_at: string;
}

// Real, RLS-scoped: returns only the logged-in customer's own product
// specs — admin-managed per §5's 2026-09-25 decision, not a generic
// catalog every customer sees the same version of.
export const getMyProductSpecs = async (): Promise<ProductSpecData[]> => {
  const { data, error } = await supabaseBrowser
    .from('product_specs')
    .select(PRODUCT_SPEC_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching my product specs:', error);
    return [];
  }

  return data || [];
};

export interface OrderData {
  id: string;
  batch_number: string;
  client_name?: string;
  product_name: string;
  quantity: number;
  material?: string;
  origin?: string;
  order_date?: string;
  ship_date?: string;
  status: string;
  certs_generated?: boolean;
  safety_standard?: string;
  po_number?: string | null;
  delivery_location?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  created_at?: string;
}
