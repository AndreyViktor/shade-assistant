import Foundation
import Testing

@testable import MeetingCopilotTranscriber

@Test func readinessContractSerializesEveryPermissionState() throws {
  let states: [ReadinessState] = [.notRequested, .allowed, .denied, .restricted, .unavailable]
  let encoded = try JSONEncoder().encode(states)
  let decoded = try #require(JSONSerialization.jsonObject(with: encoded) as? [String])
  #expect(decoded == ["not-requested", "allowed", "denied", "restricted", "unavailable"])
}

@Test func readinessReportDeclaresNoCaptureScopeAndStableOwners() throws {
  let report = ReadinessReport(
    microphone: ReadinessItem(state: .notRequested, detail: "exact"),
    systemAudio: ReadinessItem(state: .denied, detail: "screen-preflight-ambiguous"),
    speechRecognition: ReadinessItem(state: .restricted, detail: "exact"),
    helper: ReadinessItem(state: .allowed, detail: "exact"),
    helperIdentity: ReadinessIdentity(
      bundleIdentifier: "local.meetingcopilot.transcriber",
      signingIdentifier: "local.meetingcopilot.transcriber",
      signature: "adhoc"
    )
  )
  let encoded = try JSONEncoder().encode(report)
  let decoded = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
  let owner = try #require(decoded["owner"] as? [String: String])
  #expect(decoded["reportVersion"] as? Int == 1)
  #expect(decoded["scope"] as? String == "session-preflight-no-capture")
  #expect(owner["capture"] == "MeetingCopilotTranscriber")
  #expect(owner["host"] == "Meeting Copilot")
  #expect(decoded["audio"] == nil)
  #expect(decoded["transcript"] == nil)
}
