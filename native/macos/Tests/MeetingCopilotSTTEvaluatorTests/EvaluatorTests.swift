import Foundation
import Testing

@testable import MeetingCopilotSTTEvaluator

@Test func helpIsSafeAndEvaluationIsExplicit() throws {
  #expect(try EvaluationOptions.parse([]).mode == .help)
  #expect(try EvaluationOptions.parse(["--help"]).mode == .help)
  #expect(throws: EvaluationFailure.invalidArguments) {
    try EvaluationOptions.parse(["--media", "sample.aiff", "--reference", "sample.txt"])
  }
}

@Test func argumentsSelectPresetWithoutExposingTextByDefault() throws {
  let options = try EvaluationOptions.parse([
    "--evaluate", "--media", "/tmp/sample.aiff", "--reference", "/tmp/sample.txt",
    "--preset", "quality",
  ])
  #expect(options.mode == .evaluate)
  #expect(options.preset == .quality)
  #expect(options.locale == "pt-BR")
  #expect(!options.showText)
}

@Test(arguments: [
  ["--evaluate"],
  ["--evaluate", "--media", "a", "--reference", "b", "--locale", "en-US"],
  ["--evaluate", "--media", "a", "--reference", "b", "--preset", "fast"],
  ["--evaluate", "--media", "a", "--media", "b", "--reference", "c"],
  ["--evaluate", "--media", "a", "--reference", "b", "--show-text", "--show-text"],
])
func ambiguousArgumentsAreRejected(_ arguments: [String]) {
  #expect(throws: EvaluationFailure.invalidArguments) { try EvaluationOptions.parse(arguments) }
}

@Test func ptBRNormalizationIgnoresCasePunctuationAndWhitespace() {
  #expect(
    WordErrorMetric.normalizedWords("  AÇÃO, técnica!\nSexta-feira. ")
      == ["ação", "técnica", "sexta", "feira"])
}

@Test func wordErrorRateClassifiesEdits() {
  let metric = WordErrorMetric.evaluate(
    reference: "o projeto tem três etapas",
    hypothesis: "o produto tem etapas novas")
  #expect(metric.referenceWords == 5)
  #expect(metric.hypothesisWords == 5)
  #expect(metric.substitutions == 1)
  #expect(metric.deletions == 1)
  #expect(metric.insertions == 1)
  #expect(metric.wordErrorRate == 0.6)

  let deletion = WordErrorMetric.evaluate(reference: "um dois três", hypothesis: "um três")
  #expect(deletion.deletions == 1)
  let insertion = WordErrorMetric.evaluate(reference: "um três", hypothesis: "um dois três")
  #expect(insertion.insertions == 1)
}

@Test func emptyReferencesAreDeterministic() {
  #expect(WordErrorMetric.evaluate(reference: "", hypothesis: "").wordErrorRate == 0)
  #expect(WordErrorMetric.evaluate(reference: "", hypothesis: "fala").wordErrorRate == 1)
}

@Test func reportOmitsTranscriptsWhenRedacted() throws {
  let report = EvaluationReport(
    version: 1, mediaName: "synthetic.aiff", mediaContainer: "aiff", extractedAudio: false,
    locale: "pt-BR", preset: .production,
    sampleRate: 48_000, channels: 1, mediaDurationMs: 1_000, processingMs: 200,
    firstResultMs: 100, lastFinalMs: 180, partialResults: 2, finalResults: 1,
    metric: .evaluate(reference: "frase sintética", hypothesis: "frase sintética"),
    reference: nil, hypothesis: nil)
  let json = String(decoding: try JSONEncoder().encode(report), as: UTF8.self)
  #expect(!json.contains("frase sintética"))
  #expect(json.contains("\"wordErrorRate\":0"))
}
