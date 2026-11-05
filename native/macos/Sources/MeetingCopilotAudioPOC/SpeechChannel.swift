import AVFoundation
import Foundation
import MeetingCopilotAudio
import Speech

@MainActor
protocol TrialChannel: AnyObject {
  func prepare() async throws
  func start() async throws
  func suppressResults()
  func stop() async throws
}

@available(macOS 26.0, *)
@MainActor
final class SpeechChannel: TrialChannel {
  private let source: AudioSource
  private let options: TrialOptions
  private let segment: Int
  private let output: TrialOutput
  private let failure: @Sendable (TrialFailure) -> Void
  private var analyzer: SpeechAnalyzer?
  private var ingress: AudioIngress?
  private var capture: (any AudioCapture)?
  private var resultsTask: Task<Void, Never>?
  private var acceptingResults = false
  private var closing = false

  init(
    source: AudioSource, options: TrialOptions, segment: Int, output: TrialOutput,
    failure: @escaping @Sendable (TrialFailure) -> Void
  ) {
    self.source = source
    self.options = options
    self.segment = segment
    self.output = output
    self.failure = failure
  }

  func prepare() async throws {
    let module = try await SpeechAssets.transcriber(locale: options.locale)
    guard await AssetInventory.status(forModules: [module]) == .installed else {
      throw TrialFailure.assetsRequired
    }
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module])
    else {
      throw TrialFailure.audioFormat
    }
    let analyzer = SpeechAnalyzer(modules: [module])
    self.analyzer = analyzer
    try await analyzer.prepareToAnalyze(in: format)
    let failure = self.failure
    let ingress = AudioIngress(format: format, failure: { failure(TrialFailure.audio($0)) })
    self.ingress = ingress
    switch source {
    case .mic: capture = MicrophoneCapture(ingress: ingress)
    case .system:
      capture = SystemCapture(ingress: ingress, failure: { failure(TrialFailure.audio($0)) })
    }
    resultsTask = Task { [weak self] in
      do {
        for try await result in module.results {
          guard let self, self.acceptingResults, !Task.isCancelled else { continue }
          self.output.emit(
            TrialRecord(
              event: "transcription", source: self.source, locale: self.options.locale,
              segment: self.segment, isFinal: result.isFinal,
              start: result.range.start.seconds, end: CMTimeRangeGetEnd(result.range).seconds,
              recognizedText: String(result.text.characters), showText: self.options.showText
            ))
        }
      } catch {
        guard let self, !self.closing, !Task.isCancelled else { return }
        self.failure(.recognition)
      }
    }
    try await analyzer.start(inputSequence: ingress.inputs)
  }

  func start() async throws {
    guard let capture else { throw TrialFailure.capture }
    try await capture.start()
    acceptingResults = true
  }

  func suppressResults() {
    acceptingResults = false
    closing = true
  }

  func stop() async throws {
    suppressResults()
    ingress?.finish()
    var stopError: (any Error)?
    do { try await capture?.stop() } catch { stopError = error }
    resultsTask?.cancel()
    await analyzer?.cancelAndFinishNow()
    await resultsTask?.value
    if let ingress {
      let stats = ingress.statistics()
      output.status(
        "AUDIO_SUMMARY_\(source.rawValue)_segment=\(segment)_buffers=\(stats.buffers)_seconds=\(Int(stats.seconds))"
      )
    }
    capture = nil
    ingress = nil
    resultsTask = nil
    analyzer = nil
    if let stopError { throw stopError }
  }
}
