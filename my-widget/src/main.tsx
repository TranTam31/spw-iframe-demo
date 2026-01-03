import React from "react";
import ReactDOM from "react-dom/client";
import { useState, useEffect } from "react";
import { CountdownWidget } from "./CountdownWidget";
import { initWidget } from "./widget-runtime";

function App() {
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    initWidget(setConfig);
  }, []);

  if (!config) return null;

  return <CountdownWidget config={config} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
