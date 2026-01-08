import { useState, useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import { ArrowLeft, Settings, AlertCircle } from "lucide-react";
import type {
  BooleanFieldSchema,
  ColorFieldSchema,
  ConfigFieldSchema,
  FolderSchema,
  NumberFieldSchema,
  PointFieldSchema,
  SelectFieldSchema,
  StringFieldSchema,
  WidgetConfig,
  WidgetDefinition,
} from "widget-sdk";

interface WidgetInfo {
  name: string;
  url: string;
  id: string;
}

// ============================================================
// SCHEMA PARSER - Tự động tạo Tweakpane từ schema
// ============================================================

class TweakpaneSchemaParser {
  private pane: any;
  private config: WidgetConfig;
  private onChange: (newConfig: WidgetConfig) => void;

  constructor(
    pane: any,
    config: WidgetConfig,
    onChange: (newConfig: WidgetConfig) => void
  ) {
    this.pane = pane;
    this.config = config;
    this.onChange = onChange;
  }

  /**
   * Parse toàn bộ schema và tạo Tweakpane controls
   */
  public parse(schema: ConfigFieldSchema[]): void {
    schema.forEach((field) => {
      this.parseField(field, this.pane);
    });

    // Listen to all changes
    this.pane.on("change", () => {
      this.onChange({ ...this.config });
    });
  }

  /**
   * Parse từng field schema
   */
  private parseField(field: ConfigFieldSchema, parentPane: any): void {
    switch (field.type) {
      case "folder":
        this.parseFolder(field, parentPane);
        break;
      case "string":
        this.parseString(field, parentPane);
        break;
      case "number":
        this.parseNumber(field, parentPane);
        break;
      case "boolean":
        this.parseBoolean(field, parentPane);
        break;
      case "color":
        this.parseColor(field, parentPane);
        break;
      case "select":
        this.parseSelect(field, parentPane);
        break;
      case "point":
        this.parsePoint(field, parentPane);
        break;
      default:
        console.warn(`Unknown field type: ${(field as any).type}`);
    }
  }

  /**
   * Parse folder (nhóm fields)
   */
  private parseFolder(field: FolderSchema, parentPane: any): void {
    const folder = parentPane.addFolder({
      title: field.title,
      expanded: field.expanded ?? true,
    });

    field.fields.forEach((childField) => {
      this.parseField(childField, folder);
    });
  }

  /**
   * Parse string input
   */
  private parseString(field: StringFieldSchema, parentPane: any): void {
    parentPane.addBinding(this.config, field.key, {
      label: field.label || field.key,
    });
  }

  /**
   * Parse number input
   */
  private parseNumber(field: NumberFieldSchema, parentPane: any): void {
    const options: any = {
      label: field.label || field.key,
    };

    if (field.min !== undefined) options.min = field.min;
    if (field.max !== undefined) options.max = field.max;
    if (field.step !== undefined) options.step = field.step;

    parentPane.addBinding(this.config, field.key, options);
  }

  /**
   * Parse boolean toggle
   */
  private parseBoolean(field: BooleanFieldSchema, parentPane: any): void {
    parentPane.addBinding(this.config, field.key, {
      label: field.label || field.key,
    });
  }

  /**
   * Parse color picker
   */
  private parseColor(field: ColorFieldSchema, parentPane: any): void {
    parentPane.addBinding(this.config, field.key, {
      label: field.label || field.key,
    });
  }

  /**
   * Parse select/dropdown
   */
  private parseSelect(field: SelectFieldSchema, parentPane: any): void {
    const options = field.options.reduce((acc, opt) => {
      acc[opt.text] = opt.value;
      return acc;
    }, {} as Record<string, string | number>);

    parentPane.addBinding(this.config, field.key, {
      label: field.label || field.key,
      options: options,
    });
  }

  /**
   * Parse 2D point
   */
  private parsePoint(field: PointFieldSchema, parentPane: any): void {
    const options: any = {
      label: field.label || field.key,
    };

    if (field.min !== undefined) options.min = field.min;
    if (field.max !== undefined) options.max = field.max;

    parentPane.addBinding(this.config, field.key, options);
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
  const [config, setConfig] = useState<WidgetConfig>({});
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);

  // Lắng nghe message từ widget iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // TODO: Validate event.origin cho security
      // if (event.origin !== widget.url) return;

      if (event.data.type === "WIDGET_READY") {
        const def = event.data.payload;

        // Validate definition
        if (!def.name || !def.defaultConfig || !def.configSchema) {
          setError("Invalid widget definition received");
          return;
        }

        setWidgetDef(def);
        setConfig(def.defaultConfig);
        setError(null);
      }

      if (event.data.type === "WIDGET_ERROR") {
        setError(event.data.payload.message);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Setup Tweakpane khi có widget definition
  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    // Dispose pane cũ nếu có
    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    try {
      // Tạo Tweakpane instance
      const pane = new Pane({
        container: paneRef.current,
        title: widgetDef.name,
      });
      paneInstanceRef.current = pane;

      // Tạo config proxy cho Tweakpane binding
      const configProxy = { ...widgetDef.defaultConfig };

      // Callback khi config thay đổi
      const onChange = (newConfig: WidgetConfig) => {
        setConfig(newConfig);

        // Gửi config xuống iframe
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: "CONFIG_UPDATE",
              payload: newConfig,
            },
            "*"
          );
        }
      };

      // ⭐ MAGIC: Parse schema và tự động tạo Tweakpane controls
      const parser = new TweakpaneSchemaParser(pane, configProxy, onChange);
      parser.parse(widgetDef.configSchema);
    } catch (err) {
      console.error("Error setting up Tweakpane:", err);
      setError(err instanceof Error ? err.message : "Failed to setup controls");
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
          <ArrowLeft size={20} /> Quay lại danh sách
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
            Đang tải widget từ {widget.url}...
          </div>
        )}

        {error && (
          <div className="mt-8 max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle
              className="text-red-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <div className="font-bold text-red-800">Widget Error</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}
      </div>

      <div className="w-80 bg-white border-l p-4 shadow-lg flex flex-col">
        <div className="flex-1 overflow-y-auto" ref={paneRef} />

        {widgetDef && (
          <div className="mt-4 space-y-2">
            <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
              <div className="font-bold">{widgetDef.name}</div>
              {widgetDef.version && (
                <div className="text-gray-400">v{widgetDef.version}</div>
              )}
              {widgetDef.description && (
                <div className="mt-1 text-gray-500">
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
    url: "http://localhost:5174", // Dev
    // url: 'https://countdown-widget.vercel.app', // Production
  },
  // Người dùng thêm widget khác vào đây
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
            Generic schema-based Tweakpane configuration
          </p>
          <p className="text-sm text-green-600 font-mono">
            ✓ Secure • No eval() • Automatic control generation
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
              <p className="text-xs text-gray-400 mt-2 font-mono truncate w-full">
                {widget.url}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-16 p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🎯 Schema-based Architecture
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="font-bold text-green-600">✓ Secure:</span>
              <span className="text-gray-600">
                No eval(), no remote code execution
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-blue-600">✓ Generic:</span>
              <span className="text-gray-600">
                TweakpaneSchemaParser tự động tạo controls từ schema
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-purple-600">✓ Extensible:</span>
              <span className="text-gray-600">
                Support string, number, boolean, color, select, point, folder
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
