import AVFoundation
import CoreGraphics
import Foundation
import MeetingCopilotAudio
import MeetingCopilotProtocol
import Speech

struct HelperFailure: Error {
  let code: NativeErrorCode
  init(_ code: NativeErrorCode) { self.code = code }

  static func code(for error: any Error) -> NativeErrorCode {
    if let failure = error as? HelperFailure { return failure.code }
    if let failure = error as? AudioFailure {
      switch failure {
      case .microphoneDenied, .systemDenied: return .permissionDenied
      case .audioFormat, .audioOverflow, .capture: return .captureFailed
      }
    }
    return .transcriptionFailed
  }
}

struct SpeechResult: Sendable {
  let text: String
  let start: Double
  let end: Double
  let isFinal: Bool
}

@MainActor
protocol TranscriptionChannel: AnyObject {
  func prepare() async throws
  func start() async throws
  func suppressResults()
  func stop() async throws
}

enum CapturePermissions {
  static func request(_ sources: [AudioSource]) async throws {
    if sources.contains(.mic) {
      switch AVCaptureDevice.authorizationStatus(for: .audio) {
      case .authorized: break
      case .notDetermined:
        guard await AVCaptureDevice.requestAccess(for: .audio) else {
          throw HelperFailure(.permissionDenied)
        }
      default: throw HelperFailure(.permissionDenied)
      }
    }
    if sources.contains(.system), !CGPreflightScreenCaptureAccess() {
      // This opens the macOS privacy flow. System audio capture cannot begin
      // until the user grants Screen & System Audio Recording in System Settings.
      guard CGRequestScreenCaptureAccess(), CGPreflightScreenCaptureAccess() else {
        throw HelperFailure(.permissionDenied)
      }
    }
  }
}

@available(macOS 26.0, *)
@MainActor
final class AppleTranscriptionChannel: TranscriptionChannel {
  private let source: AudioSource
  private let locale: TranscriptionLocale
  private let result: (SpeechResult) -> Void
  private let failures: ChannelFailureRelay
  private var analyzer: SpeechAnalyzer?
  private var ingress: AudioIngress?
  private var capture: (any AudioCapture)?
  private var resultsTask: Task<Void, Never>?
  private var accepting = false
  private var closing = false

  init(
    source: AudioSource, locale: TranscriptionLocale,
    result: @escaping (SpeechResult) -> Void,
    failure: @escaping @Sendable (NativeErrorCode) -> Void
  ) {
    self.source = source
    self.locale = locale
    self.result = result
    self.failures = ChannelFailureRelay(failure)
  }

  func prepare() async throws {
    guard SpeechTranscriber.isAvailable else { throw HelperFailure(.unavailable) }
    guard
      let supported = await SpeechTranscriber.supportedLocale(
        equivalentTo: Locale(identifier: locale.rawValue))
    else { throw HelperFailure(.unsupportedLocale) }
    do {
      // Reservations are per app even though installed model assets are shared.
      // Reserve only; downloads remain an explicit setup action outside capture.
      _ = try await AssetInventory.reserve(locale: Locale(identifier: locale.rawValue))
    } catch {
      throw HelperFailure(.assetsUnavailable)
    }
    let installed = await SpeechTranscriber.installedLocales
    guard installed.contains(where: { $0.identifier == supported.identifier }) else {
      throw HelperFailure(.assetsUnavailable)
    }
    let module = SpeechTranscriber(locale: supported, preset: .timeIndexedProgressiveTranscription)
    guard await AssetInventory.status(forModules: [module]) == .installed else {
      throw HelperFailure(.assetsUnavailable)
    }
    guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module])
    else {
      throw HelperFailure(.unavailable)
    }
    let analyzer = SpeechAnalyzer(modules: [module])
    self.analyzer = analyzer
    try await analyzer.prepareToAnalyze(in: format)
    let failures = self.failures
    let ingress = AudioIngress(format: format) { failures.report(HelperFailure.code(for: $0)) }
    self.ingress = ingress
    switch source {
    case .mic: capture = MicrophoneCapture(ingress: ingress)
    case .system:
      capture = SystemCapture(ingress: ingress) { failures.report(HelperFailure.code(for: $0)) }
    }
    resultsTask = Task { [weak self] in
      do {
        for try await value in module.results {
          guard let self, self.accepting, !Task.isCancelled else { continue }
          self.result(
            SpeechResult(
              text: String(value.text.characters), start: value.range.start.seconds,
              end: CMTimeRangeGetEnd(value.range).seconds, isFinal: value.isFinal))
        }
      } catch {
        guard let self, !self.closing, !Task.isCancelled else { return }
        failures.report(.transcriptionFailed)
      }
    }
    try await analyzer.start(inputSequence: ingress.inputs)
  }

  func start() async throws {
    try await CapturePermissions.request([source])
    guard let capture else { throw HelperFailure(.captureFailed) }
    do { try await capture.start() } catch { throw HelperFailure(HelperFailure.code(for: error)) }
    accepting = true
  }

  func suppressResults() {
    accepting = false
    closing = true
    failures.close()
  }

  func stop() async throws {
    suppressResults()
    ingress?.finish()
    var stopFailure: (any Error)?
    do { try await capture?.stop() } catch { stopFailure = error }
    resultsTask?.cancel()
    await analyzer?.cancelAndFinishNow()
    await resultsTask?.value
    capture = nil
    ingress = nil
    analyzer = nil
    resultsTask = nil
    if stopFailure != nil { throw HelperFailure(.captureFailed) }
  }
}
