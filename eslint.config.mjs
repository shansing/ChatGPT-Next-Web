// import { defineConfig, globalIgnores } from "eslint/config";
// import nextVitals from 'eslint-config-next/core-web-vitals.js'
// import prettier from "eslint-plugin-prettier";
// import path from "node:path";
// import { fileURLToPath } from "node:url";
//
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
//
// export default defineConfig([globalIgnores(["public/serviceWorker.js"]), {
//     ...nextVitals,
//
//     plugins: {
//         prettier,
//     }
// }]);


import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'

const eslintConfig = defineConfig([
    ...nextVitals,
    prettier,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'next-env.d.ts',
        "public/serviceWorker.js",
    ]),
])

export default eslintConfig
