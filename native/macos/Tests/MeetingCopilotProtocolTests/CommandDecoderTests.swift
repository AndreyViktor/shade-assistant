import Foundation
import Testing

@testable import MeetingCopilotProtocol

private func commandStream(_ ending: [UInt8] = [10]) throws -> Data {
  var data = Data()
  for value in try fixture("commands") {
    data.append(try jsonData(value))
    data.append(contentsOf: ending)
  }
  return data
}

@Test func commandStreamHandlesEverySplitAndCRLF() throws {
  let stream = try commandStream([13, 10])
  for split in 0...stream.count {
    var decoder = NativeCommandDecoder()
    let first = try decoder.push(Data(stream.prefix(split)))
    let second = try decoder.push(Data(stream.dropFirst(split)))
    #expect(
      (first + second).map(\.action) == [
        .start(sources: [.mic, .system], locale: .portuguese), .pause, .resume, .stop,
      ])
    try decoder.finish()
  }
  var decoder = NativeCommandDecoder()
  var commands: [NativeCommand] = []
  for byte in stream { commands += try decoder.push(Data([byte])) }
  #expect(commands.count == 4)
  try decoder.finish()
  #expect(throws: NativeProtocolFailure.closedStream) { try decoder.push(Data()) }
  #expect(throws: NativeProtocolFailure.closedStream) { try decoder.finish() }
}

@Test func commandStreamBoundsBytesAndDiscardsFailedBatch() throws {
  let command = try jsonData(#require(try fixture("commands").first))
  var padded = command
  padded.append(Data(repeating: 32, count: ProtocolLimits.maxLineBytes - command.count))
  var exact = NativeCommandDecoder()
  #expect(try exact.push(padded).isEmpty)
  #expect(try exact.push(Data([10])).count == 1)
  try exact.finish()

  var overflow = NativeCommandDecoder()
  _ = try overflow.push(padded)
  #expect(throws: NativeProtocolFailure.lineTooLarge) { try overflow.push(Data([32])) }
  #expect(throws: NativeProtocolFailure.closedStream) { try overflow.push(Data([10])) }
  var unicode = NativeCommandDecoder()
  #expect(throws: NativeProtocolFailure.lineTooLarge) {
    try unicode.push(Data(String(repeating: "é", count: ProtocolLimits.maxLineBytes / 2 + 1).utf8))
  }
  var batch = NativeCommandDecoder()
  #expect(throws: NativeProtocolFailure.self) {
    try batch.push(commandStream() + Data("{\"synthetic-secret\":\n".utf8))
  }
  #expect(throws: NativeProtocolFailure.closedStream) { try batch.finish() }
}

@Test func commandStreamRejectsTruncationAndClearsAtEOF() throws {
  let command = try jsonData(#require(try fixture("commands").first))
  for incomplete in [command, Data("{".utf8), Data([13]), Data([0xF0, 0x9F])] {
    var decoder = NativeCommandDecoder()
    _ = try decoder.push(incomplete)
    #expect(throws: NativeProtocolFailure.truncatedLine) { try decoder.finish() }
    #expect(throws: NativeProtocolFailure.closedStream) { try decoder.push(Data([10])) }
  }
  var empty = NativeCommandDecoder()
  try empty.finish()
  for invalid in [Data([10]), Data("diagnostic log\n".utf8), Data("null\n".utf8)] {
    var decoder = NativeCommandDecoder()
    #expect(throws: NativeProtocolFailure.self) { try decoder.push(invalid) }
  }
}

@Test func commandFramingAgreesWithTypeScriptFixtures() throws {
  let command = try jsonData(#require(try fixture("commands").first))
  for value in try fixture("framing") {
    let entry = try #require(value as? [String: Any])
    let prefix = try #require(entry["prefix"] as? [UInt8])
    let suffix = try #require(entry["suffix"] as? [UInt8])
    let valid = try #require(entry["valid"] as? Bool)
    let frame = Data(prefix) + command + Data(suffix) + Data([10])
    var decoder = NativeCommandDecoder()
    if valid {
      #expect(try decoder.push(frame).count == 1)
      try decoder.finish()
    } else {
      #expect(throws: NativeProtocolFailure.self) { try decoder.push(frame) }
      #expect(throws: NativeProtocolFailure.closedStream) { try decoder.finish() }
    }
  }
}

@Test func textValidationAgreesWithTypeScriptFixtures() throws {
  for value in try fixture("text") {
    let entry = try #require(value as? [String: Any])
    let text = try #require(entry["text"] as? String)
    let valid = try #require(entry["valid"] as? Bool)
    let event = NativeEvent(
      sessionId: "fixture-session", source: .mic, locale: .portuguese, seq: 3, timestampMs: 100,
      payload: .final(segmentId: "m1", startMs: 10, endMs: 90, text: text))
    if valid {
      let decoded = try #require(
        JSONSerialization.jsonObject(with: event.encodeLine()) as? [String: Any])
      #expect(decoded["text"] as? String == text)
    } else {
      #expect(throws: NativeProtocolFailure.invalidMessage) { try event.encodeLine() }
    }
  }
}
