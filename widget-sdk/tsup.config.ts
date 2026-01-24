import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  dts: true,
  splitting: false,
  clean: true,
  minify: true,
  globalName: "WidgetSDK",
  external: ["react", "react-dom"],
  platform: "browser",
});
