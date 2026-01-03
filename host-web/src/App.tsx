import React, { useState } from "react";
import WidgetWithTweakpane from "./WidgetWithTweakpane";

export default function App() {
  const [widgetType, setWidgetType] = useState<string | null>(null);

  if (widgetType) {
    return (
      <WidgetWithTweakpane
        widgetType={widgetType}
        onExit={() => setWidgetType(null)}
      />
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Widget Studio (Host)</h1>

      <button onClick={() => setWidgetType("countdown")}>
        Countdown Widget
      </button>
    </div>
  );
}
