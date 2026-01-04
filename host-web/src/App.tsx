import { useState, useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import { ArrowLeft, Settings } from "lucide-react";

interface WidgetInfo {
  name: string;
  url: string;
  id: string;
}

interface WidgetDefinition {
  name: string;
  defaultConfig: Record<string, any>;
  setupTweakpaneCode: string;
}

const AVAILABLE_WIDGETS: WidgetInfo[] = [
  {
    id: "countdown",
    name: "Đồng hồ đếm ngược",
    url: "http://localhost:5174",
  },
  // Người dùng thêm widget khác vào đây
];

function WidgetHost({
  widget,
  onExit,
}: {
  widget: WidgetInfo;
  onExit: () => void;
}) {
  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);

  // Lắng nghe message từ widget iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Kiểm tra origin để bảo mật (tùy chọn)
      // if (event.origin !== widget.url) return;

      if (event.data.type === "WIDGET_READY") {
        const def = event.data.payload;
        setWidgetDef(def);
        setConfig(def.defaultConfig);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widget.url]);

  // Setup Tweakpane khi có widget definition
  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    // Dispose pane cũ
    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    const pane = new Pane({
      container: paneRef.current,
      title: `Cài đặt ${widgetDef.name}`,
    });
    paneInstanceRef.current = pane;

    // Tạo config proxy cho Tweakpane bind
    const configProxy = { ...widgetDef.defaultConfig };

    // Callback khi config thay đổi
    const onChange = (newConfig: Record<string, any>) => {
      setConfig(newConfig);
      // Gửi xuống iframe
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

    // Execute setup code từ widget
    try {
      // Deserialize function string
      const setupFn = eval(`(${widgetDef.setupTweakpaneCode})`);
      setupFn({ pane, config: configProxy, onChange });
    } catch (error) {
      console.error("Error setting up Tweakpane:", error);
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

        {!widgetDef && (
          <div className="text-center mt-8 text-gray-400">
            Đang tải widget từ {widget.url}...
          </div>
        )}
      </div>

      <div className="w-80 bg-white border-l p-4 shadow-lg flex flex-col">
        <div className="flex-1 overflow-y-auto" ref={paneRef} />
        <div className="mt-4 p-3 bg-indigo-50 rounded-xl text-[10px] text-indigo-400 font-mono italic">
          Powered by Tweakpane v4
        </div>
      </div>
    </div>
  );
}

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
            Load widgets từ URL với Tweakpane configuration
          </p>
          <p className="text-sm text-indigo-600 font-mono">
            Mỗi widget là 1 project Vite riêng biệt
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
              <p className="text-xs text-gray-400 mt-2 font-mono">
                {widget.url}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
