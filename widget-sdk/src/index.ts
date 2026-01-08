// ============================================================
// PARAMETER BUILDERS - Fluent API
// ============================================================

interface BaseParamConfig {
  type: string;
  label?: string;
  description?: string;
  default?: any;
  required?: boolean;
}

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

  toSchema() {
    return { ...this.config };
  }
}

class StringParam extends BaseParam<string> {
  readonly _type = "string" as const; // ← Add type marker
  constructor(defaultValue?: string) {
    super("string", defaultValue);
  }
}

class NumberParam extends BaseParam<number> {
  readonly _type = "number" as const; // ← Add type marker
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
  readonly _type = "boolean" as const; // ← Add type marker
  constructor(defaultValue?: boolean) {
    super("boolean", defaultValue);
  }
}

class ColorParam extends BaseParam<string> {
  readonly _type = "color" as const; // ← Add type marker
  constructor(defaultValue?: string) {
    super("color", defaultValue);
  }
}

class SelectParam<T> extends BaseParam<T> {
  readonly _type = "select" as const; // ← Add type marker
  readonly _options: T[]; // ← Store options for type inference

  constructor(options: T[], defaultValue?: T) {
    super("select", defaultValue);
    this._options = options;
    (this.config as any).options = options;
  }
}

class FolderParam {
  readonly _type = "folder" as const; // ← Add type marker
  private title: string;
  public readonly fields: Record<string, any>;
  private isExpanded: boolean;

  constructor(title: string, fields: Record<string, any>) {
    this.title = title;
    this.fields = fields;
    this.isExpanded = true;
  }

  expanded(value: boolean = true) {
    this.isExpanded = value;
    return this;
  }

  toSchema() {
    const fieldsSchema: Record<string, any> = {};

    Object.keys(this.fields).forEach((key) => {
      const field = this.fields[key];
      fieldsSchema[key] = field.toSchema ? field.toSchema() : field;
    });

    return {
      type: "folder",
      title: this.title,
      expanded: this.isExpanded,
      fields: fieldsSchema,
    };
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
  select: <T>(options: T[], defaultValue?: T) =>
    new SelectParam(options, defaultValue),
};

export function folder(title: string, fields: Record<string, any>) {
  return new FolderParam(title, fields);
}

// ============================================================
// HELPER: Flat to Nested conversion
// ============================================================

function flatToNested(flat: Record<string, any>): Record<string, any> {
  const nested: Record<string, any> = {};

  Object.keys(flat).forEach((key) => {
    const parts = key.split(".");
    let current = nested;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = flat[key];
  });

  return nested;
}

// ============================================================
// TYPE INFERENCE SYSTEM - Compile-time magic
// ============================================================

// Extract type from param builders using _type marker
type InferParamType<T> = T extends { _type: "string" }
  ? string
  : T extends { _type: "number" }
  ? number
  : T extends { _type: "boolean" }
  ? boolean
  : T extends { _type: "color" }
  ? string
  : T extends { _type: "select"; _options: readonly (infer U)[] }
  ? U
  : T extends { _type: "folder"; fields: infer F }
  ? InferFolderType<F>
  : never;

// Extract nested type from folder fields
type InferFolderType<F> = {
  [K in keyof F]: InferParamType<F[K]>;
};

// Main type extractor for parameters
type InferParametersType<T> = {
  [K in keyof T]: InferParamType<T[K]>;
};

// ============================================================
// WIDGET DEFINITION
// ============================================================

export interface WidgetDefinition<P = any> {
  name: string;
  version?: string;
  description?: string;
  parameters: P;
}

export function defineWidget<const P extends Record<string, any>>(
  definition: WidgetDefinition<P>
) {
  // Build flat schema for host (Tweakpane)
  const flatSchema: Record<string, any> = {};
  const flatDefaults: Record<string, any> = {};

  const processParams = (params: Record<string, any>, prefix = "") => {
    Object.keys(params).forEach((key) => {
      const param = params[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (param.toSchema) {
        const paramSchema = param.toSchema();

        if (paramSchema.type === "folder") {
          flatSchema[fullKey] = paramSchema;

          // Process folder fields
          const folderFields = paramSchema.fields;
          Object.keys(folderFields).forEach((fieldKey) => {
            const fieldSchema = folderFields[fieldKey];
            const nestedKey = `${fullKey}.${fieldKey}`;
            flatSchema[nestedKey] = fieldSchema;

            if (fieldSchema.default !== undefined) {
              flatDefaults[nestedKey] = fieldSchema.default;
            }
          });
        } else {
          flatSchema[fullKey] = paramSchema;
          if (paramSchema.default !== undefined) {
            flatDefaults[fullKey] = paramSchema.default;
          }
        }
      }
    });
  };

  processParams(definition.parameters);

  // Build nested defaults for widget (autocomplete)
  const nestedDefaults = flatToNested(flatDefaults);

  return {
    name: definition.name,
    version: definition.version || "1.0.0",
    description: definition.description,
    // For host: flat structure
    flatSchema,
    flatDefaults,
    // For widget: nested structure (runtime)
    nestedDefaults,
    // For TypeScript: parameter definition (compile-time)
    __parameters: definition.parameters,
  };
}

// ============================================================
// TYPE HELPER - Extract params type from definition
// ============================================================

export type ExtractParams<T> = T extends { __parameters: infer P }
  ? InferParametersType<P>
  : never;

// ============================================================
// RUNTIME - Widget communication with host
// ============================================================

export class WidgetRuntime {
  private static flatParams: Record<string, any> = {};
  private static listeners: Set<(params: any) => void> = new Set();

  static init() {
    // Listen for messages from host
    window.addEventListener("message", (event) => {
      if (event.data.type === "PARAMS_UPDATE") {
        this.flatParams = event.data.payload;
        // Convert flat to nested for widget
        const nestedParams = flatToNested(this.flatParams);
        this.notifyListeners(nestedParams);
      }
    });

    // Notify host when ready
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
    this.listeners.add(callback);
    // Immediately call with current params if available
    if (Object.keys(this.flatParams).length > 0) {
      const nestedParams = flatToNested(this.flatParams);
      callback(nestedParams);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notifyListeners(nestedParams: any) {
    this.listeners.forEach((listener) => listener(nestedParams));
  }

  static emitEvent(eventName: string, data?: any) {
    this.sendToHost({
      type: "EVENT",
      event: eventName,
      payload: data,
    });
  }
}

// Auto-init runtime
WidgetRuntime.init();

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from "react";

export function useWidgetParams<T = any>(): T | null {
  const [params, setParams] = useState<T | null>(null);

  useEffect(() => {
    const unsubscribe = WidgetRuntime.onParamsChange((newParams) => {
      setParams(newParams as T);
    });
    return unsubscribe;
  }, []);

  return params;
}
