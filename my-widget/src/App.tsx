import { useEffect, useState } from "react";
import { initWidget } from "./widget";

export default function App() {
  const [config, setConfig] = useState({
    title: "Focus",
    duration: 60,
  });

  useEffect(() => {
    initWidget(setConfig);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>{config.title}</h2>
      <p>{config.duration}s</p>
    </div>
  );
}
