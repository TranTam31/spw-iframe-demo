import { useEffect, useState } from "react";

export function CountdownWidget({ config }: { config: any }) {
  const [time, setTime] = useState(config.duration);

  useEffect(() => {
    setTime(config.duration);
  }, [config.duration]);

  useEffect(() => {
    if (time <= 0) return;
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [time]);

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2>{config.title}</h2>
      <div style={{ fontSize: 64, color: config.timerColor }}>{time}s</div>
    </div>
  );
}
