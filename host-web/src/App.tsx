import { useState, useEffect, useRef } from "react";
import { Pane } from "tweakpane";
import * as TweakpaneImagePlugin from "@kitschpatrol/tweakpane-plugin-image";
import {
  ArrowLeft,
  AlertCircle,
  Link,
  CheckCircle,
  XCircle,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================
interface WidgetDefinition {
  schema: Record<string, any>;
  hasEvaluator?: boolean;
}

interface Submission {
  answer: any;
  evaluation: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
    feedback?: string;
    details?: any;
  };
  metadata: {
    timeSpent?: number;
    attemptCount?: number;
    timestamp: number;
  };
}

// ============================================================
// SCHEMA UTILITIES
// ============================================================
class SchemaProcessor {
  static extractDefaultsFromSchema(
    schema: Record<string, any>,
  ): Record<string, any> {
    const config: Record<string, any> = {};

    Object.keys(schema).forEach((key) => {
      const field = schema[key];

      if (field.type === "folder") {
        if (field.fields) {
          config[key] = this.extractDefaultsFromSchema(field.fields);
        }
      } else {
        if (field.default !== undefined) {
          config[key] = field.default;
        }
      }
    });

    return config;
  }
}

// ============================================================
// TWEAKPANE BUILDER
// ============================================================
class TweakpaneBuilder {
  private pane: any;
  private config: Record<string, any>;
  private schema: Record<string, any>;
  private onChange: (config: Record<string, any>) => void;
  private controlsMap: Map<string, any> = new Map();

  constructor(
    pane: any,
    config: Record<string, any>,
    schema: Record<string, any>,
    onChange: (config: Record<string, any>) => void,
  ) {
    this.pane = pane;
    this.config = config;
    this.schema = schema;
    this.onChange = onChange;
  }

  build() {
    Object.keys(this.schema).forEach((key) => {
      const field = this.schema[key];
      this.processField(key, field, this.pane, this.config, []);
    });

    this.pane.on("change", async () => {
      this.updateVisibility();
      const serializedConfig = await this.serializeConfig(this.config);
      this.onChange(serializedConfig);
    });

    this.updateVisibility();
  }

  private checkVisibility(visibleIf: any): boolean {
    if (!visibleIf) return true;

    const { param, equals, notEquals, in: inArray } = visibleIf;
    const value = this.getConfigValue(param);

    if (equals !== undefined) {
      return value === equals;
    }

    if (notEquals !== undefined) {
      return value !== notEquals;
    }

    if (inArray !== undefined) {
      return inArray.includes(value);
    }

    return true;
  }

  private getConfigValue(path: string): any {
    const parts = path.split(".");
    let value = this.config;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }

    return value;
  }

  private updateVisibility() {
    this.controlsMap.forEach((control, path) => {
      const field = this.getFieldFromPath(path);
      if (field && field.visibleIf) {
        const visible = this.checkVisibility(field.visibleIf);
        control.hidden = !visible;
      }
    });
  }

  async serializeConfig(
    config: Record<string, any>,
  ): Promise<Record<string, any>> {
    const serialized: Record<string, any> = {};

    for (const key of Object.keys(config)) {
      const value = config[key];

      if (value === null || value === undefined) {
        serialized[key] = value;
      } else if (value instanceof HTMLImageElement) {
        const url = value.src || "";
        if (url.startsWith("blob:")) {
          try {
            serialized[key] = await this.blobUrlToDataUrl(url);
          } catch (err) {
            console.warn("Failed to convert blob URL:", err);
            serialized[key] = "";
          }
        } else {
          serialized[key] = url;
        }
      } else if (typeof value === "object" && !Array.isArray(value)) {
        serialized[key] = await this.serializeConfig(value);
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  private async blobUrlToDataUrl(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private getFieldFromPath(path: string): any {
    const parts = path.split(".");
    let current = this.schema;

    for (const part of parts) {
      if (!current) return null;

      if (current[part]) {
        current = current[part];
      } else if (current.fields && current.fields[part]) {
        current = current.fields[part];
      } else {
        return null;
      }
    }

    return current;
  }

  private processField(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[],
  ) {
    if (field.type === "folder") {
      this.buildFolder(key, field, parentPane, parentConfig, pathPrefix);
    } else {
      this.buildControl(key, field, parentPane, parentConfig, pathPrefix);
    }
  }

  private buildFolder(
    key: string,
    folderSchema: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[],
  ) {
    const folder = parentPane.addFolder({
      title: folderSchema.title || key,
      expanded: folderSchema.expanded ?? true,
    });

    const currentPath = [...pathPrefix, key].join(".");
    this.controlsMap.set(currentPath, folder);

    if (!parentConfig[key]) {
      parentConfig[key] = {};
    }

    if (folderSchema.fields) {
      Object.keys(folderSchema.fields).forEach((fieldKey) => {
        const field = folderSchema.fields[fieldKey];
        this.processField(fieldKey, field, folder, parentConfig[key], [
          ...pathPrefix,
          key,
        ]);
      });
    }
  }

  private buildControl(
    key: string,
    field: any,
    parentPane: any,
    parentConfig: Record<string, any>,
    pathPrefix: string[],
  ) {
    const options: any = {
      label: field.label || key,
    };

    if (parentConfig[key] === undefined && field.default !== undefined) {
      parentConfig[key] = field.default;
    }

    let control: any = null;

    switch (field.type) {
      case "string":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "number":
        if (field.min !== undefined) options.min = field.min;
        if (field.max !== undefined) options.max = field.max;
        if (field.step !== undefined) options.step = field.step;
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "boolean":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "color":
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "image":
        options.view = "input-image";
        if (field.placeholder) {
          options.placeholder = field.placeholder;
        }
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      case "select":
        if (field.options) {
          options.options = field.options.reduce((acc: any, opt: any) => {
            acc[opt] = opt;
            return acc;
          }, {});
        }
        control = parentPane.addBinding(parentConfig, key, options);
        break;

      default:
        console.warn(`Unknown field type: ${field.type} for key: ${key}`);
    }

    if (control) {
      const currentPath = [...pathPrefix, key].join(".");
      this.controlsMap.set(currentPath, control);
    }
  }
}

// ============================================================
// WIDGET HOST COMPONENT
// ============================================================
function WidgetHost({
  widgetUrl,
  onExit,
}: {
  widgetUrl: string;
  onExit: () => void;
}) {
  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);

  // NEW: Submission state
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const paneInstanceRef = useRef<any>(null);
  const messageQueueRef = useRef<any[]>([]);

  useEffect(() => {
    if (!iframeRef.current) return;

    console.log(`📥 Loading widget from: ${widgetUrl}`);
    setLoading(true);
    setError(null);
    setIframeReady(false);

    iframeRef.current.src = widgetUrl;
  }, [widgetUrl]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log("🎬 Iframe loaded successfully");

      setTimeout(() => {
        setIframeReady(true);

        if (messageQueueRef.current.length > 0) {
          console.log(
            `📨 Flushing ${messageQueueRef.current.length} queued messages`,
          );
          messageQueueRef.current.forEach((msg) => {
            iframe.contentWindow?.postMessage(msg, "*");
          });
          messageQueueRef.current = [];
        }
      }, 300);
    };

    const handleError = () => {
      console.error("❌ Iframe failed to load");
      setError("Không thể tải widget từ URL này");
      setLoading(false);
    };

    iframe.addEventListener("load", handleLoad);
    iframe.addEventListener("error", handleError);

    return () => {
      iframe.removeEventListener("load", handleLoad);
      iframe.removeEventListener("error", handleError);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        const def = event.data.payload;
        console.log("📦 Widget definition received:", def);
        setWidgetDef(def);
        setLoading(false);
        setError(null);
      }

      // NEW: Handle submission
      if (event.data.type === "SUBMIT") {
        const submissionData: Submission = event.data.payload;
        console.log("✅ Submission received:", submissionData);

        setSubmission(submissionData);

        // In production: save to database
        // For demo: show in console and alert
        console.log(
          "💾 SAVE TO DATABASE:",
          JSON.stringify(submissionData, null, 2),
        );
      }

      if (event.data.type === "EVENT") {
        console.log("📣 Widget event:", event.data.event, event.data.payload);
      }

      if (event.data.type === "ERROR") {
        console.error("❌ Widget error:", event.data.payload);
        setError(event.data.payload?.message || "Widget error");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const sendMessage = (message: any) => {
    if (iframeRef.current?.contentWindow && iframeReady) {
      console.log("📤 Sending to widget:", message.type);
      iframeRef.current.contentWindow.postMessage(message, "*");
    } else {
      console.log("⏳ Queuing message (iframe not ready):", message.type);
      messageQueueRef.current.push(message);
    }
  };

  // NEW: Enter review mode
  const enterReviewMode = () => {
    if (!submission || !config) return;

    console.log("🔍 Entering review mode with:", { config, submission });

    setIsReviewMode(true);

    // Gửi config + answer (không gửi evaluation!)
    sendMessage({
      type: "PARAMS_UPDATE",
      payload: {
        ...config,
        __answer: submission.answer, // Chỉ gửi answer
      },
    });
  };

  // NEW: Exit review mode
  const exitReviewMode = () => {
    console.log("🔙 Exiting review mode");
    setIsReviewMode(false);

    // Reload iframe to reset widget state
    if (iframeRef.current) {
      const currentUrl = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentUrl;
        }
      }, 50);
    }

    // Clear submission to allow new attempt
    setSubmission(null);
  };

  useEffect(() => {
    if (!widgetDef || !paneRef.current) return;

    if (paneInstanceRef.current) {
      paneInstanceRef.current.dispose();
    }

    try {
      const pane = new Pane({
        container: paneRef.current,
        title: "Widget Parameters",
      });

      pane.registerPlugin(TweakpaneImagePlugin);
      paneInstanceRef.current = pane;

      const initialConfig = SchemaProcessor.extractDefaultsFromSchema(
        widgetDef.schema,
      );

      console.log("🎯 Initial config extracted:", initialConfig);

      const handleConfigChange = (newConfig: Record<string, any>) => {
        console.log("🔄 Config changed, sending to widget");
        setConfig(newConfig);
        sendMessage({
          type: "PARAMS_UPDATE",
          payload: newConfig,
        });
      };

      const builder = new TweakpaneBuilder(
        pane,
        initialConfig,
        widgetDef.schema,
        handleConfigChange,
      );

      builder.build();

      setTimeout(async () => {
        const serializedConfig = await builder.serializeConfig(initialConfig);
        handleConfigChange(serializedConfig);
      }, 100);
    } catch (err) {
      console.error("❌ Tweakpane setup error:", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    }

    return () => {
      if (paneInstanceRef.current) {
        paneInstanceRef.current.dispose();
        paneInstanceRef.current = null;
      }
    };
  }, [widgetDef, iframeReady]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      <div className="flex-1 px-12 py-2">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 mb-3 px-4 py-2 rounded-full 
                 text-sm font-medium text-slate-600 
                 bg-white shadow hover:text-slate-900 hover:shadow-md transition"
          >
            <ArrowLeft size={18} />
            Quay lại
          </button>

          {/* Widget Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="h-[620px]">
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                title="Widget"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>

        {loading && !error && (
          <div className="mt-6 flex items-center justify-center gap-3 text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            <span className="text-sm">Đang tải widget...</span>
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-3xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="text-red-500 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-red-700">Có lỗi xảy ra</div>
              <div className="text-sm text-red-600 mt-1">{error}</div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">
            Cấu hình & Kết quả
          </h3>
        </div>

        <div
          ref={paneRef}
          className="flex-1 overflow-y-auto p-4 text-sm text-slate-600"
        />

        {/* NEW: Submission Info */}
        {submission && (
          <div className="border-t border-slate-200 p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              📊 Kết quả nộp bài
            </div>

            <div
              className={`p-3 rounded-lg ${
                submission.evaluation.isCorrect
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {submission.evaluation.isCorrect ? (
                  <CheckCircle className="text-green-600" size={18} />
                ) : (
                  <XCircle className="text-red-600" size={18} />
                )}
                <span
                  className={`font-semibold ${
                    submission.evaluation.isCorrect
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {submission.evaluation.isCorrect ? "Đúng" : "Sai"}
                </span>
              </div>

              <div className="text-sm space-y-1">
                <div className="text-slate-700">
                  Điểm:{" "}
                  <strong>
                    {submission.evaluation.score}/
                    {submission.evaluation.maxScore}
                  </strong>
                </div>

                {/* {submission.metadata.timeSpent && (
                  <div className="text-slate-600">
                    Thời gian:{" "}
                    {Math.round(submission.metadata.timeSpent / 1000)}s
                  </div>
                )} */}
              </div>
            </div>

            {/* Review Mode Toggle */}
            {!isReviewMode ? (
              <button
                onClick={enterReviewMode}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                🔍 Xem lại bài làm
              </button>
            ) : (
              <button
                onClick={exitReviewMode}
                className="w-full bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
              >
                ← Quay lại chế độ làm bài
              </button>
            )}

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
              💾 Dữ liệu đã được log ra console
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WIDGET VALIDATOR
// ============================================================
async function validateWidget(url: string): Promise<{
  valid: boolean;
  error?: string;
  errorType?: "cors" | "network" | "timeout" | "invalid";
}> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-same-origin");

    let timeout: number;
    let messageListener: (event: MessageEvent) => void;

    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", messageListener);
      document.body.removeChild(iframe);
    };

    messageListener = (event: MessageEvent) => {
      if (event.data.type === "WIDGET_READY") {
        console.log("✅ Widget validation successful");
        cleanup();
        resolve({ valid: true });
      }
    };

    timeout = setTimeout(() => {
      console.log("❌ Widget validation timeout");
      cleanup();
      resolve({
        valid: false,
        error:
          "Widget không phản hồi trong 2 giây. Đây không phải widget hợp lệ của Widget Studio (thiếu event WIDGET_READY)",
        errorType: "timeout",
      });
    }, 2000);

    iframe.onerror = () => {
      cleanup();
      resolve({
        valid: false,
        error: "Không thể tải widget từ URL này",
        errorType: "network",
      });
    };

    window.addEventListener("message", messageListener);
    document.body.appendChild(iframe);
    iframe.src = url;
  });
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [widgetUrl, setWidgetUrl] = useState<string>("");
  const [inputUrl, setInputUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [validating, setValidating] = useState(false);

  const handleLoadWidget = async () => {
    setError("");

    if (!inputUrl.trim()) {
      setError("Vui lòng nhập URL của widget");
      return;
    }

    try {
      new URL(inputUrl);
    } catch (err) {
      setError("URL không hợp lệ.");
      return;
    }

    setValidating(true);
    const result = await validateWidget(inputUrl);
    setValidating(false);

    if (!result.valid) {
      setError(result.error || "Widget không hợp lệ");
      return;
    }

    setWidgetUrl(inputUrl);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !validating) {
      handleLoadWidget();
    }
  };

  if (widgetUrl) {
    return <WidgetHost widgetUrl={widgetUrl} onExit={() => setWidgetUrl("")} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex justify-center p-6">
      <div className="max-w-2xl w-full">
        <header className="text-center mb-10 mt-20">
          <h1 className="text-5xl font-black text-gray-900 mb-4 tracking-tight">
            Widget Studio
          </h1>
          <p className="text-gray-500 mb-2">
            Hệ thống widget với submission & evaluation
          </p>
        </header>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Link className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Nhập URL Widget
              </h2>
              <p className="text-sm text-gray-500">
                Dán link widget để bắt đầu
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="http://localhost:5173"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors text-gray-700"
              disabled={validating}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle
                  className="text-red-500 shrink-0 mt-0.5"
                  size={18}
                />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleLoadWidget}
              disabled={validating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {validating ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Đang kiểm tra widget...
                </>
              ) : (
                "Tải Widget"
              )}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">
              <span className="font-semibold">Lưu ý:</span> Widget phải tuân
              theo Widget Protocol và có evaluator để hỗ trợ submission.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
