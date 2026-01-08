// ============================================================
// PARAMETER BUILDERS - Fluent API như Unity Inspector
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
  constructor(defaultValue?: string) {
    super("string", defaultValue);
  }
}

class NumberParam extends BaseParam<number> {
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
  constructor(defaultValue?: boolean) {
    super("boolean", defaultValue);
  }
}

class ColorParam extends BaseParam<string> {
  constructor(defaultValue?: string) {
    super("color", defaultValue);
  }
}

class SelectParam<T> extends BaseParam<T> {
  constructor(options: T[], defaultValue?: T) {
    super("select", defaultValue);
    (this.config as any).options = options;
  }
}

class FolderParam {
  private title: string;
  private fields: Record<string, any>;
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
// WIDGET DEFINITION
// ============================================================

export interface WidgetDefinition {
  name: string;
  version?: string;
  description?: string;
  parameters: Record<string, any>;
}

export function defineWidget(definition: WidgetDefinition) {
  // Serialize parameters to schema
  const schema: Record<string, any> = {};
  const defaults: Record<string, any> = {};

  const processParams = (params: Record<string, any>, prefix = "") => {
    Object.keys(params).forEach((key) => {
      const param = params[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (param.toSchema) {
        const paramSchema = param.toSchema();
        schema[fullKey] = paramSchema;

        if (paramSchema.type === "folder") {
          // Flatten folder fields
          const folderFields = paramSchema.fields;
          Object.keys(folderFields).forEach((fieldKey) => {
            const fieldSchema = folderFields[fieldKey];
            schema[`${fullKey}.${fieldKey}`] = fieldSchema;
            if (fieldSchema.default !== undefined) {
              defaults[`${fullKey}.${fieldKey}`] = fieldSchema.default;
            }
          });
        } else if (paramSchema.default !== undefined) {
          defaults[fullKey] = paramSchema.default;
        }
      }
    });
  };

  processParams(definition.parameters);

  return {
    name: definition.name,
    version: definition.version || "1.0.0",
    description: definition.description,
    schema,
    defaults,
  };
}

// ============================================================
// RUNTIME - Widget communication with host
// ============================================================

export class WidgetRuntime {
  private static params: any = {};
  private static listeners: Set<(params: any) => void> = new Set();

  static init() {
    // Listen for messages from host
    window.addEventListener("message", (event) => {
      if (event.data.type === "PARAMS_UPDATE") {
        this.params = event.data.payload;
        this.notifyListeners();
      }
    });

    // Notify host that widget is ready
    window.addEventListener("DOMContentLoaded", () => {
      this.sendToHost({ type: "WIDGET_READY" });
    });
  }

  static sendToHost(message: any) {
    if (window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  static onParamsChange(callback: (params: any) => void) {
    this.listeners.add(callback);
    // Immediately call with current params if available
    if (Object.keys(this.params).length > 0) {
      callback(this.params);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => listener(this.params));
  }

  static getParams() {
    return this.params;
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
