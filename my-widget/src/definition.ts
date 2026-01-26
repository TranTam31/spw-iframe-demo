import {
  defineWidget,
  param,
  folder,
  type ExtractParams,
  type ExtractAnswer,
} from "@joymath/widget-sdk";

// Widget definition - chỉ define schema
export const widgetDefinition = defineWidget({
  // Parameters - config từ giáo viên
  parameters: {
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
  },

  // Answer schema - structure của câu trả lời
  answer: {
    selected: param.select(["A", "B", "C", "D"]),
  },
} as const);

// Type inference
export type WidgetParams = ExtractParams<typeof widgetDefinition>;
export type WidgetAnswer = ExtractAnswer<typeof widgetDefinition>;
