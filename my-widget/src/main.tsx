import ReactDOM from "react-dom/client";
import { useEffect, useState } from "react";
import "./index.css";

import {
  defineWidget,
  param,
  folder,
  when,
  useWidgetParams,
  WidgetRuntime,
  ExtractParams,
  useWidgetState,
} from "widget-sdk";

// ============================================================
// WIDGET DEFINITION
// ============================================================

const widgetDefinition = defineWidget({
  parameters: {
    // Mode selector - controls visibility of advanced features
    mode: param
      .select(["Simple", "Advanced"], "Simple")
      .label("Chế độ")
      .description("Simple: Cơ bản, Advanced: Nâng cao"),

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

    showMilliseconds: param
      .boolean(false)
      .label("Hiện mili giây")
      .visibleIf(when("mode").equals("Advanced")), // ← Only visible in Advanced mode

    // Appearance folder
    appearance: folder("Giao diện", {
      colors: folder("Màu sắc", {
        timerColor: param.color("#1f2937").label("Màu chữ đồng hồ"),
        backgroundColor: param.color("#ffffff").label("Màu nền"),
        buttonColor: param.color("#000000").label("Màu nút"),
      }),
      background: folder("Ảnh nền", {
        imageUrl: param
          .image("")
          .label("URL ảnh nền")
          .placeholder("https://example.com/image.jpg"),
        opacity: param
          .number(0.3)
          .min(0)
          .max(1)
          .step(0.1)
          .label("Độ mờ ảnh nền"),
      }),
      layout: folder("Bố cục", {
        fontSize: param.number(80).min(24).max(200).label("Cỡ chữ"),
        padding: param.number(16).min(0).max(64).label("Padding"),
      }),
    }).expanded(true),

    // Advanced folder - only visible when mode = "Advanced"
    advanced: folder("Nâng cao", {
      enableSound: param.boolean(false).label("Bật âm thanh"),
      completionMessage: param
        .string("⏰ Hết giờ!")
        .label("Thông báo hoàn thành"),
    })
      .expanded(false)
      .visibleIf(when("mode").equals("Advanced")), // ← Folder visibility
  },
} as const);

// Send definition to host
setTimeout(() => {
  WidgetRuntime.sendToHost({
    type: "WIDGET_READY",
    payload: {
      schema: widgetDefinition.schema,
    },
  });
}, 100);

// ============================================================
// TYPE INFERENCE
// ============================================================

type WidgetParams = ExtractParams<typeof widgetDefinition>;

// ============================================================
// WIDGET COMPONENT
// ============================================================

function App() {
  const params = useWidgetParams<WidgetParams>();

  const [time, setTime] = useWidgetState(params?.duration, 60);
  const [running, setRunning] = useWidgetState(params?.autoStart, false);

  // Countdown logic
  useEffect(() => {
    if (!running || time <= 0) return;

    const interval = params?.showMilliseconds ? 10 : 1000;
    const decrement = params?.showMilliseconds ? 0.01 : 1;

    const id = setInterval(() => {
      setTime((t) => {
        const newTime = Math.max(0, t - decrement);
        if (newTime === 0) {
          setRunning(false);

          WidgetRuntime.emitEvent("onComplete", {
            duration: params?.duration,
          });

          // Play sound if enabled (only in Advanced mode)
          if (params?.mode === "Advanced" && params?.advanced?.enableSound) {
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
      className="relative flex flex-col items-center justify-center min-h-screen p-8 text-center overflow-hidden"
      style={{
        backgroundColor: params.appearance.colors.backgroundColor,
        padding: `${params.appearance.layout.padding}px`,
      }}
    >
      {/* Background image layer */}
      {params.appearance.background.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${params.appearance.background.imageUrl})`,
            opacity: params.appearance.background.opacity,
            zIndex: 0,
          }}
        />
      )}

      {/* Content layer */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Mode badge */}
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-xs text-gray-600 shadow-sm">
          {params.mode}
        </div>

        <h2 className="text-xl text-gray-500 mb-2 font-medium drop-shadow-sm">
          {params.title}
        </h2>

        <div
          className="font-black mb-10 tabular-nums drop-shadow-lg"
          style={{
            color: params.appearance.colors.timerColor,
            fontSize: `${params.appearance.layout.fontSize}px`,
          }}
        >
          {formatTime()}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setRunning(!running)}
            disabled={time === 0}
            className="px-8 py-3 text-white rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            style={{
              backgroundColor:
                time === 0 ? "#9ca3af" : params.appearance.colors.buttonColor,
            }}
          >
            {running ? "Tạm dừng" : "Bắt đầu"}
          </button>

          <button
            onClick={() => {
              setTime(params.duration);
              setRunning(false);
            }}
            className="p-3 bg-white/90 backdrop-blur-sm text-gray-600 rounded-full hover:bg-white transition-colors shadow-lg hover:shadow-xl"
            title="Reset"
          >
            Đặt lại
          </button>
        </div>

        {/* Completion message */}
        {time === 0 && (
          <div className="mt-8 text-2xl font-bold text-green-600 animate-pulse drop-shadow-lg bg-white/80 backdrop-blur-sm px-6 py-3 rounded-2xl">
            {params.mode === "Advanced"
              ? params.advanced?.completionMessage
              : "⏰ Hết giờ!"}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
