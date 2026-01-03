import { useEffect, useRef } from "react";
import { listenFromWidget } from "widget-sdk";

export function WidgetFrame({ src }: { src: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    listenFromWidget((msg) => {
      console.log("From widget:", msg);
    });
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      style={{ width: "100%", height: 400, border: "1px solid #ddd" }}
    />
  );
}
