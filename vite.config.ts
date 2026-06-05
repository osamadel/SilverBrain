import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// Tauri expects a fixed port and ignores VITE_ env interpolation for the host.
const host = process.env.TAURI_DEV_HOST;
const { version } = JSON.parse(readFileSync("package.json", "utf-8")) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      // Don't watch the Rust source tree.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Produce output Tauri can bundle. Targets match Tauri's webviews.
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
