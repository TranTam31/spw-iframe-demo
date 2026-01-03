import type { WidgetDefinition } from "widget-sdk";

const registry = new Map<string, WidgetDefinition>();

export function registerWidgetFromIframe(
  widgetType: string,
  def: WidgetDefinition
) {
  registry.set(widgetType, def);
}

export function getWidgetDefinition(widgetType: string) {
  return registry.get(widgetType);
}
