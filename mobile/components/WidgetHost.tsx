import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react-native";

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
  };
}

// Utility: Extract defaults from schema
function extractDefaultsFromSchema(
  schema: Record<string, any>,
): Record<string, any> {
  const config: Record<string, any> = {};

  Object.keys(schema).forEach((key) => {
    const field = schema[key];

    if (field.type === "folder") {
      if (field.fields) {
        config[key] = extractDefaultsFromSchema(field.fields);
      }
    } else {
      if (field.default !== undefined) {
        config[key] = field.default;
      }
    }
  });

  return config;
}

// Deep merge utility
function deepMerge(target: any, source: any): any {
  const output = { ...target };

  if (!source || typeof source !== "object") return output;

  Object.keys(source).forEach((key) => {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });

  return output;
}

export default function WidgetHost({
  widgetUrl,
  initialConfig,
  onExit,
}: {
  widgetUrl: string;
  initialConfig?: Record<string, any>;
  onExit: () => void;
}) {
  const [widgetDef, setWidgetDef] = useState<WidgetDefinition | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const configSentRef = useRef(false);

  // Send message to WebView
  const sendMessage = (message: any) => {
    const messageJson = JSON.stringify(message);
    console.log("📤 Sending to widget:", message.type);

    const script = `
      if (typeof window.handleMessageFromNative === 'function') {
        window.handleMessageFromNative('${messageJson.replace(/'/g, "\\'")}');
      }
      true;
    `;

    webViewRef.current?.injectJavaScript(script);
  };

  // Handle messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log("📥 Received from widget:", message.type, message.payload);

      if (message.type === "WIDGET_READY") {
        const def = message.payload;

        // ✅ FIX: Bỏ qua WIDGET_READY nếu không có schema
        if (!def || !def.schema) {
          console.log("⚠️ WIDGET_READY without schema, ignoring...");
          return;
        }

        console.log("📦 Widget definition received with schema");
        setWidgetDef(def);
        setLoading(false);
        setError(null);

        // ✅ TỰ ĐỘNG GỬI CONFIG NGAY SAU KHI WIDGET READY
        if (!configSentRef.current) {
          configSentRef.current = true;

          // Extract defaults from schema
          const defaults = extractDefaultsFromSchema(def.schema);
          console.log("🎯 Schema defaults:", defaults);

          // Merge với initialConfig (initialConfig override defaults)
          const finalConfig = deepMerge(defaults, initialConfig || {});
          console.log("✨ Final config:", finalConfig);

          setConfig(finalConfig);

          // Gửi config xuống widget
          setTimeout(() => {
            sendMessage({
              type: "PARAMS_UPDATE",
              payload: finalConfig,
            });
          }, 100);
        }
      }

      if (message.type === "SUBMIT") {
        const submissionData: Submission = message.payload;
        console.log("✅ Submission received:", submissionData);
        setSubmission(submissionData);

        // TODO: Gửi lên server
        console.log(
          "💾 SAVE TO DATABASE:",
          JSON.stringify(submissionData, null, 2),
        );
      }

      if (message.type === "ERROR") {
        console.error("❌ Widget error:", message.payload);
        setError(message.payload?.message || "Widget error");
      }
    } catch (err) {
      console.error("Failed to parse message:", err);
    }
  };

  // Review mode
  const enterReviewMode = () => {
    if (!submission || !config) return;
    console.log("🔍 Entering review mode");
    setIsReviewMode(true);
    sendMessage({
      type: "PARAMS_UPDATE",
      payload: {
        ...config,
        __answer: submission.answer,
      },
    });
  };

  const exitReviewMode = () => {
    console.log("🔙 Exiting review mode");
    setIsReviewMode(false);
    sendMessage({
      type: "PARAMS_UPDATE",
      payload: config,
    });
    setSubmission(null);
  };

  // Inject code to setup bridge before content loads
  const injectedJavaScriptBeforeContentLoaded = `
    window.handleMessageFromNative = function(messageJson) {
      try {
        const message = JSON.parse(messageJson);
        const event = new MessageEvent('message', {
          data: message
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Failed to handle native message:', error);
      }
    };
    true;
  `;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white border-b border-slate-200 px-4 py-3 pt-12">
        <TouchableOpacity
          onPress={onExit}
          className="flex-row items-center gap-2"
        >
          <ArrowLeft size={18} color="#475569" />
          <Text className="text-sm font-medium text-slate-600">Quay lại</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Widget WebView */}
        <View
          className="flex-1 bg-white mx-4 my-4 rounded-3xl overflow-hidden shadow-xl"
          style={{ height: 600 }}
        >
          <WebView
            ref={webViewRef}
            source={{ uri: widgetUrl }}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            injectedJavaScriptBeforeContentLoaded={
              injectedJavaScriptBeforeContentLoaded
            }
            onLoadStart={() => {
              console.log("🎬 WebView loading...");
              setLoading(true);
            }}
            onLoadEnd={() => {
              console.log("✅ WebView loaded");
              // Không set loading = false ở đây, đợi WIDGET_READY
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error("❌ WebView error:", nativeEvent);
              setError("Không thể tải widget");
              setLoading(false);
            }}
          />

          {loading && (
            <View className="absolute inset-0 bg-white items-center justify-center">
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text className="text-sm text-slate-500 mt-2">
                Đang tải widget...
              </Text>
            </View>
          )}
        </View>

        {error && (
          <View className="mx-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row gap-3">
            <AlertCircle color="#ef4444" size={20} />
            <View className="flex-1">
              <Text className="font-semibold text-red-700">Có lỗi xảy ra</Text>
              <Text className="text-sm text-red-600 mt-1">{error}</Text>
            </View>
          </View>
        )}

        {/* Submission Info */}
        {submission && (
          <View className="mx-4 mb-4 p-4 bg-white rounded-2xl shadow">
            <Text className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
              📊 Kết quả nộp bài
            </Text>

            <View
              className={`p-3 rounded-lg ${
                submission.evaluation.isCorrect
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <View className="flex-row items-center gap-2 mb-2">
                {submission.evaluation.isCorrect ? (
                  <CheckCircle color="#16a34a" size={18} />
                ) : (
                  <XCircle color="#dc2626" size={18} />
                )}
                <Text
                  className={`font-semibold ${
                    submission.evaluation.isCorrect
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {submission.evaluation.isCorrect ? "Đúng" : "Sai"}
                </Text>
              </View>

              <Text className="text-sm text-slate-700">
                Điểm:{" "}
                <Text className="font-bold">
                  {submission.evaluation.score}/{submission.evaluation.maxScore}
                </Text>
              </Text>
            </View>

            {/* Review Mode Toggle */}
            <View className="mt-3">
              {!isReviewMode ? (
                <TouchableOpacity
                  onPress={enterReviewMode}
                  className="w-full bg-blue-600 py-3 px-4 rounded-lg"
                >
                  <Text className="text-white text-sm font-medium text-center">
                    🔍 Xem lại bài làm
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={exitReviewMode}
                  className="w-full bg-slate-600 py-3 px-4 rounded-lg"
                >
                  <Text className="text-white text-sm font-medium text-center">
                    ← Quay lại chế độ làm bài
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
