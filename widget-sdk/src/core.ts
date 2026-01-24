// ============================================================
// TYPES
// ============================================================
interface BaseParamConfig {
  type: string;
  label?: string;
  description?: string;
  default?: any;
  required?: boolean;
  visibleIf?: VisibilityCondition;
}

interface VisibilityCondition {
  param: string;
  equals?: any;
  notEquals?: any;
  in?: any[];
}

// NEW: Evaluation result structure
export interface EvaluationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  details?: any;
}

// NEW: Submission structure
export interface Submission {
  answer: any;
  evaluation: EvaluationResult;
  metadata: {
    timeSpent?: number;
    attemptCount?: number;
    timestamp: number;
  };
}

// ============================================================
// PARAM CLASSES
// ============================================================
class BaseParam<T> {
  protected config: BaseParamConfig;

  constructor(type: string, defaultValue?: T) {
    this.config = {
      type,
      default: defaultValue,
    };
  }

  label(text: string) {
    this.config.label = text;
    return this;
  }

  description(text: string) {
    this.config.description = text;
    return this;
  }

  required() {
    this.config.required = true;
    return this;
  }

  visibleIf(condition: VisibilityCondition) {
    this.config.visibleIf = condition;
    return this;
  }

  toSchema() {
    return { ...this.config };
  }
}

class StringParam extends BaseParam<string> {
  readonly _type = "string" as const;
  constructor(defaultValue?: string) {
    super("string", defaultValue);
  }
}

class NumberParam extends BaseParam<number> {
  readonly _type = "number" as const;
  constructor(defaultValue?: number) {
    super("number", defaultValue);
  }

  min(value: number) {
    (this.config as any).min = value;
    return this;
  }

  max(value: number) {
    (this.config as any).max = value;
    return this;
  }

  step(value: number) {
    (this.config as any).step = value;
    return this;
  }
}

class BooleanParam extends BaseParam<boolean> {
  readonly _type = "boolean" as const;
  constructor(defaultValue?: boolean) {
    super("boolean", defaultValue);
  }
}

class ColorParam extends BaseParam<string> {
  readonly _type = "color" as const;
  constructor(defaultValue?: string) {
    super("color", defaultValue);
  }
}

class ImageParam extends BaseParam<string> {
  readonly _type = "image" as const;
  constructor(defaultValue?: string) {
    super("image", defaultValue);
  }

  placeholder(text: string) {
    (this.config as any).placeholder = text;
    return this;
  }
}

class SelectParam<T> extends BaseParam<T> {
  readonly _type = "select" as const;
  readonly _options: T[];

  constructor(options: T[], defaultValue?: T) {
    super("select", defaultValue);
    this._options = options;
    (this.config as any).options = options;
  }
}

class FolderParam<F extends Record<string, any>> {
  readonly _type = "folder" as const;
  private title: string;
  public readonly fields: F;
  private isExpanded: boolean;
  private visibility?: VisibilityCondition;

  constructor(title: string, fields: F) {
    this.title = title;
    this.fields = fields;
    this.isExpanded = true;
  }

  expanded(value: boolean = true) {
    this.isExpanded = value;
    return this;
  }

  visibleIf(condition: VisibilityCondition) {
    this.visibility = condition;
    return this;
  }

  toSchema() {
    const fieldsSchema: Record<string, any> = {};
    Object.keys(this.fields).forEach((key) => {
      const field = this.fields[key];
      fieldsSchema[key] = field.toSchema ? field.toSchema() : field;
    });

    const schema: any = {
      type: "folder",
      title: this.title,
      expanded: this.isExpanded,
      fields: fieldsSchema,
    };

    if (this.visibility) {
      schema.visibleIf = this.visibility;
    }

    return schema;
  }
}

// ============================================================
// PUBLIC API
// ============================================================
export const param = {
  string: (defaultValue?: string) => new StringParam(defaultValue),
  number: (defaultValue?: number) => new NumberParam(defaultValue),
  boolean: (defaultValue?: boolean) => new BooleanParam(defaultValue),
  color: (defaultValue?: string) => new ColorParam(defaultValue),
  image: (defaultValue?: string) => new ImageParam(defaultValue),
  select: <T>(options: T[], defaultValue?: T) =>
    new SelectParam(options, defaultValue),
};

export function folder<const F extends Record<string, any>>(
  title: string,
  fields: F,
) {
  return new FolderParam<F>(title, fields);
}

export function when<T>(param: string) {
  return {
    equals: (value: T) => ({ param, equals: value }),
    notEquals: (value: T) => ({ param, notEquals: value }),
    in: (values: T[]) => ({ param, in: values }),
  };
}

// ============================================================
// TYPE INFERENCE
// ============================================================
type InferParamType<T> = T extends { _type: "string" }
  ? string
  : T extends { _type: "number" }
    ? number
    : T extends { _type: "boolean" }
      ? boolean
      : T extends { _type: "color" }
        ? string
        : T extends { _type: "image" }
          ? string
          : T extends { _type: "select"; _options: readonly (infer U)[] }
            ? U
            : T extends { _type: "folder"; fields: infer F }
              ? InferFolderType<F>
              : never;

type InferFolderType<F> = {
  [K in keyof F]: InferParamType<F[K]>;
};

type InferParametersType<T> = {
  [K in keyof T]: InferParamType<T[K]>;
};

// ============================================================
// WIDGET DEFINITION WITH EVALUATION
// ============================================================
export interface WidgetEvaluator<TAnswer = any> {
  // Evaluate student's answer and return result
  evaluate: (answer: TAnswer) => EvaluationResult | Promise<EvaluationResult>;

  // Optional: Validate answer before submission
  validateAnswer?: (answer: TAnswer) => boolean | string;
}

export function defineWidget<const P extends Record<string, any>>(
  parameters: P,
  evaluator?: WidgetEvaluator,
) {
  const buildSchema = (params: Record<string, any>): Record<string, any> => {
    const schema: Record<string, any> = {};
    Object.keys(params).forEach((key) => {
      const param = params[key];
      if (param.toSchema) {
        schema[key] = param.toSchema();
      }
    });
    return schema;
  };

  const schema = buildSchema(parameters);

  return {
    schema,
    evaluator,
    __parameters: parameters,
  };
}

export type ExtractParams<T> = T extends { __parameters: infer P }
  ? InferParametersType<P>
  : never;

// ============================================================
// WIDGET RUNTIME - Communication with Host
// ============================================================
export class WidgetRuntime {
  private static params: Record<string, any> = {};
  private static listeners: Set<(params: any) => void> = new Set();
  private static modeListeners: Set<
    (mode: "practice" | "review", data: Submission | null) => void
  > = new Set();
  private static mode: "practice" | "review" = "practice";
  private static reviewData: Submission | null = null;
  private static startTime: number = Date.now();

  static init() {
    window.addEventListener("message", (event) => {
      if (event.data.type === "PARAMS_UPDATE") {
        this.params = event.data.payload;
        this.notifyListeners(this.params);
      }

      // NEW: Handle review mode
      if (event.data.type === "REVIEW_MODE") {
        console.log(
          "🔍 WidgetRuntime: Switching to REVIEW mode",
          event.data.payload,
        );
        this.mode = "review";
        this.reviewData = event.data.payload.submission;
        this.params = event.data.payload.config;

        // Notify both params and mode listeners
        this.notifyListeners(this.params);
        this.notifyModeListeners();
      }
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.sendToHost({ type: "WIDGET_READY" });
      });
    } else {
      setTimeout(() => {
        this.sendToHost({ type: "WIDGET_READY" });
      }, 0);
    }

    // Reset start time
    this.startTime = Date.now();
  }

  static sendToHost(message: any) {
    if (window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  static onParamsChange(callback: (params: any) => void) {
    this.listeners.add(callback);
    if (Object.keys(this.params).length > 0) {
      callback(this.params);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notifyListeners(params: any) {
    this.listeners.forEach((listener) => listener(params));
  }

  private static notifyModeListeners() {
    this.modeListeners.forEach((listener) =>
      listener(this.mode, this.reviewData),
    );
  }

  static emitEvent(eventName: string, data?: any) {
    this.sendToHost({
      type: "EVENT",
      event: eventName,
      payload: data,
    });
  }

  // NEW: Submit answer with evaluation
  static async submit(answer: any, evaluation: EvaluationResult) {
    const timeSpent = Date.now() - this.startTime;

    const submission: Submission = {
      answer,
      evaluation,
      metadata: {
        timeSpent,
        timestamp: Date.now(),
      },
    };

    console.log("📤 Submitting to host:", submission);

    this.sendToHost({
      type: "SUBMIT",
      payload: submission,
    });

    return submission;
  }

  // NEW: Get current mode
  static getMode(): "practice" | "review" {
    return this.mode;
  }

  // NEW: Get review data (only available in review mode)
  static getReviewData(): Submission | null {
    return this.reviewData;
  }

  // NEW: Check if in review mode
  static isReviewMode(): boolean {
    return this.mode === "review";
  }

  // NEW: Subscribe to mode changes
  static onModeChange(
    callback: (mode: "practice" | "review", data: Submission | null) => void,
  ) {
    this.modeListeners.add(callback);
    // Immediately call with current state
    callback(this.mode, this.reviewData);
    return () => {
      this.modeListeners.delete(callback);
    };
  }
}

WidgetRuntime.init();
