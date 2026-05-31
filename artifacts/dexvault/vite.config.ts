import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Replit plugins (only imported when needed, safely)
import { cartographer } from "@replit/vite-plugin-cartographer";
import { devBanner } from "@replit/vite-plugin-dev-banner";

const rawPort = process.env.PORT;

// safer fallback
const port = Number(rawPort) || 3000;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE PATH (safe for Vercel)
const basePath = process.env.BASE_PATH || "/";

/**
 * SPA history-API fallback plugin.
 *
 * Vite's built-in htmlFallbackMiddleware relies on the request having an
 * `Accept: text/html` header, which some proxies (including the Replit dev
 * proxy) may strip.  This plugin adds a secondary fallback that rewrites any
 * GET request that has no file extension (i.e. a client-side route like
 * /collection, /sets/sv8pt5, …) to /index.html, so hard-refreshes always
 * land on the SPA rather than returning 404.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-history-fallback',
    configureServer(server) {
      // Return a setup function; Vite calls it AFTER registering its own
      // internal middlewares, so real assets are still served correctly.
      return () => {
        server.middlewares.use((req, _res, next) => {
          if (req.method !== 'GET' || !req.url) return next();
          const url = req.url.split('?')[0];
          const isViteInternal = url.startsWith('/@') || url.startsWith('/node_modules');
          const isAsset = url.includes('.');
          if (!isViteInternal && !isAsset) {
            req.url = '/index.html';
          }
          next();
        });
      };
    },
  };
}

export default defineConfig({
  base: basePath,
  appType: 'spa',

  plugins: [
    spaFallback(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),

    // Only enable Replit dev tooling locally
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          cartographer({
            root: path.resolve(import.meta.dirname, ".."),
          }),
          devBanner(),
        ]
      : []),
  ],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets"
      ),
    },
    dedupe: ["react", "react-dom"],
  },

  root: path.resolve(import.meta.dirname),

  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },

  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },

  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
