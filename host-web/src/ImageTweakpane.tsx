import { useEffect } from "react";
import { Pane } from "tweakpane";
import * as TweakpaneImagePlugin from "@kitschpatrol/tweakpane-plugin-image";

export default function ImageTweakpane() {
  useEffect(() => {
    const pane = new Pane();
    pane.registerPlugin(TweakpaneImagePlugin);

    const params = {
      url: "",
    };

    // Input ảnh từ URL
    pane.addBinding(params, "url", {
      view: "input-image",
    });

    return () => pane.dispose();
  }, []);

  return null;
}
