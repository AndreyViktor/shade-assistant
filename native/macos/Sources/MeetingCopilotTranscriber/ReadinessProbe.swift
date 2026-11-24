import AVFoundation
import CoreGraphics
import Foundation
import Security
import Speech

enum ReadinessState: String, Encodable {
  case notRequested = "not-requested"
  case allowed, denied, restricted, unavailable
}

struct ReadinessItem: Encodable {
  let state: ReadinessState
  let detail: String
}

struct ReadinessOwner: Encodable {
  let capture = "MeetingCopilotTranscriber"
  let host = "Meeting Copilot"
}

struct ReadinessIdentity: Encodable {
  let process = "MeetingCopilotTranscriber"
  let bundleIdentifier: String
  let signingIdentifier: String
  let signature: String
}

struct ReadinessReport: Encodable {
  let reportVersion = 1
  let scope = "session-preflight-no-capture"
  let owner = ReadinessOwner()
  let microphone: ReadinessItem
  let systemAudio: ReadinessItem
  let speechRecognition: ReadinessItem
  let helper: ReadinessItem
  let helperIdentity: ReadinessIdentity?
}

func probeReadiness() -> ReadinessReport {
  let signature = probeOwnSignature()
  return ReadinessReport(
    microphone: permissionItem(AVCaptureDevice.authorizationStatus(for: .audio)),
    systemAudio: screenCaptureItem(),
    speechRecognition: speechPermissionItem(SFSpeechRecognizer.authorizationStatus()),
    helper: signature.item,
    helperIdentity: signature.identity
  )
}

private func permissionItem(_ status: AVAuthorizationStatus) -> ReadinessItem {
  switch status {
  case .notDetermined: return ReadinessItem(state: .notRequested, detail: "exact")
  case .authorized: return ReadinessItem(state: .allowed, detail: "exact")
  case .denied: return ReadinessItem(state: .denied, detail: "exact")
  case .restricted: return ReadinessItem(state: .restricted, detail: "exact")
  @unknown default: return ReadinessItem(state: .unavailable, detail: "exact")
  }
}

private func speechPermissionItem(
  _ status: SFSpeechRecognizerAuthorizationStatus
) -> ReadinessItem {
  switch status {
  case .notDetermined: return ReadinessItem(state: .notRequested, detail: "exact")
  case .authorized: return ReadinessItem(state: .allowed, detail: "exact")
  case .denied: return ReadinessItem(state: .denied, detail: "exact")
  case .restricted: return ReadinessItem(state: .restricted, detail: "exact")
  @unknown default: return ReadinessItem(state: .unavailable, detail: "exact")
  }
}

private func screenCaptureItem() -> ReadinessItem {
  if CGPreflightScreenCaptureAccess() {
    return ReadinessItem(state: .allowed, detail: "exact")
  }
  // The public preflight API intentionally does not distinguish first use from denial.
  return ReadinessItem(state: .denied, detail: "screen-preflight-ambiguous")
}

private func probeOwnSignature() -> (item: ReadinessItem, identity: ReadinessIdentity?) {
  var ownCode: SecCode?
  guard SecCodeCopySelf(SecCSFlags(), &ownCode) == errSecSuccess, let ownCode else {
    return (ReadinessItem(state: .unavailable, detail: "exact"), nil)
  }
  var staticCode: SecStaticCode?
  guard
    SecCodeCopyStaticCode(ownCode, SecCSFlags(), &staticCode) == errSecSuccess,
    let staticCode,
    SecCodeCheckValidity(ownCode, SecCSFlags(), nil) == errSecSuccess
  else {
    return (ReadinessItem(state: .denied, detail: "exact"), nil)
  }
  var rawInformation: CFDictionary?
  guard
    SecCodeCopySigningInformation(
      staticCode, SecCSFlags(rawValue: kSecCSSigningInformation), &rawInformation) == errSecSuccess,
    let information = rawInformation as? [String: Any],
    let signingIdentifier = information[kSecCodeInfoIdentifier as String] as? String
  else {
    return (ReadinessItem(state: .unavailable, detail: "exact"), nil)
  }
  let teamIdentifier = information[kSecCodeInfoTeamIdentifier as String] as? String
  let bundleIdentifier = Bundle.main.bundleIdentifier ?? signingIdentifier
  return (
    ReadinessItem(state: .allowed, detail: "exact"),
    ReadinessIdentity(
      bundleIdentifier: bundleIdentifier,
      signingIdentifier: signingIdentifier,
      signature: teamIdentifier == nil ? "no-team" : "team-signed"
    )
  )
}
