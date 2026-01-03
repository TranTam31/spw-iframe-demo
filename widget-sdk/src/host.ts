import { WidgetMessage } from "./protocol";

export function sendToWidget(iframe: HTMLIFrameElement, msg: WidgetMessage) {
  iframe.contentWindow?.postMessage(msg, "*");
}

export function listenFromWidget(handler: (msg: WidgetMessage) => void) {
  window.addEventListener("message", (e) => handler(e.data));
}
