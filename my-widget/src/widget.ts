import { sendToHost, listenFromHost } from "widget-sdk";

export function initWidget(setConfig: (c: any) => void) {
  sendToHost({ type: "READY" });

  listenFromHost((msg) => {
    if (msg.type === "SET_CONFIG") {
      setConfig(msg.payload);
    }
  });
}
