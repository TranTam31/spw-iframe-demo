import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import { WidgetSDK, WidgetDefinition } from "widget-sdk";
import "./index.css";

const widgetDefinition: WidgetDefinition = {
  name: "Đồng hồ đếm ngược",
  defaultConfig: {
    title: "Tập trung nào!!",
    duration: 60,
    timerColor: "#1f2937",
  },
  setupTweakpane: (context) => {
    const { pane, config, onChange } = context;

    pane.addBinding(config, "title", { label: "Tiêu đề" });
    pane.addBinding(config, "duration", {
      label: "Thời gian (giây)",
      min: 5,
      max: 600,
      step: 5,
    });
    pane.addBinding(config, "timerColor", { label: "Màu chữ" });

    pane.on("change", () => {
      onChange({ ...config });
    });
  },
};

function App() {
  const [sdk] = useState(() => new WidgetSDK(widgetDefinition));
  const [config, setConfig] = useState(sdk.getConfig());
  const [time, setTime] = useState(config.duration);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    sdk.onConfigChange((newConfig) => {
      setConfig(newConfig);
      setTime(newConfig.duration);
      setRunning(false);
    });
  }, [sdk]);

  useEffect(() => {
    if (!running || time <= 0) return;
    const id = setInterval(() => setTime((t: any) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [running, time]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-white">
      <h2 className="text-xl text-gray-500 mb-2 font-medium">{config.title}</h2>
      <div
        className="text-8xl font-black mb-10 tabular-nums"
        style={{ color: config.timerColor }}
      >
        {String(Math.floor(time / 60)).padStart(2, "0")}:
        {String(time % 60).padStart(2, "0")}
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => setRunning(!running)}
          className="px-8 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-colors"
        >
          {running ? "Tạm dừng" : "Bắt đầu"}
        </button>
        <button
          onClick={() => {
            setTime(config.duration);
            setRunning(false);
          }}
          className="p-3 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
        >
          Lại
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
