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
  defaults: Record<string, any>;
}

interface WidgetInfo {
  name: string;
  url: string;
  id: string;
}

// ============================================================
// GENERIC TWEAKPANE SCHEMA PARSER
// ============================================================

class TweakpaneSchemaParser {
  private pane: any;
  private config: Record<string, any>;
  private onChange: (config: Record<string, any>) => void;
  private folders: Map<string, any> = new Map();

  constructor(
    pane: any,
    config: Record<string, any>,
    onChange: (config: Record<string, any>) => void
  ) {
    this.pane = pane;
    this.config = config;
    this.onChange = onChange;
  }

  parse(schema: Record<string, any>) {
    // Group fields by folder
    const grouped: Record<string, any[]> = { _root: [] };

    Object.keys(schema).forEach((key) => {
      const field = schema[key];

      if (field.type === "folder") {
        grouped[key] = [];
        // Add folder itself
        grouped._root.push({ key, field, isFolder: true });
      } else {
        // Check if field belongs to a folder
        const folderKey = key.split(".")[0];
        if (schema[folderKey] && schema[folderKey].type === "folder") {
          if (!grouped[folderKey]) grouped[folderKey] = [];
          grouped[folderKey].push({ key, field });
        } else {
          grouped._root.push({ key, field });
        }
      }
    });

    // Render root level fields and folders
    grouped._root.forEach(({ key, field, isFolder }) => {
      if (isFolder) {
        this.addFolder(key, field, grouped[key] || []);
      } else {
        this.addField(key, field, this.pane);
      }
    });

    // Listen to all changes
    this.pane.on("change", () => {
      this.onChange({ ...this.config });
    });
  }

  private addFolder(key: string, folderSchema: any, fields: any[]) {
    const folder = this.pane.addFolder({
      title: folderSchema.title,
      expanded: folderSchema.expanded ?? true,
    });

    this.folders.set(key, folder);

    fields.forEach(({ key: fieldKey, field }) => {
      this.addField(fieldKey, field, folder);
    });
  }

  private addField(key: string, field: any, target: any) {
    const options: any = {
      label: field.label || key.split(".").pop(),
    };

    switch (field.type) {
      case "string":
        target.addBinding(this.config, key, options);
        break;

      case "number":
        if (field.min !== undefined) options.min = field.min;
        if (field.max !== undefined) options.max = field.max;
        if (field.step !== undefined) options.step = field.step;
        target.addBinding(this.config, key, options);
        break;

      case "boolean":
        target.addBinding(this.config, key, options);
        break;

      case "color":
        target.addBinding(this.config, key, options);
        break;

      case "select":
        if (field.options) {
          const selectOptions = field.options.reduce((acc: any, opt: any) => {
            acc[opt] = opt;
            return acc;
          }, {});
          options.options = selectOptions;
        }
        target.addBinding(this.config, key, options);
        break;

      default:
        console.warn(`Unknown field type: ${field.type}`);
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

        if (!def.name || !def.schema || !def.defaults) {
          setError("Invalid widget definition");
          return;
        }

        setWidgetDef(def);
        setConfig(def.defaults);
        setError(null);
      }

      if (event.data.type === "EVENT") {
        console.log("Widget event:", event.data.event, event.data.payload);
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
      const pane = new Pane({
        container: paneRef.current,
        title: widgetDef.name,
      });
      paneInstanceRef.current = pane;

      const configProxy = { ...widgetDef.defaults };

      const onChange = (newConfig: Record<string, any>) => {
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

      // ⭐ Parse schema and auto-generate Tweakpane UI
      const parser = new TweakpaneSchemaParser(pane, configProxy, onChange);
      parser.parse(widgetDef.schema);
    } catch (err) {
      console.error("Tweakpane setup error:", err);
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

        <div className="max-w-2xl mx-auto bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100">
          <iframe
            ref={iframeRef}
            src={widget.url}
            className="w-full h-[600px] border-0"
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
            <AlertCircle
              className="text-red-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <div className="font-bold text-red-800">Error</div>
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
    url: "http://localhost:5174", // Dev mode
    // url: 'https://countdown-widget.vercel.app', // Production
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
            ✓ Fluent API • No eval() • Auto UI generation
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

        <div className="mt-16 p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🎮 Unity-like Architecture
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-600">Widget Dev:</span>
              <span className="text-gray-600">
                Define parameters với fluent API (param.string(),
                param.number()...)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-blue-600">Teacher:</span>
              <span className="text-gray-600">
                Configure parameters qua auto-generated Tweakpane UI
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-green-600">Student:</span>
              <span className="text-gray-600">
                Học với widget đã được config (immutable)
              </span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl font-mono text-xs">
            <div className="text-gray-500 mb-2">
              // Example widget definition:
            </div>
            <div className="text-indigo-600">parameters: {"{"}</div>
            <div className="ml-4 text-gray-700">
              title: param.string('Hello').label('Tiêu đề'),
            </div>
            <div className="ml-4 text-gray-700">
              duration: param.number(60).min(5).max(600),
            </div>
            <div className="ml-4 text-gray-700">
              color: param.color('#1f2937'),
            </div>
            <div className="text-indigo-600">{"}"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
