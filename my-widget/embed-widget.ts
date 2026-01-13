import fs from "fs";
import path from "path";

const DIST_DIR = path.join(process.cwd(), "dist");
const ASSETS_DIR = path.join(DIST_DIR, "assets");
const HTML_FILE = path.join(DIST_DIR, "index.html");
const EMBEDDED_OUTPUT = path.join(DIST_DIR, "widget-embedded.html");
const MANIFEST_OUTPUT = path.join(DIST_DIR, "widget-manifest.json");

// Read package.json for metadata
const packageJsonPath = path.join(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

const widgetMetadata = {
  name: packageJson.widgetName || packageJson.name || "Unknown Widget",
  version: packageJson.version || "1.0.0",
  description: packageJson.description || "",
  id: packageJson.widgetId || packageJson.name || "unknown-widget",
  buildTime: new Date().toISOString(),
};

console.log("🚀 Đang đóng gói Widget...");
console.log(`📦 Widget: ${widgetMetadata.name} v${widgetMetadata.version}`);

// ============================================================
// 1. Kiểm tra các file cần thiết
// ============================================================

if (!fs.existsSync(HTML_FILE)) {
  console.error(`❌ Không tìm thấy: ${HTML_FILE}`);
  console.error("Hãy chạy 'npm run build' trước");
  process.exit(1);
}

if (!fs.existsSync(ASSETS_DIR)) {
  console.error(`❌ Không tìm thấy folder assets: ${ASSETS_DIR}`);
  process.exit(1);
}

// ============================================================
// 2. Đọc file HTML gốc
// ============================================================

let htmlContent = fs.readFileSync(HTML_FILE, "utf-8");
console.log(`✓ Đọc HTML từ: ${HTML_FILE}`);

// ============================================================
// 3. Tìm các file assets
// ============================================================

const files = fs.readdirSync(ASSETS_DIR);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));

console.log(`📁 Files trong assets: ${files.join(", ")}`);

if (!jsFile) {
  console.warn("⚠️  Không tìm thấy file .js trong assets/");
}
if (!cssFile) {
  console.warn("⚠️  Không tìm thấy file .css trong assets/");
}

// ============================================================
// 4. Xoá các thẻ tham chiếu file bên ngoài
// ============================================================

// Xoá tất cả <script src="...">
const beforeScriptRemoval = htmlContent;
htmlContent = htmlContent.replace(
  /<script\b[^>]*src=["'][^"']*["'][^>]*><\/script>/gi,
  ""
);
if (beforeScriptRemoval !== htmlContent) {
  console.log("✓ Đã xoá các thẻ <script src>");
}

// Xoá tất cả <link rel="stylesheet">
const beforeLinkRemoval = htmlContent;
htmlContent = htmlContent.replace(
  /<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,
  ""
);
if (beforeLinkRemoval !== htmlContent) {
  console.log("✓ Đã xoá các thẻ <link rel=stylesheet>");
}

// Xoá các thẻ modulepreload
const beforeModulepreloadRemoval = htmlContent;
htmlContent = htmlContent.replace(
  /<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi,
  ""
);
if (beforeModulepreloadRemoval !== htmlContent) {
  console.log("✓ Đã xoá các thẻ modulepreload");
}

// ============================================================
// 5. INLINE CSS
// ============================================================

if (cssFile) {
  const cssPath = path.join(ASSETS_DIR, cssFile);
  const cssContent = fs.readFileSync(cssPath, "utf-8");
  const styleTag = `<style>\n${cssContent}\n</style>\n`;

  if (htmlContent.includes("</head>")) {
    htmlContent = htmlContent.replace("</head>", `${styleTag}</head>`);
  } else {
    htmlContent = styleTag + htmlContent;
  }

  console.log(`✓ Inline CSS (${cssFile})`);
} else {
  console.warn("⚠️  Không tìm file CSS để inline");
}

// ============================================================
// 6. INLINE JavaScript
// ============================================================

if (jsFile) {
  const jsPath = path.join(ASSETS_DIR, jsFile);
  const jsContent = fs.readFileSync(jsPath, "utf-8");

  // Không cần type="module" vì code đã được bundle bởi Vite
  const scriptTag = `<script>\n${jsContent}\n</script>\n`;

  if (htmlContent.includes("</body>")) {
    htmlContent = htmlContent.replace("</body>", `${scriptTag}</body>`);
  } else {
    htmlContent = htmlContent + scriptTag;
  }

  console.log(`✓ Inline JavaScript (${jsFile})`);
} else {
  console.warn("⚠️  Không tìm file JS để inline");
}

// ============================================================
// 7. Inject widget metadata
// ============================================================

const metadataScript = `<script>
window.__WIDGET_METADATA__ = ${JSON.stringify(widgetMetadata)}
</script>\n`;

if (htmlContent.includes("<head>")) {
  htmlContent = htmlContent.replace("<head>", `<head>\n${metadataScript}`);
} else {
  htmlContent = metadataScript + htmlContent;
}

console.log("✓ Inject metadata");

// ============================================================
// 8. Ghi file output
// ============================================================

fs.writeFileSync(EMBEDDED_OUTPUT, htmlContent, "utf-8");

const sizeKb = (htmlContent.length / 1024).toFixed(2);
console.log(
  `\n✅ Tạo: ${path.relative(process.cwd(), EMBEDDED_OUTPUT)} (${sizeKb} KB)`
);

// ============================================================
// 9. Tạo manifest file
// ============================================================

const manifest = {
  ...widgetMetadata,
  productionUrl: `https://your-domain.com/widgets/${widgetMetadata.id}/widget.html`,
  developmentPath: "./widget-embedded.html",
  size: {
    bytes: htmlContent.length,
    kilobytes: Math.ceil(htmlContent.length / 1024),
    megabytes: (htmlContent.length / (1024 * 1024)).toFixed(3),
  },
  checksum: {
    length: htmlContent.length,
  },
};

fs.writeFileSync(MANIFEST_OUTPUT, JSON.stringify(manifest, null, 2), "utf-8");
console.log(`✅ Tạo: ${path.relative(process.cwd(), MANIFEST_OUTPUT)}`);

// ============================================================
// 10. Summary
// ============================================================

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Widget Embedded Successfully! 🎉                          ║
╚════════════════════════════════════════════════════════════╝

📋 Metadata:
  • Name: ${widgetMetadata.name}
  • Version: ${widgetMetadata.version}
  • ID: ${widgetMetadata.id}
  • Size: ${sizeKb} KB

📁 Output files:
  • widget-embedded.html (Self-contained)
  • widget-manifest.json (Metadata)

🚀 Next steps:
  1. Copy widget-embedded.html to hostweb/public/widgets/
  2. Update HostWeb to load from file
  3. Test in browser

`);
