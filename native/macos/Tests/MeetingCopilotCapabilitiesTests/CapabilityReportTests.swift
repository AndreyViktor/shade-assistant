import Foundation
import Testing

@testable import MeetingCopilotCapabilities

@Test func compatibilityTakesPrecedenceOverInstalledAssets() {
  #expect(
    localAvailability(
      apiAvailable: false, deviceAvailable: true, localeResolved: true,
      installed: true, assets: .installed, analyzer: .preparedAndCancelled
    ) == .requiresMacOS26)
  #expect(
    localAvailability(
      apiAvailable: true, deviceAvailable: false, localeResolved: true,
      installed: true, assets: .installed, analyzer: .preparedAndCancelled
    ) == .deviceUnavailable)
  #expect(
    localAvailability(
      apiAvailable: true, deviceAvailable: true, localeResolved: false,
      installed: true, assets: .installed, analyzer: .preparedAndCancelled
    ) == .unsupportedLocale)
}

@Test(arguments: AssetStatus.allCases)
func onlyInstalledAssetsPermitTrial(_ assets: AssetStatus) {
  let expected: LocalAvailability
  switch assets {
  case .notChecked, .unknown: expected = .assetStatusUnknown
  case .unsupported: expected = .unsupportedLocale
  case .supported: expected = .assetsRequired
  case .downloading: expected = .assetsDownloading
  case .installed: expected = .eligibleForCaptureTrial
  }
  #expect(
    localAvailability(
      apiAvailable: true, deviceAvailable: true, localeResolved: true,
      installed: true, assets: assets, analyzer: .preparedAndCancelled
    ) == expected)
}

@Test(arguments: AnalyzerStatus.allCases)
func analyzerMustPrepareSuccessfully(_ analyzer: AnalyzerStatus) {
  #expect(
    localAvailability(
      apiAvailable: true, deviceAvailable: true, localeResolved: true,
      installed: true, assets: .installed, analyzer: analyzer
    ) == (analyzer == .preparedAndCancelled ? .eligibleForCaptureTrial : .analyzerUnavailable))
}

@Test func inconsistentInventoryIsNotReady() {
  #expect(
    localAvailability(
      apiAvailable: true, deviceAvailable: true, localeResolved: true,
      installed: false, assets: .installed, analyzer: .preparedAndCancelled
    ) == .assetsRequired)
}

@Test func localeSeparatorsAreNormalizedWithoutCollapsingRegions() {
  #expect(localeIdentifier(Locale(identifier: "pt_BR")) == "pt-BR")
  #expect(localeIdentifier(Locale(identifier: "en-US")) == "en-US")
  #expect(localeIdentifier(Locale(identifier: "pt_PT")) != "pt-BR")
}

@Test func diagnosticSerializesPermissionAndFallbackWithoutClaimingCapture() throws {
  let report = CapabilityReport(
    observedAt: "2026-11-03T00:00:00Z", operatingSystem: "test", architecture: "test",
    permissions: PermissionSnapshot(microphone: "denied", screenCapturePreflight: false)
  )
  let encoded = try JSONEncoder().encode(report)
  let decoded = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
  let permissions = try #require(decoded["permissions"] as? [String: Any])
  #expect(decoded["reportVersion"] as? Int == 1)
  #expect(decoded["scope"] as? String == "capability-spike-no-capture")
  #expect(permissions["microphone"] as? String == "denied")
  #expect(permissions["screenCapturePreflight"] as? Bool == false)
  #expect(decoded["speechAPIAvailable"] as? Bool == false)
  #expect(decoded["bilingualValidated"] as? Bool == false)
  let fallback = try #require(decoded["fallback"] as? String)
  #expect(fallback.contains("DEMO"))
  #expect(fallback.contains("consent"))
}
