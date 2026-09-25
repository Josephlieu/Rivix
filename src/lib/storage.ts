import { supabase } from './supabase';

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
