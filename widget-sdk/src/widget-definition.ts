export type ControlSchema =
  | { type: "text"; key: string; label?: string }
  | { type: "number"; key: string; min?: number; max?: number; step?: number }
  | { type: "color"; key: string };

export interface WidgetDefinition<T = any> {
  name: string;
  defaultData: T;
  controls: ControlSchema[];
}
