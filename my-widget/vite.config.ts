import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    outDir: "dist",

    // Tạo các file assets trong folder assets/
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },

    // Inline small assets như fonts, icons
    assetsInlineLimit: 4096,

    // Sử dụng esbuild để minify (không cần cài terser)
    minify: "esbuild",
  },

  // Đảm bảo React chỉ có 1 bản duy nhất
  resolve: {
    dedupe: ["react", "react-dom"],
  },

  define: {
    "process.env.WIDGET_ID": JSON.stringify(
      process.env.WIDGET_ID || "unknown-widget"
    ),
  },
});
