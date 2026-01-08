// ============================================================
// SCHEMA TYPES - Định nghĩa tất cả types Tweakpane support
// ============================================================

export type ConfigValue =
  | string
  | number
  | boolean
  | { x: number; y: number }
  | { r: number; g: number; b: number; a?: number };

export type WidgetConfig = Record<string, ConfigValue>;

// Base field schema
interface BaseFieldSchema {
  key: string;
  label?: string;
}

// String input
export interface StringFieldSchema extends BaseFieldSchema {
  type: "string";
  default?: string;
}

// Number input with constraints
export interface NumberFieldSchema extends BaseFieldSchema {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

// Boolean toggle
export interface BooleanFieldSchema extends BaseFieldSchema {
  type: "boolean";
  default?: boolean;
}

// Color picker
export interface ColorFieldSchema extends BaseFieldSchema {
  type: "color";
  default?: string; // hex color "#rrggbb"
}

// Select/dropdown
export interface SelectFieldSchema extends BaseFieldSchema {
  type: "select";
  default?: string | number;
  options: Array<{ text: string; value: string | number }>;
}

// 2D Point
export interface PointFieldSchema extends BaseFieldSchema {
  type: "point";
  default?: { x: number; y: number };
  min?: number;
  max?: number;
}

// Folder grouping
export interface FolderSchema {
  type: "folder";
  title: string;
  expanded?: boolean;
  fields: ConfigFieldSchema[];
}

// Union type for all field types
export type ConfigFieldSchema =
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | ColorFieldSchema
  | SelectFieldSchema
  | PointFieldSchema
  | FolderSchema;

// ============================================================
// WIDGET DEFINITION
// ============================================================

export interface WidgetDefinition {
  name: string;
  version?: string;
  description?: string;
  defaultConfig: WidgetConfig;
  configSchema: ConfigFieldSchema[];
}

// ============================================================
// MESSAGE TYPES
// ============================================================

export interface WidgetMessage {
  type: "WIDGET_READY" | "CONFIG_UPDATE" | "WIDGET_ERROR";
  payload?: any;
}

// ============================================================
// WIDGET SDK CLASS
// ============================================================

export class WidgetSDK {
  private config: WidgetConfig;
  private definition: WidgetDefinition;
  private isReady: boolean = false;

  constructor(definition: WidgetDefinition) {
    this.definition = definition;
    this.config = { ...definition.defaultConfig };
    this.validateDefinition();
    this.init();
  }

  /**
   * Validate widget definition
   */
  private validateDefinition(): void {
    const { name, defaultConfig, configSchema } = this.definition;

    if (!name || typeof name !== "string") {
      throw new Error("Widget name is required and must be a string");
    }

    if (!defaultConfig || typeof defaultConfig !== "object") {
      throw new Error("defaultConfig is required and must be an object");
    }

    if (!Array.isArray(configSchema)) {
      throw new Error("configSchema must be an array");
    }

    // Validate all schema keys exist in defaultConfig
    const flattenFields = (fields: ConfigFieldSchema[]): string[] => {
      return fields.flatMap((field) => {
        if (field.type === "folder") {
          return flattenFields(field.fields);
        }
        return [field.key];
      });
    };

    const schemaKeys = flattenFields(configSchema);
    const configKeys = Object.keys(defaultConfig);

    schemaKeys.forEach((key) => {
      if (!configKeys.includes(key)) {
        console.warn(`Schema key "${key}" not found in defaultConfig`);
      }
    });
  }

  /**
   * Initialize SDK - setup message listeners and notify host
   */
  private init(): void {
    // Listen for messages from host
    window.addEventListener("message", this.handleMessage.bind(this));

    // Wait for DOM ready before notifying host
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.notifyHostReady();
      });
    } else {
      this.notifyHostReady();
    }
  }

  /**
   * Handle messages from host
   */
  private handleMessage(event: MessageEvent): void {
    const message: WidgetMessage = event.data;

    if (message.type === "CONFIG_UPDATE") {
      this.updateConfig(message.payload);
    }
  }

  /**
   * Notify host that widget is ready
   */
  private notifyHostReady(): void {
    this.sendToHost({
      type: "WIDGET_READY",
      payload: {
        name: this.definition.name,
        version: this.definition.version,
        description: this.definition.description,
        defaultConfig: this.definition.defaultConfig,
        configSchema: this.definition.configSchema,
      },
    });
    this.isReady = true;
  }

  /**
   * Update config from host
   */
  private updateConfig(newConfig: WidgetConfig): void {
    this.config = { ...newConfig };
    this.notifyConfigChange();
  }

  /**
   * Send message to host
   */
  private sendToHost(message: WidgetMessage): void {
    if (window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  /**
   * Dispatch custom event for config changes
   */
  private notifyConfigChange(): void {
    const event = new CustomEvent("widgetConfigChange", {
      detail: this.config,
    });
    window.dispatchEvent(event);
  }

  /**
   * Get current config
   */
  public getConfig(): WidgetConfig {
    return { ...this.config };
  }

  /**
   * Listen to config changes
   */
  public onConfigChange(callback: (config: WidgetConfig) => void): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<WidgetConfig>;
      callback(customEvent.detail);
    };

    window.addEventListener("widgetConfigChange", handler);

    // Return cleanup function
    return () => {
      window.removeEventListener("widgetConfigChange", handler);
    };
  }

  /**
   * Report error to host (optional)
   */
  public reportError(error: Error): void {
    this.sendToHost({
      type: "WIDGET_ERROR",
      payload: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
}
