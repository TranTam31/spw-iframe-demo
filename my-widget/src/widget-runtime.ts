import { sendToHost, listenFromHost } from "widget-sdk";
import { countdownWidget } from "./manifest";

export function initWidget(setConfig: (c: any) => void) {
  // 1️⃣ Đăng ký widget với host
  sendToHost({
    type: "WIDGET_REGISTER",
    widgetType: "countdown",
    definition: countdownWidget,
  });

  // 2️⃣ Báo widget đã sẵn sàng render
  sendToHost({ type: "READY" });

  // 3️⃣ Lắng nghe config từ host
  listenFromHost((msg) => {
    if (msg.type === "SET_CONFIG") {
      setConfig(msg.payload);
    }
  });
}
