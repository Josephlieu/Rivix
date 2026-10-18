// Lets plain Node load the app's TypeScript files that import each other without a file extension.
// Use:  node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs <script>
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.{1,2}\\//.test(specifier)) return next(specifier + '.ts', context); throw e; }
}`));
