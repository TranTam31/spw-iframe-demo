import { WidgetFrame } from "./WidgetFrame";

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Host Web</h1>
      <WidgetFrame src="http://localhost:5174/index.html" />
    </div>
  );
}
