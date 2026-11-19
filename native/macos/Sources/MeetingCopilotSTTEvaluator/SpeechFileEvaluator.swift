import AVFoundation
import CoreMedia
import Foundation
import Speech

@available(macOS 26.0, *)
enum SpeechFileEvaluator {
  private struct Result: Sendable {
    let text: String
    let start: Double
    let isFinal: Bool
    let receivedMs: Int
  }

  static func evaluate(_ options: EvaluationOptions) async throws -> EvaluationReport {
    guard let mediaPath = options.mediaPath, let referencePath = options.referencePath else {
      throw EvaluationFailure.invalidArguments
    }
    let reference: String
    do { reference = try String(contentsOfFile: referencePath, encoding: .utf8) } catch {
      throw EvaluationFailure.referenceUnreadable
    }
    let prepared = try await PreparedAudioFile.open(URL(fileURLWithPath: mediaPath))
    defer { prepared.cleanup() }
    let audioFile = prepared.file
    guard SpeechTranscriber.isAvailable else { throw EvaluationFailure.unavailable }
    guard
      let locale = await SpeechTranscriber.supportedLocale(
        equivalentTo: Locale(identifier: options.locale))
    else { throw EvaluationFailure.unsupportedLocale }
    do {
      _ = try await AssetInventory.reserve(locale: Locale(identifier: options.locale))
    } catch {
      throw EvaluationFailure.assetsUnavailable
    }
    let installed = await SpeechTranscriber.installedLocales
    guard installed.contains(where: { $0.identifier == locale.identifier }) else {
      throw EvaluationFailure.assetsUnavailable
    }
    let transcriber = SpeechTranscriber(locale: locale, preset: options.preset.speechPreset)
    guard await AssetInventory.status(forModules: [transcriber]) == .installed else {
      throw EvaluationFailure.assetsUnavailable
    }

    let clock = ContinuousClock()
    let started = clock.now
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    let resultsTask = Task<[Result], any Error> {
      var results: [Result] = []
      for try await value in transcriber.results {
        results.append(
          Result(
            text: String(value.text.characters), start: value.range.start.seconds,
            isFinal: value.isFinal,
            receivedMs: milliseconds(started.duration(to: clock.now))))
      }
      return results
    }

    do {
      let end = try await analyzer.analyzeSequence(from: audioFile)
      if let end {
        try await analyzer.finalizeAndFinish(through: end)
      } else {
        try await analyzer.finalizeAndFinishThroughEndOfInput()
      }
      let results = try await resultsTask.value
      let finals = results.filter(\.isFinal).sorted { $0.start < $1.start }
      let hypothesis = finals.map(\.text).joined(separator: " ")
      let format = audioFile.processingFormat
      let duration = format.sampleRate > 0 ? Double(audioFile.length) / format.sampleRate : 0
      return EvaluationReport(
        version: 1, mediaName: prepared.originalURL.lastPathComponent,
        mediaContainer: prepared.originalURL.pathExtension.lowercased(),
        extractedAudio: prepared.extractedAudio,
        locale: options.locale, preset: options.preset,
        sampleRate: format.sampleRate, channels: Int(format.channelCount),
        mediaDurationMs: Int((duration * 1000).rounded()),
        processingMs: milliseconds(started.duration(to: clock.now)),
        firstResultMs: results.map(\.receivedMs).min(),
        lastFinalMs: finals.map(\.receivedMs).max(),
        partialResults: results.filter { !$0.isFinal }.count, finalResults: finals.count,
        metric: .evaluate(reference: reference, hypothesis: hypothesis),
        reference:
          options.showText ? reference.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
        hypothesis: options.showText ? hypothesis : nil)
    } catch {
      resultsTask.cancel()
      await analyzer.cancelAndFinishNow()
      _ = try? await resultsTask.value
      throw (error as? EvaluationFailure) ?? EvaluationFailure.transcriptionFailed
    }
  }

  private static func milliseconds(_ duration: Duration) -> Int {
    let components = duration.components
    return Int(components.seconds * 1_000 + components.attoseconds / 1_000_000_000_000_000)
  }
}
