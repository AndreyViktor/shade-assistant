import Foundation
import Testing

@testable import MeetingCopilotProtocol

func fixture(_ name: String) throws -> [Any] {
  let url = try #require(
    Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
  return try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [Any])
}
func jsonData(_ value: Any) throws -> Data {
  try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys])
}
private func event(
  _ source: AudioSource, _ seq: Int64, _ time: Int64, _ payload: NativeEvent.Payload
) -> NativeEvent {
  NativeEvent(
    sessionId: "fixture-session", source: source, locale: .portuguese,
    seq: seq, timestampMs: time, payload: payload)
}

@Test func swiftEncodesExactEventsConsumedByTypeScript() throws {
  let events = [
    event(.mic, 1, 0, .ready(supportsPartial: true)),
    event(.system, 1, 0, .ready(supportsPartial: false)),
    event(.mic, 2, 1, .status(.listening)),
    event(.system, 2, 2, .status(.listening)),
    event(.mic, 3, 100, .partial(segmentId: "m1", startMs: 10, endMs: 90, text: "Olá 👋")),
    event(
      .mic, 4, 110,
      .final(segmentId: "m1", startMs: 15, endMs: 100, text: "Olá 👋\nTeste sintético.")),
    event(
      .system, 3, 105,
      .final(segmentId: "s1", startMs: 20, endMs: 100, text: "Sim, ação sintética.")),
    event(.mic, 5, 120, .status(.paused)),
    event(.mic, 6, 130, .status(.listening)),
    event(.mic, 7, 140, .stopped(.cancelled)),
    event(.system, 4, 150, .error(.captureFailed)),
    event(.system, 5, 151, .stopped(.error)),
  ]
  let expected = try fixture("events")
  #expect(events.count == expected.count)
  for (value, golden) in zip(events, expected) {
    let line = try value.encodeLine()
    #expect(line.last == 10)
    #expect(line.filter { $0 == 10 }.count == 1)
    let actual = try #require(JSONSerialization.jsonObject(with: line) as? NSDictionary)
    #expect(actual.isEqual(to: try #require(golden as? [AnyHashable: Any])))
  }
}

@Test func swiftDecodesExactCommandsEmittedByTypeScript() throws {
  let expected: [NativeCommand.Action] = [
    .start(sources: [.mic, .system], locale: .portuguese), .pause, .resume, .stop,
  ]
  let commands = try fixture("commands")
  #expect(commands.count == expected.count)
  for (value, action) in zip(commands, expected) {
    let decoded = try NativeCommand.decodeLine(jsonData(value))
    #expect(decoded.sessionId == "fixture-session")
    #expect(decoded.action == action)
  }
}

@Test func swiftRejectsSameInvalidCommandsAsTypeScript() throws {
  for value in try fixture("invalid-commands") {
    let data = try jsonData(value)
    #expect(throws: NativeProtocolFailure.self) { try NativeCommand.decodeLine(data) }
  }
}

@Test func commandsRequireEveryKeyAndNeverExposeRawDecoderErrors() throws {
  for value in try fixture("commands") {
    let command = try #require(value as? [String: Any])
    for key in command.keys {
      var incomplete = command
      incomplete.removeValue(forKey: key)
      let data = try jsonData(incomplete)
      #expect(throws: NativeProtocolFailure.self) { try NativeCommand.decodeLine(data) }
    }
  }
  for data in [Data("{\"synthetic-secret\":".utf8), Data([0xff]), Data("null".utf8)] {
    do {
      _ = try NativeCommand.decodeLine(data)
      Issue.record("Expected failure")
    } catch {
      #expect(error is NativeProtocolFailure)
      #expect(!String(describing: error).contains("synthetic-secret"))
    }
  }
}

@Test func commandFrameBoundariesAndVersion() throws {
  let values = try fixture("commands")
  let value = try #require(values.first)
  var data = try jsonData(value)
  data.append(Data(repeating: 32, count: ProtocolLimits.maxLineBytes - data.count))
  _ = try NativeCommand.decodeLine(data)
  data.append(32)
  #expect(throws: NativeProtocolFailure.lineTooLarge) { try NativeCommand.decodeLine(data) }
  let valid = try jsonData(value)
  #expect(throws: NativeProtocolFailure.invalidMessage) {
    try NativeCommand.decodeLine(Data([0xEF, 0xBB, 0xBF]) + valid)
  }
  #expect(throws: NativeProtocolFailure.invalidMessage) {
    try NativeCommand.decodeLine(valid + Data([10]))
  }
  var versioned = try #require(value as? [String: Any])
  versioned["version"] = 2
  let unknownVersion = try jsonData(versioned)
  #expect(throws: NativeProtocolFailure.unsupportedVersion) {
    try NativeCommand.decodeLine(unknownVersion)
  }
}

@Test func invalidEnvelopeNeverEncodes() {
  for value in [
    NativeEvent(
      sessionId: "", source: .mic, locale: .portuguese, seq: 1, timestampMs: 0,
      payload: .ready(supportsPartial: true)),
    NativeEvent(
      sessionId: "bad id", source: .mic, locale: .portuguese, seq: 1, timestampMs: 0,
      payload: .ready(supportsPartial: true)),
    event(.mic, 0, 0, .ready(supportsPartial: true)),
    event(.mic, -1, 0, .ready(supportsPartial: true)),
    event(.mic, ProtocolLimits.maxInteger + 1, 0, .ready(supportsPartial: true)),
    event(.mic, 1, -1, .ready(supportsPartial: true)),
    event(.mic, 1, ProtocolLimits.maxInteger + 1, .ready(supportsPartial: true)),
  ] {
    #expect(throws: NativeProtocolFailure.invalidMessage) { try value.encodeLine() }
  }
}

@Test func invalidTranscriptNeverEncodes() {
  for payload: NativeEvent.Payload in [
    .final(segmentId: "", startMs: 0, endMs: 0, text: "test"),
    .final(segmentId: "s", startMs: -1, endMs: 0, text: "test"),
    .final(segmentId: "s", startMs: 2, endMs: 1, text: "test"),
    .partial(segmentId: "s", startMs: 0, endMs: 11, text: "test"),
    .partial(segmentId: "s", startMs: 0, endMs: 10, text: " \n\t"),
    .final(segmentId: "s", startMs: 0, endMs: 10, text: ""),
    .final(segmentId: "s", startMs: 0, endMs: 10, text: String(repeating: "x", count: 4097)),
    .final(segmentId: "s", startMs: 0, endMs: 10, text: String(repeating: "👋", count: 2049)),
  ] {
    #expect(throws: NativeProtocolFailure.invalidMessage) {
      try event(.mic, 1, 10, payload).encodeLine()
    }
  }
}

@Test func textAndFrameLimitsAreIndependent() throws {
  let boundary = event(
    .mic, 1, ProtocolLimits.maxInteger,
    .final(segmentId: "s", startMs: 0, endMs: 10, text: String(repeating: "👋", count: 2048)))
  _ = try boundary.encodeLine()
  // Control characters are JSON escaped; even a legal text length can exceed the byte limit.
  let oversized = event(
    .mic, 1, 10,
    .final(segmentId: "s", startMs: 0, endMs: 10, text: String(repeating: "\u{0001}", count: 4096)))
  #expect(throws: NativeProtocolFailure.lineTooLarge) { try oversized.encodeLine() }
}

@Test(arguments: NativeErrorCode.allCases)
func errorsOnlyContainAllowlistedCodes(_ code: NativeErrorCode) throws {
  let encoded = try event(.mic, 1, 0, .error(code)).encodeLine()
  let decoded = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
  #expect(decoded["code"] as? String == code.rawValue)
  #expect(decoded["message"] == nil)
}

@Test func englishIsOneLocaleNotABilingualPromise() throws {
  let command = Data(
    "{\"version\":1,\"sessionId\":\"test\",\"type\":\"start\",\"sources\":[\"mic\"],\"locale\":\"en-US\"}"
      .utf8)
  #expect(try NativeCommand.decodeLine(command).action == .start(sources: [.mic], locale: .english))
  let value = NativeEvent(
    sessionId: "test", source: .mic, locale: .english, seq: 1,
    timestampMs: 0, payload: .ready(supportsPartial: false))
  let decoded = try #require(
    JSONSerialization.jsonObject(with: value.encodeLine()) as? [String: Any])
  #expect(decoded["locale"] as? String == "en-US")
}
