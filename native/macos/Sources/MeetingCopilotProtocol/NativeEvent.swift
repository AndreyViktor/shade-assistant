import Foundation

public enum NativeErrorCode: String, Codable, Sendable, CaseIterable {
  case permissionDenied = "permission-denied"
  case unavailable
  case unsupportedLocale = "unsupported-locale"
  case assetsUnavailable = "assets-unavailable"
  case captureFailed = "capture-failed"
  case transcriptionFailed = "transcription-failed"
  case invalidCommand = "invalid-command"
  case `internal`
}
public enum CaptureState: String, Codable, Sendable { case listening, paused }
public enum StopReason: String, Codable, Sendable { case completed, cancelled, error }

public struct NativeEvent: Encodable, Sendable {
  public enum Payload: Sendable {
    case ready(supportsPartial: Bool)
    case partial(segmentId: String, startMs: Int64, endMs: Int64, text: String)
    case final(segmentId: String, startMs: Int64, endMs: Int64, text: String)
    case status(CaptureState)
    case error(NativeErrorCode)
    case stopped(StopReason)
  }
  public let sessionId: String
  public let source: AudioSource
  public let locale: TranscriptionLocale
  public let seq: Int64
  public let timestampMs: Int64
  public let payload: Payload

  public init(
    sessionId: String, source: AudioSource, locale: TranscriptionLocale, seq: Int64,
    timestampMs: Int64, payload: Payload
  ) {
    self.sessionId = sessionId
    self.source = source
    self.locale = locale
    self.seq = seq
    self.timestampMs = timestampMs
    self.payload = payload
  }

  public func encode(to encoder: any Encoder) throws {
    guard ProtocolLimits.validID(sessionId), ProtocolLimits.validTime(seq), seq > 0,
      ProtocolLimits.validTime(timestampMs)
    else { throw NativeProtocolFailure.invalidMessage }
    var values = encoder.container(keyedBy: WireKey.self)
    try values.encode(ProtocolLimits.version, forKey: WireKey("version"))
    try values.encode(sessionId, forKey: WireKey("sessionId"))
    try values.encode(source, forKey: WireKey("source"))
    try values.encode(locale, forKey: WireKey("locale"))
    try values.encode(seq, forKey: WireKey("seq"))
    try values.encode(timestampMs, forKey: WireKey("timestampMs"))
    switch payload {
    case .ready(let supportsPartial):
      try values.encode("ready", forKey: WireKey("type"))
      try values.encode(supportsPartial, forKey: WireKey("supportsPartial"))
    case .partial(let segmentId, let startMs, let endMs, let text),
      .final(let segmentId, let startMs, let endMs, let text):
      guard ProtocolLimits.validID(segmentId), ProtocolLimits.validTime(startMs),
        ProtocolLimits.validTime(endMs), startMs <= endMs, endMs <= timestampMs,
        ProtocolLimits.validText(text)
      else { throw NativeProtocolFailure.invalidMessage }
      let type: String
      if case .partial = payload { type = "partial" } else { type = "final" }
      try values.encode(type, forKey: WireKey("type"))
      try values.encode(segmentId, forKey: WireKey("segmentId"))
      try values.encode(startMs, forKey: WireKey("startMs"))
      try values.encode(endMs, forKey: WireKey("endMs"))
      try values.encode(text, forKey: WireKey("text"))
    case .status(let state):
      try values.encode("status", forKey: WireKey("type"))
      try values.encode(state, forKey: WireKey("state"))
    case .error(let code):
      try values.encode("error", forKey: WireKey("type"))
      try values.encode(code, forKey: WireKey("code"))
    case .stopped(let reason):
      try values.encode("stopped", forKey: WireKey("type"))
      try values.encode(reason, forKey: WireKey("reason"))
    }
  }

  /// stdout frame; never print diagnostics or raw Foundation encoding errors there.
  public func encodeLine() throws -> Data {
    let data: Data
    do { data = try JSONEncoder().encode(self) } catch {
      throw NativeProtocolFailure.invalidMessage
    }
    guard data.count <= ProtocolLimits.maxLineBytes else {
      throw NativeProtocolFailure.lineTooLarge
    }
    return data + Data([10])
  }
}
