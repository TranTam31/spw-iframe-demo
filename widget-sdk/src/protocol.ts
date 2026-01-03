export type WidgetMessage =
  | { type: "READY" }
  | { type: "SET_CONFIG"; payload: any }
  | { type: "CONFIG_CHANGED"; payload: any }
  | { type: "LOG"; payload: string };
