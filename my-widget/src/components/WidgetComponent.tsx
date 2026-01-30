import "../index.css";

import { useWidgetParams, useSubmission } from "@joymath/widget-sdk";
import type { WidgetParams, WidgetAnswer } from "../definition";

type AnswerKey = "A" | "B" | "C" | "D";

export function WidgetComponent() {
  const params = useWidgetParams<WidgetParams>();

  // useSubmission hook - handles everything!
  const {
    answer,
    setAnswer,
    result,
    submit,
    isLocked,
    canSubmit,
    isSubmitting,
  } = useSubmission<WidgetAnswer>({
    evaluate: (ans) => {
      const isCorrect = ans.selected === params.answers.correct;

      return {
        isCorrect,
        score: isCorrect ? 100 : 0,
        maxScore: 100,
      };
    },
  });

  // Helper function for button styling
  const getButtonClass = (key: AnswerKey): string => {
    const isSelected = answer?.selected === key;
    const isCorrect = key === params.answers.correct;
    const showResult = isLocked; // Show result when locked (review mode)

    let className =
      "w-full text-left px-6 py-4 rounded-xl border-2 transition-all font-medium ";

    if (!showResult) {
      // Practice mode - chưa submit
      className += isSelected
        ? "bg-indigo-50 border-indigo-400 text-indigo-900"
        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700";
    } else {
      // Review mode hoặc đã submit
      if (isCorrect) {
        className += "bg-green-50 border-green-400 text-green-900";
      } else if (isSelected && !isCorrect) {
        className += "bg-red-50 border-red-400 text-red-900";
      } else {
        className += "bg-slate-50 border-slate-200 text-slate-500";
      }
    }

    return className;
  };

  const answers: Record<AnswerKey, string> = {
    A: params.answers.a,
    B: params.answers.b,
    C: params.answers.c,
    D: params.answers.d,
  };

  const handleSelect = (key: AnswerKey) => {
    if (isLocked) return;
    setAnswer({ selected: key });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-2xl">
        {/* Review Mode Badge */}
        {isLocked && (
          <div className="mb-4 text-center">
            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              📋 Chế độ xem lại
            </span>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-slate-200">
          {/* Question */}
          <h2 className="text-2xl font-bold mb-8 text-slate-800 leading-tight">
            {params.question}
          </h2>

          {/* Answers */}
          <div className="space-y-3 mb-8">
            {(Object.keys(answers) as AnswerKey[]).map((key) => {
              const isSelected = answer?.selected === key;
              const isCorrect = key === params.answers.correct;
              const showResult = isLocked;

              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  disabled={isLocked}
                  className={getButtonClass(key)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm">
                      {key}
                    </span>
                    <span className="flex-1">{answers[key]}</span>
                    {showResult && isCorrect && (
                      <span className="text-green-600 text-xl">✓</span>
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <span className="text-red-600 text-xl">✗</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          {!isLocked && (
            <button
              onClick={submit}
              disabled={!canSubmit || isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              {isSubmitting ? "Đang nộp bài..." : "Nộp bài"}
            </button>
          )}

          {/* Result */}
          {result && isLocked && (
            <div
              className={`p-6 rounded-xl mt-8 ${
                result.isCorrect
                  ? "bg-green-50 border-2 border-green-200"
                  : "bg-red-50 border-2 border-red-200"
              }`}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {result.isCorrect ? "🎉" : "❌"}
                </div>
                <div
                  className={`text-xl font-bold mb-2 ${
                    result.isCorrect ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {result.isCorrect ? "Chính xác!" : "Chưa chính xác"}
                </div>
                <div
                  className={`text-sm ${
                    result.isCorrect ? "text-green-700" : "text-red-700"
                  }`}
                >
                  Điểm: {result.score}/{result.maxScore}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
