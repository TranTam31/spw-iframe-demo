export type WidgetMessage =
  | { type: "READY" }
  | { type: "SET_CONFIG"; payload: any }
  | { type: "CONFIG_CHANGED"; payload: any }
  | { type: "WIDGET_REGISTER"; widgetType: string; definition: any };
