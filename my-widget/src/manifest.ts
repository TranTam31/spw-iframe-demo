import type { WidgetDefinition } from "widget-sdk";

export const countdownWidget: WidgetDefinition<{
  title: string;
  duration: number;
  timerColor: string;
}> = {
  name: "Đồng hồ",

  defaultData: {
    title: "Tập trung nào!",
    duration: 60,
    timerColor: "#1f2937",
  },

  controls: [
    { type: "text", key: "title", label: "Tiêu đề" },
    { type: "number", key: "duration", min: 5, max: 600, step: 5 },
    { type: "color", key: "timerColor" },
  ],
};
