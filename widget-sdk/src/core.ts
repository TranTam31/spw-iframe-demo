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

// Evaluation result structure (required fields)
export interface EvaluationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  details?: any;
}

// Submission structure sent to host
export interface Submission<TAnswer = any> {
  answer: TAnswer;
  evaluation: EvaluationResult;
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
// WIDGET DEFINITION
// ============================================================
export function defineWidget<
  const P extends Record<string, any>,
  const A extends Record<string, any>,
>(config: { parameters: P; answer: A }) {
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

  const schema = buildSchema(config.parameters);

  return {
    schema,
    __parameters: config.parameters,
    __answer: config.answer,
  };
}

export type ExtractParams<T> = T extends { __parameters: infer P }
  ? InferParametersType<P>
  : never;

export type ExtractAnswer<T> = T extends { __answer: infer A }
  ? InferParametersType<A>
  : never;

// ============================================================
// WIDGET RUNTIME - Communication with Host
// ============================================================
export class WidgetRuntime {
  private static params: Record<string, any> = {};
  private static paramsListeners: Set<(params: any) => void> = new Set();

  private static initialAnswer: any = null;
  private static answerListeners: Set<(answer: any) => void> = new Set();

  static init() {
    window.addEventListener("message", (event) => {
      if (event.data.type === "PARAMS_UPDATE") {
        const payload = event.data.payload;

        // Check if payload contains __answer
        if (payload.__answer !== undefined) {
          this.initialAnswer = payload.__answer;
          this.notifyAnswerListeners();

          // Remove __answer from params
          const { __answer, ...params } = payload;
          this.params = params;
        } else {
          this.params = payload;
        }

        this.notifyParamsListeners();
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
  }

  static sendToHost(message: any) {
    if (window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  static onParamsChange(callback: (params: any) => void) {
    this.paramsListeners.add(callback);
    if (Object.keys(this.params).length > 0) {
      callback(this.params);
    }
    return () => {
      this.paramsListeners.delete(callback);
    };
  }

  static onAnswerChange(callback: (answer: any) => void) {
    this.answerListeners.add(callback);
    if (this.initialAnswer !== null) {
      callback(this.initialAnswer);
    }
    return () => {
      this.answerListeners.delete(callback);
    };
  }

  private static notifyParamsListeners() {
    this.paramsListeners.forEach((listener) => listener(this.params));
  }

  private static notifyAnswerListeners() {
    this.answerListeners.forEach((listener) => listener(this.initialAnswer));
  }

  static emitEvent(eventName: string, data?: any) {
    this.sendToHost({
      type: "EVENT",
      event: eventName,
      payload: data,
    });
  }

  // Submit answer with evaluation
  static async submit<TAnswer = any>(
    answer: TAnswer,
    evaluation: EvaluationResult,
  ): Promise<Submission<TAnswer>> {
    const submission: Submission<TAnswer> = {
      answer,
      evaluation,
    };

    console.log("📤 Submitting to host:", submission);

    this.sendToHost({
      type: "SUBMIT",
      payload: submission,
    });

    return submission;
  }

  // Get initial answer (if in review mode)
  static getInitialAnswer<TAnswer = any>(): TAnswer | null {
    return this.initialAnswer;
  }
}

WidgetRuntime.init();
