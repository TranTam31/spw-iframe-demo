import { createWidget } from "@joymath/widget-sdk";
import { widgetDefinition } from "./definition";
import { WidgetComponent } from "./components/WidgetComponent";

createWidget({
  definition: widgetDefinition,
  component: WidgetComponent,
});
