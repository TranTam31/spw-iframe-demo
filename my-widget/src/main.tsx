import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
// import { WidgetSDK, WidgetDefinition } from "widget-sdk";
import "./index.css";

import {
  defineWidget,
  param,
  folder,
  useWidgetParams,
  WidgetRuntime,
  ExtractParams,
} from "widget-sdk";

// ============================================================
// WIDGET DEFINITION - Define 1 lần duy nhất
// ============================================================

const widgetDefinition = defineWidget({
  name: "Đồng hồ đếm ngược",
  version: "1.0.0",
  description: "Widget đếm ngược thời gian với khả năng tùy chỉnh đầy đủ",

  parameters: {
    // Top-level parameters
    title: param
      .string("Tập trung nào!")
      .label("Tiêu đề")
      .description("Tiêu đề hiển thị phía trên đồng hồ"),

    duration: param
      .number(60)
      .label("Thời gian (giây)")
      .min(5)
      .max(600)
      .step(5),

    autoStart: param
      .boolean(false)
      .label("Tự động bắt đầu")
      .description("Bắt đầu đếm ngay khi load"),

    showMilliseconds: param.boolean(false).label("Hiện mili giây"),

    // Appearance folder - nested
    appearance: folder("Giao diện", {
      // Folder cấp 2: colors
      colors: folder("Màu sắc", {
        timerColor: param.color("#1f2937").label("Màu chữ đồng hồ"),

        backgroundColor: param.color("#ffffff").label("Màu nền"),

        buttonColor: param.color("#000000").label("Màu nút"),
      }),

      // Folder cấp 2: layout
      layout: folder("Bố cục", {
        fontSize: param.number(80).min(24).max(200).label("Cỡ chữ"),

        padding: param.number(16).min(0).max(64).label("Padding"),
      }),
    }).expanded(true),

    // Advanced folder - nested
    advanced: folder("Nâng cao", {
      enableSound: param.boolean(false).label("Bật âm thanh"),

      completionMessage: param
        .string("⏰ Hết giờ!")
        .label("Thông báo hoàn thành"),
    }).expanded(false),
  },
} as const); // ← 'as const' để preserve literal types

// Send definition to host
setTimeout(() => {
  WidgetRuntime.sendToHost({
    type: "WIDGET_READY",
    payload: {
      name: widgetDefinition.name,
      version: widgetDefinition.version,
      description: widgetDefinition.description,
      schema: widgetDefinition.flatSchema,
      defaults: widgetDefinition.flatDefaults,
    },
  });
}, 100);

// ============================================================
// TYPE INFERENCE - Compile-time type extraction!
// ============================================================

// ⭐ Extract type từ parameter definition (compile-time)
type WidgetParams = ExtractParams<typeof widgetDefinition>;

// TypeScript sẽ infer:
// {
//   title: string;
//   duration: number;
//   autoStart: boolean;
//   showMilliseconds: boolean;
//   appearance: {
//     timerColor: string;
//     backgroundColor: string;
//     buttonColor: string;
//   };
//   advanced: {
//     enableSound: boolean;
//     completionMessage: string;
//   };
// }

// ============================================================
// WIDGET COMPONENT
// ============================================================

function App() {
  // ⭐ Params có full autocomplete!
  const params = useWidgetParams<WidgetParams>();

  const [time, setTime] = useState(60);
  const [running, setRunning] = useState(false);

  // Initialize with params
  useEffect(() => {
    if (!params) return;
    setTime(params.duration); // ← Autocomplete works!
    setRunning(params.autoStart); // ← Autocomplete works!
  }, [params?.duration, params?.autoStart]);

  // Countdown logic
  useEffect(() => {
    if (!running || time <= 0) return;

    const interval = params?.showMilliseconds ? 10 : 1000; // ← Autocomplete!
    const decrement = params?.showMilliseconds ? 0.01 : 1;

    const id = setInterval(() => {
      setTime((t) => {
        const newTime = Math.max(0, t - decrement);
        if (newTime === 0) {
          setRunning(false);

          // Emit event
          WidgetRuntime.emitEvent("onComplete", {
            duration: params?.duration,
          });

          // Play sound if enabled
          if (params?.advanced.enableSound) {
            // ← Autocomplete: params.advanced.
            const audioContext = new (window.AudioContext ||
              (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            oscillator.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
          }
        }
        return newTime;
      });
    }, interval);

    return () => clearInterval(id);
  }, [running, time, params]);

  // Format time display
  const formatTime = () => {
    if (!params) return "00:00";

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);

    const timeStr = `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;

    if (params.showMilliseconds) {
      // ← Autocomplete!
      return `${timeStr}.${String(milliseconds).padStart(2, "0")}`;
    }

    return timeStr;
  };

  if (!params) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Đang tải cấu hình...</div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-8 text-center"
      style={{ backgroundColor: params.appearance.colors.backgroundColor }}
    >
      <h2 className="text-xl text-gray-500 mb-2 font-medium">
        {params.title} {/* ← Autocomplete! */}
      </h2>

      <div
        className="text-8xl font-black mb-10 tabular-nums"
        style={{ color: params.appearance.colors.timerColor }}
      >
        {formatTime()}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setRunning(!running)}
          disabled={time === 0}
          className="px-8 py-3 text-white rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor:
              time === 0 ? "#9ca3af" : params.appearance.colors.buttonColor, // ← Autocomplete!
          }}
        >
          {running ? "Tạm dừng" : "Bắt đầu"}
        </button>

        <button
          onClick={() => {
            setTime(params.duration);
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
          {params.advanced.completionMessage}
        </div>
      )}
    </div>
  );
}

export default App;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
