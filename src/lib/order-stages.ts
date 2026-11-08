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

// The stages at which a customer may ask for a document (certificates come once the
// order is finished). Change this list to change when the button appears; the server
// enforces the same list.
export const DOCUMENT_REQUEST_STAGES: readonly OrderStage[] = ['Shipped', 'Delivered'];
export const canRequestDocuments = (status: string) => (DOCUMENT_REQUEST_STAGES as readonly string[]).includes(status);

// The stages that email the customer when an order moves into them (in-app alerts are sent for every stage regardless).
// Default: every stage. Remove a stage here to stop emails for it; the server reads only this list.
export const ORDER_EMAIL_STAGES: readonly OrderStage[] = ORDER_STAGES;
export const emailsOnStage = (status: string) => (ORDER_EMAIL_STAGES as readonly string[]).includes(status);
