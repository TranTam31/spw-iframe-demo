import { useState, useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import { ArrowLeft, Settings, AlertCircle } from "lucide-react";

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
  url: string;
  id: string;
}

// ============================================================
// SCHEMA UTILITIES
// ============================================================

class SchemaProcessor {
  /**
   * Extract default values from schema and build nested config object
   * Schema structure: { key: { type, default, fields?, ... } }
   */
  static extractDefaultsFromSchema(
    schema: Record<string, any>
  ): Record<string, any> {
    const config: Record<string, any> = {};

    Object.keys(schema).forEach((key) => {
      const field = schema[key];

      if (field.type === "folder") {
        // Folder: recursively process fields
        if (field.fields) {
          config[key] = this.extractDefaultsFromSchema(field.fields);
        }
      } else {
        // Regular field: extract default value
        if (field.default !== undefined) {
          config[key] = field.default;
        }
      }
    });

    return config;
  }
}

// ============================================================
// TWEAKPANE BUILDER
// ============================================================

class TweakpaneBuilder {
  private pane: Pane;
  private config: Record<string, any>;
  private onChange: (config: Record<string, any>) => void;

  constructor(
    pane: Pane,
    config: Record<string, any>,
    onChange: (config: Record<string, any>) => void
  ) {
    this.pane = pane;
    this.config = config;
    this.onChange = onChange;
  }

  /**
   * Build Tweakpane UI from schema
   */
  build(schema: Record<string, any>) {
    Object.keys(schema).forEach((key) => {
      const field = schema[key];
      this.processField(key, field, this.pane, this.config);
    });

    // Listen for changes
    this.pane.on("change", () => {
      this.onChange({ ...this.config });
    });
  }

  private processField(
    key: string,
    field: any,
    parentPane: Pane,
    parentConfig: Record<string, any>
  ) {
    if (field.type === "folder") {
      this.buildFolder(key, field, parentPane, parentConfig);
    } else {
      this.buildControl(key, field, parentPane, parentConfig);
    }
  }

  private buildFolder(
    key: string,
    folderSchema: any,
    parentPane: any,
    parentConfig: Record<string, any>
  ) {
    // Create folder in Tweakpane
    const folder = parentPane.addFolder({
      title: folderSchema.title || key,
      expanded: folderSchema.expanded ?? true,
    });

    // Ensure config has nested object for this folder
    if (!parentConfig[key]) {
      parentConfig[key] = {};
    }

    // Process all fields inside folder
    if (folderSchema.fields) {
      Object.keys(folderSchema.fields).forEach((fieldKey) => {
        const field = folderSchema.fields[fieldKey];
        this.processField(fieldKey, field, folder, parentConfig[key]);
      });
    }
  }

  private buildControl(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>
  ) {
    const options: any = {
      label: field.label || key,
    };

    // Initialize with default value if not exists
    if (parentConfig[key] === undefined && field.default !== undefined) {
      parentConfig[key] = field.default;
    }

    // Build appropriate control based on type
    switch (field.type) {
      case "string":
        parentPane.addBinding(parentConfig, key, options);
        break;

      case "number":
        if (field.min !== undefined) options.min = field.min;
        if (field.max !== undefined) options.max = field.max;
        if (field.step !== undefined) options.step = field.step;
        parentPane.addBinding(parentConfig, key, options);
        break;

      case "boolean":
        parentPane.addBinding(parentConfig, key, options);
        break;

      case "color":
        parentPane.addBinding(parentConfig, key, options);
        break;

      case "select":
        if (field.options) {
          options.options = field.options.reduce((acc: any, opt: any) => {
            acc[opt] = opt;
            return acc;
          }, {});
        }
        parentPane.addBinding(parentConfig, key, options);
        break;

      default:
        console.warn(`Unknown field type: ${field.type} for key: ${key}`);
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

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);

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
        setError(null);
      }

      if (event.data.type === "EVENT") {
        console.log("📣 Widget event:", event.data.event, event.data.payload);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Setup Tweakpane when widget definition is ready
  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    // Dispose old pane
    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    try {
      // Create Tweakpane instance
      const pane = new Pane({
        container: paneRef.current,
        title: widgetDef.name,
      });
      paneInstanceRef.current = pane;

      // Extract initial config from schema defaults
      const initialConfig = SchemaProcessor.extractDefaultsFromSchema(
        widgetDef.schema
      );
      console.log("🎯 Initial config extracted:", initialConfig);

      // Callback when config changes
      const handleConfigChange = (newConfig: Record<string, any>) => {
        console.log("📤 Sending config to widget:", newConfig);
        setConfig(newConfig);

        // Send to widget iframe
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: "PARAMS_UPDATE",
              payload: newConfig,
            },
            "*"
          );
        }
      };

      // Build Tweakpane UI from schema
      const builder = new TweakpaneBuilder(
        pane,
        initialConfig,
        handleConfigChange
      );
      builder.build(widgetDef.schema);

      // Send initial config to widget
      setTimeout(() => handleConfigChange(initialConfig), 100);
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
  }, [widgetDef]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <div className="flex-1 p-8 md:p-12">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-gray-500 mb-8 hover:text-black transition-colors"
        >
          <ArrowLeft size={20} /> Quay lại
        </button>

        <div className="max-w-2xl mx-auto bg-white rounded-4xl shadow-2xl overflow-hidden border border-gray-100">
          <iframe
            ref={iframeRef}
            src={widget.url}
            className="w-full h-150 border-0"
            title={widget.name}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {!widgetDef && !error && (
          <div className="text-center mt-8 text-gray-400 flex items-center justify-center gap-2">
            <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-600 rounded-full" />
            Đang tải widget...
          </div>
        )}

        {error && (
          <div className="mt-8 max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
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
              Powered by Tweakpane v4
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
    id: "countdown",
    name: "Đồng hồ đếm ngược",
    url: "http://localhost:5174",
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
            Unity-inspired parameter system cho Education
          </p>
          <p className="text-sm text-green-600 font-mono">
            ✓ Fluent API • Schema-driven • Auto UI generation
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
