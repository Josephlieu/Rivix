// Order request values safe to use in the browser too (no server imports).
export const MAX_OPEN_REQUESTS = 10; // keep in step with the trigger in audit-docs/deliverables/task-05-order-requests.sql
export const OPEN_LIMIT_MESSAGE = `You already have ${MAX_OPEN_REQUESTS} open requests. Please wait for RIVIX to answer some of them before sending another.`;
export type RequestItem = { product_name: string; sizes: { size: string; qty: number }[]; branding: string | null };
