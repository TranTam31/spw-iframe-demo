import { WidgetMessage } from "./protocol";

export function sendToHost(msg: WidgetMessage) {
  window.parent.postMessage(msg, "*");
}

export function listenFromHost(handler: (msg: WidgetMessage) => void) {
  window.addEventListener("message", (e) => handler(e.data));
}
