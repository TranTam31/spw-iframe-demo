import React, { useEffect, useRef, useState } from "react";
import { Pane } from "tweakpane";
import { getWidgetDefinition } from "./widgetRegistry";
import { sendConfigToWidget } from "./widgetSdkBridge";

interface Props {
  widgetType: string;
  onExit: () => void;
}

export default function WidgetWithTweakpane({ widgetType, onExit }: Props) {
  const widget = getWidgetDefinition(widgetType);

  if (!widget) {
    return <div>Widget không tồn tại</div>;
  }

  const [config, setConfig] = useState(widget.defaultData);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  /** Init tweakpane */
  useEffect(() => {
    if (!paneRef.current) return;

    const pane = new Pane({
      container: paneRef.current,
      title: `Cài đặt ${widget.name}`,
    });

    const proxy = { ...widget.defaultData };

    widget.controls.forEach((ctrl) => {
      switch (ctrl.type) {
        case "text":
          pane.addBinding(config, ctrl.key, { label: ctrl.label });
          break;

        case "number":
          pane.addBinding(config, ctrl.key, {
            min: ctrl.min,
            max: ctrl.max,
            step: ctrl.step,
          });
          break;

        case "color":
          pane.addBinding(config, ctrl.key);
          break;
      }
    });

    pane.on("change", () => {
      sendConfigToIframe({ ...config });
    });

    return () => pane.dispose();
  }, [widgetType]);

  /** Send config → iframe */
  useEffect(() => {
    if (!iframeRef.current) return;
    sendConfigToWidget(iframeRef.current, config);
  }, [config]);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* LEFT */}
      <div style={{ flex: 1 }}>
        <button onClick={onExit}>← Quay lại</button>

        <iframe
          ref={iframeRef}
          src={`http://localhost:5174/widget.html?type=${widgetType}`}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </div>

      {/* RIGHT */}
      <div
        ref={paneRef}
        style={{
          width: 320,
          borderLeft: "1px solid #eee",
          padding: 8,
        }}
      />
    </div>
  );
}
