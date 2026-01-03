export function sendConfigToWidget(iframe: HTMLIFrameElement, config: any) {
  iframe.contentWindow?.postMessage(
    {
      type: "UPDATE_CONFIG",
      payload: config,
    },
    "*"
  );
}
