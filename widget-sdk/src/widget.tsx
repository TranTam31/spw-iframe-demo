import { useState, useEffect, createContext, useContext } from "react";
import ReactDOM from "react-dom/client";
import {
  ExtractParams,
  WidgetRuntime,
  EvaluationResult,
  Submission,
  WidgetEvaluator,
} from "./core";

// ============================================================
// WIDGET PARAMS CONTEXT
// ============================================================
const WidgetParamsContext = createContext<any>(null);
const WidgetEvaluatorContext = createContext<WidgetEvaluator | null>(null);

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

// NEW: Hook for submission
export function useSubmission<TAnswer = any>() {
  const evaluator = useContext(WidgetEvaluatorContext);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const submit = async (answer: TAnswer): Promise<Submission | null> => {
    if (!evaluator) {
      console.error("❌ No evaluator provided in widget definition");
      return null;
    }

    setIsSubmitting(true);

    try {
      // Evaluate the answer
      const evaluation = await evaluator.evaluate(answer);

      // Submit to host
      const result = await WidgetRuntime.submit(answer, evaluation);
      setSubmission(result);

      return result;
    } catch (error) {
      console.error("❌ Submission failed:", error);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submit,
    isSubmitting,
    submission,
  };
}

// NEW: Hook for review mode
export function useReviewMode() {
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState<Submission | null>(null);

  useEffect(() => {
    // Subscribe to mode changes
    const unsubscribe = WidgetRuntime.onModeChange((mode, data) => {
      console.log("🔄 useReviewMode: Mode changed to", mode, data);
      setIsReviewMode(mode === "review");
      setReviewData(data);
    });

    return unsubscribe;
  }, []);

  return {
    isReviewMode,
    reviewData,
  };
}

// ============================================================
// CREATE WIDGET - Main API
// ============================================================
interface CreateWidgetConfig<T> {
  definition: T;
  component: React.ComponentType;
}

export function createWidget<
  T extends { schema: any; __parameters: any; evaluator?: WidgetEvaluator },
>(config: CreateWidgetConfig<T>) {
  type WidgetParams = ExtractParams<T>;

  console.log("📦 Widget definition:", config.definition);

  // Send schema to host
  setTimeout(() => {
    WidgetRuntime.sendToHost({
      type: "WIDGET_READY",
      payload: {
        schema: config.definition.schema,
        hasEvaluator: !!config.definition.evaluator,
      },
    });
  }, 100);

  // Wrapper component that provides params and evaluator via context
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
        <WidgetEvaluatorContext.Provider
          value={config.definition.evaluator || null}
        >
          <config.component />
        </WidgetEvaluatorContext.Provider>
      </WidgetParamsContext.Provider>
    );
  }

  // Render the widget
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <WidgetWrapper />,
  );
}
