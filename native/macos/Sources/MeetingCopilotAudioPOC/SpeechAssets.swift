import AVFoundation
import Foundation
import Speech

@available(macOS 26.0, *)
enum SpeechAssets {
  static func transcriber(locale identifier: String) async throws -> SpeechTranscriber {
    guard SpeechTranscriber.isAvailable else { throw TrialFailure.unavailable }
    guard
      let locale = await SpeechTranscriber.supportedLocale(
        equivalentTo: Locale(identifier: identifier))
    else {
      throw TrialFailure.unsupportedLocale
    }
    return SpeechTranscriber(locale: locale, preset: .timeIndexedProgressiveTranscription)
  }

  @MainActor
  static func prepare(locale identifier: String, output: TrialOutput) async throws {
    let module = try await transcriber(locale: identifier)
    let locale = Locale(identifier: identifier)
    let before = await AssetInventory.status(forModules: [module])
    output.status("ASSETS_BEFORE_\(label(before))")
    // Reservation is scoped to this app and retained for subsequent manual trials.
    // Never release another app's locale or evict models to make room.
    try await AssetInventory.reserve(locale: locale)
    if let request = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
      output.status("ASSETS_INSTALLING_APPLE_DOWNLOAD_MAY_BE_REQUIRED")
      try await request.downloadAndInstall()
    }
    let after = await AssetInventory.status(forModules: [module])
    output.status("ASSETS_AFTER_\(label(after))")
    guard after == .installed else { throw TrialFailure.assetsRequired }
    let analyzer = SpeechAnalyzer(modules: [module])
    do {
      guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module])
      else {
        throw TrialFailure.audioFormat
      }
      try await analyzer.prepareToAnalyze(in: format)
      await analyzer.cancelAndFinishNow()
      output.status("ASSETS_PREPARED_NO_CAPTURE_\(identifier)")
    } catch {
      await analyzer.cancelAndFinishNow()
      throw TrialFailure.assetPreparation
    }
  }

  static func label(_ status: AssetInventory.Status) -> String {
    switch status {
    case .unsupported: return "unsupported"
    case .supported: return "supported"
    case .downloading: return "downloading"
    case .installed: return "installed"
    @unknown default: return "unknown"
    }
  }
}
