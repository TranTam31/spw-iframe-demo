import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import { WidgetSDK, WidgetDefinition } from "widget-sdk";
import "./index.css";

// ============================================================
// WIDGET DEFINITION - Định nghĩa schema cho countdown
// ============================================================

const widgetDefinition: WidgetDefinition = {
  name: "Đồng hồ đếm ngược",
  version: "1.0.0",
  description: "Widget đếm ngược thời gian với khả năng tùy chỉnh",

  // Default config - giá trị mặc định
  defaultConfig: {
    title: "Tập trung nào!",
    duration: 60,
    timerColor: "#1f2937",
    showMilliseconds: false,
    autoStart: false,
  },

  // Config schema - định nghĩa các trường config
  configSchema: [
    {
      type: "folder",
      title: "Nội dung",
      expanded: true,
      fields: [
        {
          type: "string",
          key: "title",
          label: "Tiêu đề",
          default: "Tập trung nào!",
        },
      ],
    },
    {
      type: "folder",
      title: "Thời gian",
      expanded: true,
      fields: [
        {
          type: "number",
          key: "duration",
          label: "Thời gian (giây)",
          default: 60,
          min: 5,
          max: 600,
          step: 5,
        },
        {
          type: "boolean",
          key: "autoStart",
          label: "Tự động bắt đầu",
          default: false,
        },
        {
          type: "boolean",
          key: "showMilliseconds",
          label: "Hiện mili giây",
          default: false,
        },
      ],
    },
    {
      type: "folder",
      title: "Giao diện",
      expanded: true,
      fields: [
        {
          type: "color",
          key: "timerColor",
          label: "Màu chữ",
          default: "#1f2937",
        },
      ],
    },
  ],
};

// ============================================================
// COUNTDOWN WIDGET COMPONENT
// ============================================================

function App() {
  // Initialize SDK
  const [sdk] = useState(() => new WidgetSDK(widgetDefinition));
  const [config, setConfig] = useState(sdk.getConfig());

  // Timer state
  const [time, setTime] = useState(config.duration as number);
  const [running, setRunning] = useState(config.autoStart as boolean);

  // Listen to config changes from host
  useEffect(() => {
    const cleanup = sdk.onConfigChange((newConfig) => {
      setConfig(newConfig);
      setTime(newConfig.duration as number);
      setRunning(newConfig.autoStart as boolean);
    });

    return cleanup;
  }, [sdk]);

  // Reset timer when duration changes
  useEffect(() => {
    setTime(config.duration as number);
    setRunning(config.autoStart as boolean);
  }, [config.duration, config.autoStart]);

  // Timer countdown logic
  useEffect(() => {
    if (!running || time <= 0) return;

    const interval = config.showMilliseconds ? 10 : 1000;
    const decrement = config.showMilliseconds ? 0.01 : 1;

    const id = setInterval(() => {
      setTime((t) => {
        const newTime = Math.max(0, t - decrement);
        if (newTime === 0) {
          setRunning(false);
        }
        return newTime;
      });
    }, interval);

    return () => clearInterval(id);
  }, [running, time, config.showMilliseconds]);

  // Format time display
  const formatTime = () => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);

    const timeStr = `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;

    if (config.showMilliseconds) {
      return `${timeStr}.${String(milliseconds).padStart(2, "0")}`;
    }

    return timeStr;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-white">
      <h2 className="text-xl text-gray-500 mb-2 font-medium">
        {config.title as string}
      </h2>

      <div
        className="text-8xl font-black mb-10 tabular-nums"
        style={{ color: config.timerColor as string }}
      >
        {formatTime()}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setRunning(!running)}
          disabled={time === 0}
          className="px-8 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? "Tạm dừng" : "Bắt đầu"}
        </button>

        <button
          onClick={() => {
            setTime(config.duration as number);
            setRunning(false);
          }}
          className="p-3 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 transition-colors"
          title="Reset"
        >
          Lại
        </button>
      </div>

      {time === 0 && (
        <div className="mt-8 text-2xl font-bold text-green-600 animate-pulse">
          ⏰ Hết giờ!
        </div>
      )}
    </div>
  );
}

export default App;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
