// Lets plain Node load the app's .ts AND .tsx files (React components, the PDF) for tests: compiles them with the project's
// TypeScript and resolves the "@/..." alias to src/. Use:  node --no-warnings --import ./scripts/e2e/tsx-resolve.mjs <script>
import { register } from 'node:module';
register('./tsx-hooks.mjs', import.meta.url);
