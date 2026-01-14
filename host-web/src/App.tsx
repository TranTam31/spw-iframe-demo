import { useState, useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import * as TweakpaneImagePlugin from "@kitschpatrol/tweakpane-plugin-image";
import { ArrowLeft, AlertCircle, Settings } from "lucide-react";

// ============================================================
// WIDGET LOADER CONFIG - Easy production migration
// ============================================================

/**
 * Environment-aware widget configuration
 *
 * Development: Load from local files in public/widgets/
 * Production: Fetch from server/CDN
 */

const WIDGET_LOADER_CONFIG = {
  // Change this to 'production' when deploying
  environment: "development",

  // Development: local file paths
  development: {
    // Files are copied from widget/dist/ to public/widgets/
    basePath: "/widgets",
    getWidgetPath: (widgetId: string) =>
      `/widgets/${widgetId}/widget-embedded.html`,
  },

  // Production: server URLs
  production: {
    // Update this to your actual server domain
    basePath: "https://your-api-domain.com/api/widgets",
    getWidgetPath: (widgetId: string) =>
      `https://your-api-domain.com/api/widgets/${widgetId}/html`,
  },
};

// ============================================================
// WIDGET CACHE (Optional: cache loaded HTML to avoid re-fetching)
// ============================================================

class WidgetCache {
  private static cache = new Map<string, string>();
  private static ttl = 1000 * 60 * 60; // 1 hour
  private static timestamps = new Map<string, number>();

  static set(widgetId: string, html: string) {
    this.cache.set(widgetId, html);
    this.timestamps.set(widgetId, Date.now());
    console.log(`💾 Cached widget: ${widgetId}`);
  }

  static get(widgetId: string): string | null {
    const timestamp = this.timestamps.get(widgetId);

    if (!timestamp) return null;

    // Check if cache has expired
    if (Date.now() - timestamp > this.ttl) {
      this.cache.delete(widgetId);
      this.timestamps.delete(widgetId);
      return null;
    }

    return this.cache.get(widgetId) || null;
  }

  static clear(widgetId?: string) {
    if (widgetId) {
      this.cache.delete(widgetId);
      this.timestamps.delete(widgetId);
    } else {
      this.cache.clear();
      this.timestamps.clear();
    }
  }
}

// ============================================================
// WIDGET HTML LOADER
// ============================================================

async function loadWidgetHtml(widgetId: string): Promise<string> {
  const config = WIDGET_LOADER_CONFIG;
  const isDev = config.environment === "development";

  // Check cache first
  const cached = WidgetCache.get(widgetId);
  if (cached) {
    console.log(`📦 Using cached widget: ${widgetId}`);
    return cached;
  }

  try {
    const path = isDev
      ? config.development.getWidgetPath(widgetId)
      : config.production.getWidgetPath(widgetId);

    console.log(`📥 Loading widget from: ${path}`);

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(
        `Failed to load widget: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();

    // Cache it
    WidgetCache.set(widgetId, html);

    return html;
  } catch (error) {
    console.error(`❌ Failed to load widget ${widgetId}:`, error);
    throw error;
  }
}

// ============================================================
// TYPES
// ============================================================

interface WidgetDefinition {
  name: string;
  version: string;
  description?: string;
  schema: Record<string, any>;
}

interface WidgetInfo {
  name: string;
  id: string;
}

// ============================================================
// SCHEMA UTILITIES
// ============================================================

class SchemaProcessor {
  static extractDefaultsFromSchema(
    schema: Record<string, any>
  ): Record<string, any> {
    const config: Record<string, any> = {};

    Object.keys(schema).forEach((key) => {
      const field = schema[key];

      if (field.type === "folder") {
        if (field.fields) {
          config[key] = this.extractDefaultsFromSchema(field.fields);
        }
      } else {
        if (field.default !== undefined) {
          config[key] = field.default;
        }
      }
    });

    return config;
  }
}

// ============================================================
// TWEAKPANE BUILDER WITH VISIBILITY SUPPORT
// ============================================================

class TweakpaneBuilder {
  private pane: any;
  private config: Record<string, any>;
  private schema: Record<string, any>;
  private onChange: (config: Record<string, any>) => void;
  private controlsMap: Map<string, any> = new Map();

  constructor(
    pane: any,
    config: Record<string, any>,
    schema: Record<string, any>,
    onChange: (config: Record<string, any>) => void
  ) {
    this.pane = pane;
    this.config = config;
    this.schema = schema;
    this.onChange = onChange;
  }

  build() {
    Object.keys(this.schema).forEach((key) => {
      const field = this.schema[key];
      this.processField(key, field, this.pane, this.config, []);
    });

    this.pane.on("change", async () => {
      this.updateVisibility();
      const serializedConfig = await this.serializeConfig(this.config);
      this.onChange(serializedConfig);
    });

    this.updateVisibility();
  }

  private checkVisibility(visibleIf: any): boolean {
    if (!visibleIf) return true;

    const { param, equals, notEquals, in: inArray } = visibleIf;
    const value = this.getConfigValue(param);

    if (equals !== undefined) {
      return value === equals;
    }

    if (notEquals !== undefined) {
      return value !== notEquals;
    }

    if (inArray !== undefined) {
      return inArray.includes(value);
    }

    return true;
  }

  private getConfigValue(path: string): any {
    const parts = path.split(".");
    let value = this.config;
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    return value;
  }

  private updateVisibility() {
    this.controlsMap.forEach((control, path) => {
      const field = this.getFieldFromPath(path);
      if (field && field.visibleIf) {
        const visible = this.checkVisibility(field.visibleIf);
        control.hidden = !visible;
      }
    });
  }

  async serializeConfig(
    config: Record<string, any>
  ): Promise<Record<string, any>> {
    const serialized: Record<string, any> = {};

    for (const key of Object.keys(config)) {
      const value = config[key];

      if (value === null || value === undefined) {
        serialized[key] = value;
      } else if (value instanceof HTMLImageElement) {
        const url = value.src || "";
        if (url.startsWith("blob:")) {
          try {
            serialized[key] = await this.blobUrlToDataUrl(url);
          } catch (err) {
            console.warn("Failed to convert blob URL:", err);
            serialized[key] = "";
          }
        } else {
          serialized[key] = url;
        }
      } else if (typeof value === "object" && !Array.isArray(value)) {
        serialized[key] = await this.serializeConfig(value);
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  private async blobUrlToDataUrl(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private getFieldFromPath(path: string): any {
    const parts = path.split(".");
    let current = this.schema;

    for (const part of parts) {
      if (!current) return null;
      if (current[part]) {
        current = current[part];
      } else if (current.fields && current.fields[part]) {
        current = current.fields[part];
      } else {
        return null;
      }
    }

    return current;
  }

  private processField(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[]
  ) {
    if (field.type === "folder") {
      this.buildFolder(key, field, parentPane, parentConfig, pathPrefix);
    } else {
      this.buildControl(key, field, parentPane, parentConfig, pathPrefix);
    }
  }

  private buildFolder(
    key: string,
    folderSchema: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[]
  ) {
    const folder = parentPane.addFolder({
      title: folderSchema.title || key,
      expanded: folderSchema.expanded ?? true,
    });

    const currentPath = [...pathPrefix, key].join(".");
    this.controlsMap.set(currentPath, folder);

    if (!parentConfig[key]) {
      parentConfig[key] = {};
    }

    if (folderSchema.fields) {
      Object.keys(folderSchema.fields).forEach((fieldKey) => {
        const field = folderSchema.fields[fieldKey];
        this.processField(fieldKey, field, folder, parentConfig[key], [
          ...pathPrefix,
          key,
        ]);
      });
    }
  }

  private buildControl(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[]
  ) {
    const options: any = {
      label: field.label || key,
    };

    if (parentConfig[key] === undefined && field.default !== undefined) {
      parentConfig[key] = field.default;
    }

    let control: any = null;

    switch (field.type) {
      case "string":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "number":
        if (field.min !== undefined) options.min = field.min;
        if (field.max !== undefined) options.max = field.max;
        if (field.step !== undefined) options.step = field.step;
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "boolean":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "color":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "image":
        options.view = "input-image";
        if (field.placeholder) {
          options.placeholder = field.placeholder;
        }
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "select":
        if (field.options) {
          options.options = field.options.reduce((acc: any, opt: any) => {
            acc[opt] = opt;
            return acc;
          }, {});
        }
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      default:
        console.warn(`Unknown field type: ${field.type} for key: ${key}`);
    }

    if (control) {
      const currentPath = [...pathPrefix, key].join(".");
      this.controlsMap.set(currentPath, control);
    }
  }
}

// ============================================================
// WIDGET HOST COMPONENT
// ============================================================

function WidgetHost({
  widget,
  onExit,
}: {
  widget: WidgetInfo;
  onExit: () => void;
}) {
  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);
  const messageQueueRef = useRef<any[]>([]);

  // Load widget HTML and communicate with iframe
  useEffect(() => {
    const loadWidget = async () => {
      setLoading(true);
      setError(null);
      setIframeReady(false);

      try {
        const htmlContent = await loadWidgetHtml(widget.id);

        // Set srcdoc to load HTML directly
        if (iframeRef.current) {
          iframeRef.current.srcdoc = htmlContent;
        }

        console.log(`✅ Widget HTML loaded for: ${widget.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setLoading(false);
        console.error(err);
      }
    };

    loadWidget();
  }, [widget.id]);

  // Handle iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log("🎬 Iframe loaded successfully");
      setTimeout(() => {
        setIframeReady(true);
        // Flush message queue
        if (messageQueueRef.current.length > 0) {
          console.log(
            `📨 Flushing ${messageQueueRef.current.length} queued messages`
          );
          messageQueueRef.current.forEach((msg) => {
            iframe.contentWindow?.postMessage(msg, "*");
          });
          messageQueueRef.current = [];
        }
      }, 300);
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, []);

  // Listen to widget messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        const def = event.data.payload;

        if (!def.name || !def.schema) {
          setError("Invalid widget definition - missing name or schema");
          return;
        }

        console.log("📦 Widget definition received:", def);
        setWidgetDef(def);
        setLoading(false);
        setError(null);
      }

      if (event.data.type === "EVENT") {
        console.log("📣 Widget event:", event.data.event, event.data.payload);
      }

      if (event.data.type === "ERROR") {
        console.error("❌ Widget error:", event.data.payload);
        setError(event.data.payload?.message || "Widget error");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Helper to send messages
  const sendMessage = (message: any) => {
    if (iframeRef.current?.contentWindow && iframeReady) {
      console.log("📤 Sending to widget:", message.type);
      iframeRef.current.contentWindow.postMessage(message, "*");
    } else {
      console.log("⏳ Queuing message (iframe not ready):", message.type);
      messageQueueRef.current.push(message);
    }
  };

  // Setup Tweakpane when widget definition is ready
  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    try {
      const pane = new Pane({
        container: paneRef.current,
        title: widgetDef.name,
      });

      pane.registerPlugin(TweakpaneImagePlugin);
      paneInstanceRef.current = pane;

      const initialConfig = SchemaProcessor.extractDefaultsFromSchema(
        widgetDef.schema
      );
      console.log("🎯 Initial config extracted:", initialConfig);

      const handleConfigChange = (newConfig: Record<string, any>) => {
        console.log("🔄 Config changed, sending to widget");
        setConfig(newConfig);
        console.log(config);
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: newConfig,
        });
      };

      const builder = new TweakpaneBuilder(
        pane,
        initialConfig,
        widgetDef.schema,
        handleConfigChange
      );
      builder.build();

      setTimeout(async () => {
        const serializedConfig = await builder.serializeConfig(initialConfig);
        handleConfigChange(serializedConfig);
      }, 100);
    } catch (err) {
      console.error("❌ Tweakpane setup error:", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    }

    return () => {
      if (paneInstanceRef.current) {
        paneInstanceRef.current.dispose();
        paneInstanceRef.current = null;
      }
    };
  }, [widgetDef, iframeReady]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <div className="flex-1 p-8 md:p-12">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-gray-500 mb-8 hover:text-black transition-colors"
        >
          <ArrowLeft size={20} /> Quay lại
        </button>

        <div className="max-w-2xl mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
          <iframe
            ref={iframeRef}
            className="w-full h-[600px] border-0"
            title={widget.name}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {loading && !error && (
          <div className="text-center mt-8 text-gray-400 flex items-center justify-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            Đang tải widget...
          </div>
        )}

        {error && (
          <div className="mt-8 max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle
              className="text-red-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <div className="font-bold text-red-800">Lỗi</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}
      </div>

      <div className="w-80 bg-white border-l p-4 shadow-lg flex flex-col">
        <div className="flex-1 overflow-y-auto" ref={paneRef} />

        {widgetDef && (
          <div className="mt-4 space-y-2">
            <div className="p-3 bg-gray-50 rounded-xl text-xs">
              <div className="font-bold text-gray-800">{widgetDef.name}</div>
              <div className="text-gray-400">v{widgetDef.version}</div>
              {widgetDef.description && (
                <div className="mt-1 text-gray-600">
                  {widgetDef.description}
                </div>
              )}
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-[10px] text-indigo-400 font-mono italic">
              Environment: {WIDGET_LOADER_CONFIG.environment}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

const AVAILABLE_WIDGETS: WidgetInfo[] = [
  {
    id: "countdown-timer",
    name: "Đồng hồ đếm ngược",
  },
];

export default function App() {
  const [selectedWidget, setSelectedWidget] = useState<WidgetInfo | null>(null);

  if (selectedWidget) {
    return (
      <WidgetHost
        widget={selectedWidget}
        onExit={() => setSelectedWidget(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <div className="max-w-5xl w-full">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">
            Widget Studio
          </h1>
          <p className="text-gray-500 mb-2">
            Flexible parameter system cho widgets
          </p>
          <p className="text-sm text-green-600 font-mono">
            ✓ Self-contained HTML • Schema-driven • Auto UI generation
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {AVAILABLE_WIDGETS.map((widget) => (
            <button
              key={widget.id}
              onClick={() => setSelectedWidget(widget)}
              className="group bg-white p-10 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all border border-gray-50 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Settings className="text-indigo-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800">{widget.name}</h3>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
