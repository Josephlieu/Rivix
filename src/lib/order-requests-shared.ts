// Order request values safe to use in the browser too (no server imports).
export const MAX_OPEN_REQUESTS = 10; // keep in step with the trigger in audit-docs/deliverables/task-05-order-requests.sql
export const OPEN_LIMIT_MESSAGE = `You already have ${MAX_OPEN_REQUESTS} open requests. Please wait for RIVIX to answer some of them before sending another.`;
export type RequestItem = {
  product_name: string; sizes: { size: string; qty: number }[]; branding: string | null;
  // A quote from the catalogue (2026-11-26) also carries the family and the customer's spec (plain text, as typed).
  family_id?: string; family_code?: string;
  spec?: { options?: { label: string; value: string }[]; colour?: string | null; standard?: string | null; branding?: string | null; details?: string | null };
};
