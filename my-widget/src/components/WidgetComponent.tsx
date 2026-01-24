import "../index.css";

import { useState, useEffect } from "react";
import {
  useWidgetParams,
  useWidgetState,
  useSubmission,
  useReviewMode,
} from "@joymath/widget-sdk";
import { MultipleChoiceAnswer, WidgetParams } from "../definition";
import { EvaluationResult } from "@joymath/widget-sdk";

type AnswerKey = "A" | "B" | "C" | "D";

export function WidgetComponent() {
  const params = useWidgetParams<WidgetParams>();
  const { submit, isSubmitting, submission } =
    useSubmission<MultipleChoiceAnswer>();
  const { isReviewMode, reviewData } = useReviewMode();

  // Track start time for calculating time spent
  const [startTime] = useState(Date.now());

  // Selected answer
  const [selected, setSelected] = useState<AnswerKey | null>(null);

  // Show result state
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const answers: Record<AnswerKey, string> = {
    A: params.answers.a,
    B: params.answers.b,
    C: params.answers.c,
    D: params.answers.d,
  };

  const handleSelect = (key: AnswerKey) => {
    if (showResult || isReviewMode) return;
    setSelected(key);
  };

  const handleSubmit = async () => {
    if (!selected || showResult || isReviewMode) return;

    const timeSpent = Date.now() - startTime;
    const isCorrect = selected === params.answers.correct;

    // Create answer object
    const answer: MultipleChoiceAnswer = {
      selected,
      timeSpent,
    };

    // Create evaluation
    const evaluation: EvaluationResult = {
      isCorrect,
      score: isCorrect ? 100 : 0,
      maxScore: 100,
      feedback: isCorrect
        ? "🎉 Chính xác!"
        : params.settings.showFeedback && params.settings.feedback
          ? params.settings.feedback
          : "❌ Sai rồi! Đáp án đúng là " + params.answers.correct,
    };

    // Submit via SDK
    const submissionResult = await submit(answer);

    if (submissionResult) {
      setResult(evaluation);
      setShowResult(true);
    }
  };

  // Update UI when review mode changes
  useEffect(() => {
    console.log("🎯 Widget: Review mode changed", { isReviewMode, reviewData });

    if (isReviewMode && reviewData) {
      setSelected(reviewData.answer.selected);
      setResult(reviewData.evaluation);
      setShowResult(true);
    } else {
      // Reset when exiting review mode
      setSelected(null);
      setResult(null);
      setShowResult(false);
    }
  }, [isReviewMode, reviewData]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-2xl">
        {/* Review Mode Badge */}
        {isReviewMode && (
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
              const isSelected = selected === key;
              const isCorrect = key === params.answers.correct;
              const shouldHighlight = showResult;

              let className =
                "w-full text-left px-6 py-4 rounded-xl border-2 transition-all font-medium";

              if (!shouldHighlight && !isReviewMode) {
                // Practice mode, before submit
                className += isSelected
                  ? " bg-indigo-50 border-indigo-400 text-indigo-900"
                  : " bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700";
              } else {
                // After submit or review mode
                if (isCorrect) {
                  className += " bg-green-50 border-green-400 text-green-900";
                } else if (isSelected && !isCorrect) {
                  className += " bg-red-50 border-red-400 text-red-900";
                } else {
                  className += " bg-slate-50 border-slate-200 text-slate-500";
                }
              }

              return (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  disabled={showResult || isReviewMode}
                  className={className}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm">
                      {key}
                    </span>
                    <span className="flex-1">{answers[key]}</span>
                    {shouldHighlight && isCorrect && (
                      <span className="text-green-600">✓</span>
                    )}
                    {shouldHighlight && isSelected && !isCorrect && (
                      <span className="text-red-600">✗</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          {!showResult && !isReviewMode && (
            <button
              onClick={handleSubmit}
              disabled={!selected || isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              {isSubmitting ? "Đang nộp bài..." : "Nộp bài"}
            </button>
          )}

          {/* Result */}
          {showResult && result && (
            <div
              className={`p-6 rounded-xl ${
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
                {result.feedback && (
                  <div
                    className={`mt-4 text-sm ${
                      result.isCorrect ? "text-green-800" : "text-red-800"
                    }`}
                  >
                    {result.feedback}
                  </div>
                )}
              </div>

              {/* Metadata in review mode */}
              {isReviewMode && reviewData && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                  <div>
                    ⏱️ Thời gian làm bài:{" "}
                    {Math.round(reviewData.metadata.timeSpent! / 1000)}s
                  </div>
                  <div>
                    📅 Thời điểm nộp:{" "}
                    {new Date(reviewData.metadata.timestamp).toLocaleString(
                      "vi-VN",
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
