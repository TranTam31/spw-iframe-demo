import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"], // esm cho npm, iife cho CDN (gắn vào window)
  dts: true, // Tự động tạo file .d.ts
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  globalName: "WidgetSDK", // Tên biến khi dùng thẻ <script>
});
