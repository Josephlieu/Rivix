import { supabase } from './supabase';
import { supabaseBrowser } from './supabase-browser';

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
    .select('*')
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
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching my orders:', error);
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
  inspector_name?: string;
}

export const getOrders = async (): Promise<OrderData[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }

  return data || [];
};

export const saveOrders = async (orders: OrderData[]) => {
  const { error } = await supabase
    .from('orders')
    .insert(orders.map(order => ({
      id: order.id,
      batch_number: order.batch_number,
      client_name: order.client_name,
      product_name: order.product_name,
      quantity: order.quantity,
      material: order.material,
      origin: order.origin,
      order_date: order.order_date,
      ship_date: order.ship_date,
      status: order.status,
      certs_generated: order.certs_generated,
      safety_standard: order.safety_standard,
      inspector_name: order.inspector_name
    })));

  if (error) {
    console.error('Error saving orders:', error);
    throw error;
  }
};
