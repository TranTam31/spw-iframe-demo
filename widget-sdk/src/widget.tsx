import { useState, useEffect, createContext, useContext } from "react";
import ReactDOM from "react-dom/client";
import { ExtractParams, WidgetRuntime } from "./core";

// ============================================================
// WIDGET PARAMS CONTEXT
// ============================================================

const WidgetParamsContext = createContext<any>(null);

export function useWidgetParams<T = any>(): T {
  const params = useContext(WidgetParamsContext);
  if (params === null) {
    throw new Error(
      "useWidgetParams must be used within a widget created by createWidget",
    );
  }
  return params as T;
}

export function useWidgetState<T>(paramValue: T | undefined, defaultValue: T) {
  const [state, setState] = useState<T>(defaultValue);

  useEffect(() => {
    if (paramValue !== undefined) {
      setState(paramValue);
    }
  }, [paramValue]);

  return [state, setState] as const;
}

// ============================================================
// CREATE WIDGET - Main API
// ============================================================

interface CreateWidgetConfig<T> {
  definition: T;
  component: React.ComponentType;
}

export function createWidget<T extends { schema: any; __parameters: any }>(
  config: CreateWidgetConfig<T>,
) {
  type WidgetParams = ExtractParams<T>;

  console.log("📦 Widget definition:", config.definition);

  // Send schema to host
  setTimeout(() => {
    WidgetRuntime.sendToHost({
      type: "WIDGET_READY",
      payload: {
        schema: config.definition.schema,
      },
    });
  }, 100);

  // Wrapper component that provides params via context
  function WidgetWrapper() {
    const [params, setParams] = useState<WidgetParams | null>(null);

    useEffect(() => {
      const unsubscribe = WidgetRuntime.onParamsChange((newParams) => {
        setParams(newParams as WidgetParams);
      });
      return unsubscribe;
    }, []);

    if (!params) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-400">Đang tải cấu hình...</div>
        </div>
      );
    }

    return (
      <WidgetParamsContext.Provider value={params}>
        <config.component />
      </WidgetParamsContext.Provider>
    );
  }

  // Render the widget
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <WidgetWrapper />,
  );
}
