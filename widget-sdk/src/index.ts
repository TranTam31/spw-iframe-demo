// widget-sdk/src/index.ts
export type WidgetConfig = Record<string, any>;

export interface TweakpaneSetupContext {
  pane: any;
  config: WidgetConfig;
  onChange: (newConfig: WidgetConfig) => void;
}

export interface WidgetDefinition {
  name: string;
  defaultConfig: WidgetConfig;
  setupTweakpane: (context: TweakpaneSetupContext) => void;
}

export interface WidgetMessage {
  type: "WIDGET_READY" | "CONFIG_UPDATE";
  payload?: any;
}

export class WidgetSDK {
  private config: WidgetConfig;
  private definition: WidgetDefinition;

  constructor(definition: WidgetDefinition) {
    this.definition = definition;
    this.config = { ...definition.defaultConfig };
    this.init();
  }

  private init() {
    // Lắng nghe message từ host
    window.addEventListener("message", (event) => {
      if (event.data.type === "CONFIG_UPDATE") {
        this.config = event.data.payload;
        this.notifyConfigChange();
      }
    });

    // Gửi definition lên host
    this.sendToHost({
      type: "WIDGET_READY",
      payload: {
        name: this.definition.name,
        defaultConfig: this.definition.defaultConfig,
        // Serialize setupTweakpane function
        setupTweakpaneCode: this.definition.setupTweakpane.toString(),
      },
    });
  }

  private sendToHost(message: WidgetMessage) {
    window.parent.postMessage(message, "*");
  }

  private notifyConfigChange() {
    const event = new CustomEvent("configChange", {
      detail: this.config,
    });
    window.dispatchEvent(event);
  }

  public getConfig(): WidgetConfig {
    return { ...this.config };
  }

  public onConfigChange(callback: (config: WidgetConfig) => void) {
    window.addEventListener("configChange", (e: any) => {
      callback(e.detail);
    });
  }
}
