// The only stages an order can be in. Must match the check constraint in
// audit-docs/deliverables/dev-schema-order-flow.sql.
export const ORDER_STAGES = [
  'Order Received',
  'Sampling & Approval',
  'In Production',
  'QC & Packaging',
  'Shipped',
  'Delivered',
  'Cancelled',
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export const isOrderStage = (v: unknown): v is OrderStage =>
  typeof v === 'string' && (ORDER_STAGES as readonly string[]).includes(v);

// Carriers offered as suggestions; the field also accepts any other name.
export const CARRIERS = ['Canada Post', 'Purolator', 'UPS', 'FedEx', 'DHL', 'Day & Ross', 'Manitoulin', 'Freight / LTL'];
