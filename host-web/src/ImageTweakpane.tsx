import { useEffect } from "react";
import { Pane } from "tweakpane";
import * as TweakpaneImagePlugin from "@kitschpatrol/tweakpane-plugin-image";

export default function ImageTweakpane() {
  useEffect(() => {
    const pane = new Pane();
    pane.registerPlugin(TweakpaneImagePlugin);

    const params = {
      Image: "",
    };

    // Input ảnh từ URL
    pane.addBinding(params, "Image", {
      view: "input-image",
    });

    return () => pane.dispose();
  }, []);

  return null;
}
