import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Lint for the whole app. The old Replication and Hiring pages are being rebuilt
// (see audit-docs/22-code-quality-review.md), so they are ignored for now.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'scripts/**',
    'public/**',
    'src/app/admin/replication/**',
    'src/app/portal/_replication-disabled/**',
    'src/lib/CertificatePDF.tsx',
    'src/app/admin/hiring/**',
    'src/lib/TechPackPDF.tsx',
    'src/lib/hiringStorage.ts',
    'src/lib/garmentAiAnalysis.ts',
    'src/lib/captureFlatSketch.ts',
  ]),
  {
    rules: {
      // Existing code uses `any` in places; warn (don't fail) until it is cleaned up.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/no-unescaped-entities': 'off',
      // "Load data when the page opens" is a normal pattern here; a shared data hook (plan D in
      // audit-docs/22-code-quality-review.md) will replace it. Warn for now.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
