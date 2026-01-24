import {
  defineWidget,
  param,
  folder,
  type ExtractParams,
  type WidgetEvaluator,
  type EvaluationResult,
} from "@joymath/widget-sdk";

// Answer type for this widget
export interface MultipleChoiceAnswer {
  selected: "A" | "B" | "C" | "D";
  timeSpent: number;
}

// Evaluator for multiple choice
const multipleChoiceEvaluator: WidgetEvaluator<MultipleChoiceAnswer> = {
  // Validate answer before submission
  validateAnswer: (answer) => {
    if (!answer.selected) {
      return "Vui lòng chọn một đáp án trước khi nộp bài";
    }
    return true;
  },

  // Evaluate the answer
  evaluate: (answer) => {
    // Note: We need access to params here
    // In real implementation, this would be passed or accessed differently
    // For now, we'll handle this in the component

    const evaluation: EvaluationResult = {
      isCorrect: false, // Will be set by component
      score: 0,
      maxScore: 100,
      feedback: "",
    };

    return evaluation;
  },
};

export const widgetDefinition = defineWidget(
  {
    question: param.string("Câu hỏi của bạn là gì?").label("Câu hỏi"),

    answers: folder("Đáp án", {
      a: param.string("Đáp án A").label("A"),
      b: param.string("Đáp án B").label("B"),
      c: param.string("Đáp án C").label("C"),
      d: param.string("Đáp án D").label("D"),

      correct: param.select(["A", "B", "C", "D"], "A").label("Đáp án đúng"),
    }),

    settings: folder("Cài đặt", {
      showFeedback: param.boolean(true).label("Hiển thị giải thích"),
      feedback: param
        .string("Giải thích đáp án...")
        .label("Giải thích")
        .visibleIf({ param: "settings.showFeedback", equals: true }),
    }).expanded(false),
  } as const,
  multipleChoiceEvaluator,
);

export type WidgetParams = ExtractParams<typeof widgetDefinition>;
