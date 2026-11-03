import AVFoundation
import CoreGraphics
import Foundation
import Speech

func probeCapabilities() async -> CapabilityReport {
  #if arch(arm64)
    let architecture = "arm64"
  #elseif arch(x86_64)
    let architecture = "x86_64"
  #else
    let architecture = "other"
  #endif
  var report = CapabilityReport(
    observedAt: Date().ISO8601Format(),
    operatingSystem: ProcessInfo.processInfo.operatingSystemVersionString,
    architecture: architecture,
    permissions: PermissionSnapshot(
      microphone: microphonePermission(),
      screenCapturePreflight: CGPreflightScreenCaptureAccess()
    )
  )
  guard #available(macOS 26.0, *) else {
    report.locales = ["pt-BR", "en-US"].map {
      LocaleCapability(requested: $0, availability: .requiresMacOS26)
    }
    return report
  }
  report.speechAPIAvailable = true
  report.transcriberAvailable = SpeechTranscriber.isAvailable
  guard report.transcriberAvailable else {
    report.locales = ["pt-BR", "en-US"].map {
      LocaleCapability(requested: $0, availability: .deviceUnavailable)
    }
    return report
  }
  report.supportedLocales = await SpeechTranscriber.supportedLocales.map(localeIdentifier).sorted()
  report.installedLocales = await SpeechTranscriber.installedLocales.map(localeIdentifier).sorted()
  for requested in ["pt-BR", "en-US"] {
    report.locales.append(
      await probeLocale(requested, installedLocales: report.installedLocales)
    )
  }
  return report
}

private func microphonePermission() -> String {
  switch AVCaptureDevice.authorizationStatus(for: .audio) {
  case .authorized: return "authorized"
  case .denied: return "denied"
  case .restricted: return "restricted"
  case .notDetermined: return "notDetermined"
  @unknown default: return "unknown"
  }
}

@available(macOS 26.0, *)
private func probeLocale(_ requested: String, installedLocales: [String]) async -> LocaleCapability
{
  var result = LocaleCapability(requested: requested, availability: .unsupportedLocale)
  guard
    let locale = await SpeechTranscriber.supportedLocale(
      equivalentTo: Locale(identifier: requested))
  else { return result }
  result.resolved = localeIdentifier(locale)
  result.installed = installedLocales.contains(localeIdentifier(locale))
  let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)
  result.assets = assetStatus(await AssetInventory.status(forModules: [transcriber]))
  let analyzer = SpeechAnalyzer(modules: [transcriber])

  // Never install or reserve assets. Prepare only an already installed model, with no audio input.
  if result.installed && result.assets == .installed {
    if let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) {
      result.sampleRate = format.sampleRate
      result.channelCount = format.channelCount
      do {
        try await analyzer.prepareToAnalyze(in: format)
        result.analyzer = .preparedAndCancelled
      } catch {
        // Framework errors may contain private paths or payloads; emit a stable code only.
        result.analyzer = .preparationFailed
      }
    } else {
      result.analyzer = .noCompatibleFormat
    }
  }
  await analyzer.cancelAndFinishNow()
  result.analyzerConstructedAndCancelled = true
  result.availability = localAvailability(
    apiAvailable: true, deviceAvailable: true, localeResolved: true,
    installed: result.installed, assets: result.assets, analyzer: result.analyzer
  )
  return result
}

@available(macOS 26.0, *)
private func assetStatus(_ status: AssetInventory.Status) -> AssetStatus {
  switch status {
  case .unsupported: return .unsupported
  case .supported: return .supported
  case .downloading: return .downloading
  case .installed: return .installed
  @unknown default: return .unknown
  }
}
