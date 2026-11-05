import Foundation

public struct NativeCommand: Decodable, Sendable {
  public enum Action: Sendable, Equatable {
    case start(sources: [AudioSource], locale: TranscriptionLocale)
    case pause, resume, stop
  }
  public let sessionId: String
  public let action: Action

  public init(from decoder: any Decoder) throws {
    let values = try decoder.container(keyedBy: WireKey.self)
    let version = try values.decode(Int.self, forKey: WireKey("version"))
    guard version == ProtocolLimits.version else { throw NativeProtocolFailure.unsupportedVersion }
    let type = try values.decode(String.self, forKey: WireKey("type"))
    let expected = Set(
      ["version", "sessionId", "type"] + (type == "start" ? ["sources", "locale"] : []))
    guard Set(values.allKeys.map(\.stringValue)) == expected else {
      throw NativeProtocolFailure.invalidMessage
    }
    sessionId = try values.decode(String.self, forKey: WireKey("sessionId"))
    guard ProtocolLimits.validID(sessionId) else { throw NativeProtocolFailure.invalidMessage }
    switch type {
    case "start":
      let sources = try values.decode([AudioSource].self, forKey: WireKey("sources"))
      let locale = try values.decode(TranscriptionLocale.self, forKey: WireKey("locale"))
      guard (1...2).contains(sources.count), Set(sources).count == sources.count else {
        throw NativeProtocolFailure.invalidMessage
      }
      action = .start(sources: sources, locale: locale)
    case "pause": action = .pause
    case "resume": action = .resume
    case "stop": action = .stop
    default: throw NativeProtocolFailure.invalidMessage
    }
  }

  /// Input is one complete frame without LF, supplied by NativeCommandDecoder.
  /// Decode errors are deliberately redacted; Foundation errors may include input strings.
  public static func decodeLine(_ data: Data) throws -> NativeCommand {
    guard data.count <= ProtocolLimits.maxLineBytes else {
      throw NativeProtocolFailure.lineTooLarge
    }
    guard String(data: data, encoding: .utf8) != nil else {
      throw NativeProtocolFailure.invalidUTF8
    }
    guard !data.contains(10), !data.starts(with: [0xEF, 0xBB, 0xBF])
    else { throw NativeProtocolFailure.invalidMessage }
    do { return try JSONDecoder().decode(NativeCommand.self, from: data) } catch let failure
      as NativeProtocolFailure
    { throw failure } catch { throw NativeProtocolFailure.invalidMessage }
  }
}
