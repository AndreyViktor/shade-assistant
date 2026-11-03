import Foundation

enum AssetStatus: String, Encodable, CaseIterable {
  case notChecked, unsupported, supported, downloading, installed, unknown
}

enum AnalyzerStatus: String, Encodable, CaseIterable {
  case notChecked, preparedAndCancelled, noCompatibleFormat, preparationFailed
}

enum LocalAvailability: String, Encodable {
  case requiresMacOS26, deviceUnavailable, unsupportedLocale, assetsRequired
  case assetsDownloading, assetStatusUnknown, analyzerUnavailable, eligibleForCaptureTrial
}

struct LocaleCapability: Encodable {
  let requested: String
  var resolved: String?
  var installed = false
  var assets: AssetStatus = .notChecked
  var analyzer: AnalyzerStatus = .notChecked
  var analyzerConstructedAndCancelled = false
  var sampleRate: Double?
  var channelCount: UInt32?
  var availability: LocalAvailability
}

struct PermissionSnapshot: Encodable {
  let microphone: String
  // This preflight is not proof of permission for a future audio-only SCStream.
  let screenCapturePreflight: Bool
}

struct CapabilityReport: Encodable {
  let reportVersion = 1
  let scope = "capability-spike-no-capture"
  let observedAt: String
  let operatingSystem: String
  let architecture: String
  let permissions: PermissionSnapshot
  var speechAPIAvailable = false
  var transcriberAvailable = false
  var supportedLocales: [String] = []
  var installedLocales: [String] = []
  var locales: [LocaleCapability] = []
  let fallback = "Remain in DEMO; remote STT requires separate consent and budget."
  let bilingualValidated = false
}

func localeIdentifier(_ locale: Locale) -> String {
  locale.identifier.replacingOccurrences(of: "_", with: "-")
}

func localAvailability(
  apiAvailable: Bool,
  deviceAvailable: Bool,
  localeResolved: Bool,
  installed: Bool,
  assets: AssetStatus,
  analyzer: AnalyzerStatus
) -> LocalAvailability {
  guard apiAvailable else { return .requiresMacOS26 }
  guard deviceAvailable else { return .deviceUnavailable }
  guard localeResolved else { return .unsupportedLocale }
  switch assets {
  case .unsupported: return .unsupportedLocale
  case .supported: return .assetsRequired
  case .downloading: return .assetsDownloading
  case .unknown, .notChecked: return .assetStatusUnknown
  case .installed:
    guard installed else { return .assetsRequired }
    return analyzer == .preparedAndCancelled ? .eligibleForCaptureTrial : .analyzerUnavailable
  }
}
