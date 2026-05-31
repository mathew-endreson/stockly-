import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const normalizeBasePath = (value: string | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000';
  const basePath = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    base: basePath,
    plugins: [inspectAttr(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      host: "0.0.0.0",
      // Allow opening the dev server from any LAN hostname/IP without manual edits.
      allowedHosts: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      sourcemap: false,
      minify: 'esbuild',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            // NOTE: React (and its CJS-published packages: react-dom, scheduler,
            // jsx-runtime, react-is, use-sync-external-store, prop-types) must NOT
            // be force-grouped here. Doing so reorders the @rollup/plugin-commonjs
            // interop and leaves React's exports object undefined at init, crashing
            // with "Cannot set properties of undefined (setting 'Activity')".
            // Let Rollup keep React in the default vendor handling.
            if (id.includes('react-router')) return 'router';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('framer-motion')) return 'framer';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('xlsx')) return 'xlsx';
            if (id.includes('html5-qrcode')) return 'qrcode';
            if (id.includes('embla-carousel')) return 'carousel';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            if (id.includes('lucide-react') || id.includes('react-icons')) return 'icons';
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) return 'forms';
            if (id.includes('date-fns') || id.includes('react-day-picker')) return 'date';
            if (id.includes('sonner') || id.includes('vaul') || id.includes('cmdk')) return 'ui-misc';
            return undefined;
          },
        },
      },
    },
    esbuild: {
      legalComments: 'none',
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  };
});
