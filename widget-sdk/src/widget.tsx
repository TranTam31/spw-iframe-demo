import {
  useState,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useCallback,
} from "react";
import ReactDOM from "react-dom/client";
import {
  ExtractParams,
  WidgetRuntime,
  EvaluationResult,
  Submission,
} from "./core";

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

// ============================================================
// SUBMISSION HOOK - Main API
// ============================================================
export interface SubmissionConfig<TAnswer> {
  evaluate: (answer: TAnswer) => {
    isCorrect: boolean;
    score: number;
    maxScore: number;
  };
}

export interface SubmissionHookResult<TAnswer> {
  answer: TAnswer | undefined;
  setAnswer: (answer: TAnswer) => void;
  result: EvaluationResult | null;
  submit: () => Promise<void>;
  isLocked: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
}

export function useSubmission<TAnswer = any>(
  config: SubmissionConfig<TAnswer>,
): SubmissionHookResult<TAnswer> {
  // Get initial answer from runtime (if in review mode)
  const [initialAnswer, setInitialAnswer] = useState<TAnswer | undefined>(
    () => WidgetRuntime.getInitialAnswer<TAnswer>() || undefined,
  );

  // Listen for answer changes from host
  useEffect(() => {
    const unsubscribe = WidgetRuntime.onAnswerChange((answer) => {
      console.log("📥 Initial answer received:", answer);
      // Nếu answer = null/undefined → exit review mode
      if (answer === null || answer === undefined) {
        console.log("🔙 Exiting review mode - clearing answer");
        setInitialAnswer(undefined);
      } else {
        setInitialAnswer(answer);
      }
    });
    return unsubscribe;
  }, []);

  // Answer state - initialized with initialAnswer if exists
  const [answer, setAnswer] = useState<TAnswer | undefined>(initialAnswer);

  // Update answer when initialAnswer changes
  useEffect(() => {
    if (initialAnswer !== undefined) {
      setAnswer(initialAnswer);
    } else {
      // Clear answer when exiting review mode
      setAnswer(undefined);
    }
  }, [initialAnswer]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-compute result whenever answer changes
  const result = useMemo(() => {
    if (!answer) return null;

    try {
      const evaluation = config.evaluate(answer);
      return evaluation;
    } catch (error) {
      console.error("❌ Evaluation error:", error);
      return null;
    }
  }, [answer, config.evaluate]);

  // Submit function
  const submit = useCallback(async () => {
    if (!answer || !result || isLocked) {
      console.warn("⚠️ Cannot submit: missing answer, result, or locked");
      return;
    }

    setIsSubmitting(true);

    try {
      await WidgetRuntime.submit(answer, result);
      console.log("✅ Submission successful");
    } catch (error) {
      console.error("❌ Submission failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [answer, result]);

  // Locked if has initialAnswer (review mode)
  const isLocked = initialAnswer !== undefined;

  // Can submit if has answer and not locked
  const canSubmit = !!answer && !isLocked && !isSubmitting;

  return {
    answer,
    setAnswer,
    result,
    submit,
    isLocked,
    canSubmit,
    isSubmitting,
  };
}

// ============================================================
// LEGACY HOOK - for compatibility
// ============================================================
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
        console.log("📥 Params received:", newParams);
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
  const root = document.getElementById("root");
  if (root) {
    ReactDOM.createRoot(root).render(<WidgetWrapper />);
  } else {
    console.error("❌ Root element not found");
  }
}
