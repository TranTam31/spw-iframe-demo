import { registerWidgetFromIframe } from "./widgetRegistry";

export function initWidgetMessageBridge() {
  window.addEventListener("message", (e) => {
    if (e.data?.type === "WIDGET_REGISTER") {
      const { widgetType, definition } = e.data;
      registerWidgetFromIframe(widgetType, definition);
      console.log("Widget registered:", widgetType);
    }
  });
}
