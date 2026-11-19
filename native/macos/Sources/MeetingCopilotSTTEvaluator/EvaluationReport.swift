import Foundation

struct EvaluationReport: Codable, Equatable {
  let version: Int
  let mediaName: String
  let mediaContainer: String
  let extractedAudio: Bool
  let locale: String
  let preset: EvaluationPreset
  let sampleRate: Double
  let channels: Int
  let mediaDurationMs: Int
  let processingMs: Int
  let firstResultMs: Int?
  let lastFinalMs: Int?
  let partialResults: Int
  let finalResults: Int
  let metric: WordErrorMetric
  let reference: String?
  let hypothesis: String?
}
