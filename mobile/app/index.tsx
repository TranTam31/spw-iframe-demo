import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { AlertCircle, Link } from "lucide-react-native";
import WidgetHost from "@/components/WidgetHost";

export default function Index() {
  const [widgetUrl, setWidgetUrl] = useState<string>("");
  const [inputUrl, setInputUrl] = useState<string>("");
  const [widgetConfig, setWidgetConfig] = useState<string>("");
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

    // Parse config nếu có
    let parsedConfig: Record<string, any> = {};
    if (widgetConfig.trim()) {
      try {
        parsedConfig = JSON.parse(widgetConfig);
      } catch (err) {
        setError("Config JSON không hợp lệ");
        return;
      }
    }

    setValidating(true);
    setTimeout(() => {
      setValidating(false);
      setWidgetUrl(inputUrl);
    }, 500);
  };

  if (widgetUrl) {
    // Parse config
    let initialConfig: Record<string, any> = {};
    if (widgetConfig.trim()) {
      try {
        initialConfig = JSON.parse(widgetConfig);
      } catch (err) {
        // Fallback to empty config
      }
    }

    return (
      <WidgetHost
        widgetUrl={widgetUrl}
        initialConfig={initialConfig}
        onExit={() => setWidgetUrl("")}
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="max-w-2xl w-full mx-auto px-6 pt-20">
        <View className="text-center mb-10">
          <Text className="text-5xl font-black text-gray-900 mb-4 text-center">
            Widget Studio
          </Text>
          <Text className="text-gray-500 mb-2 text-center">
            Hệ thống widget với submission & evaluation
          </Text>
        </View>

        <View className="bg-white p-10 rounded-3xl shadow-xl border border-gray-50">
          <View className="flex-row items-center gap-3 mb-6">
            <View className="w-12 h-12 bg-indigo-50 rounded-xl items-center justify-center">
              <Link color="#4f46e5" size={24} />
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-800">
                Nhập URL Widget
              </Text>
              <Text className="text-sm text-gray-500">
                Dán link widget để bắt đầu
              </Text>
            </View>
          </View>

          <View className="space-y-4">
            {/* Widget URL */}
            <View>
              <Text className="text-xs text-slate-600 mb-1">URL Widget</Text>
              <TextInput
                value={inputUrl}
                onChangeText={setInputUrl}
                placeholder="http://localhost:5173"
                placeholderTextColor="#9ca3af"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700"
                editable={!validating}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Config JSON */}
            <View>
              <Text className="text-xs text-slate-600 mb-1">
                Config (JSON - tùy chọn)
              </Text>
              <TextInput
                value={widgetConfig}
                onChangeText={setWidgetConfig}
                placeholder='{"question": "2 + 2 = ?", "answers": {...}}'
                placeholderTextColor="#9ca3af"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700"
                editable={!validating}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start gap-2">
                <AlertCircle color="#ef4444" size={18} />
                <Text className="text-sm text-red-600 flex-1">{error}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleLoadWidget}
              disabled={validating}
              className={`w-full ${validating ? "bg-gray-400" : "bg-indigo-600"} py-3 px-6 rounded-xl items-center`}
            >
              <Text className="text-white font-semibold">
                {validating ? "Đang kiểm tra widget..." : "Tải Widget"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-6 pt-6 border-t border-gray-100">
            <Text className="text-xs text-gray-400 leading-relaxed">
              <Text className="font-semibold">Lưu ý:</Text> Để trống config để
              dùng giá trị mặc định
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
