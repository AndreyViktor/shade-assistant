import Foundation

public enum AudioSource: String, Codable, Sendable { case mic, system }
public enum TranscriptionLocale: String, Codable, Sendable {
  case portuguese = "pt-BR"
  case english = "en-US"
}
public enum NativeProtocolFailure: Error {
  case invalidMessage, unsupportedVersion, lineTooLarge, invalidUTF8, truncatedLine, closedStream
}

public enum ProtocolLimits {
  public static let version = 1
  public static let maxLineBytes = 16_384
  public static let maxTextLength = 4_096
  public static let maxInteger: Int64 = 9_007_199_254_740_991

  static func validID(_ value: String) -> Bool {
    !value.isEmpty && value.utf8.count <= 64
      && value.utf8.allSatisfy {
        (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0)
          || $0 == 95 || $0 == 45
      }
  }

  static func validTime(_ value: Int64) -> Bool { value >= 0 && value <= maxInteger }

  // Match JavaScript String.trim exactly, rather than Foundation's broader whitespace set.
  static func validText(_ value: String) -> Bool {
    value.utf16.count <= maxTextLength
      && value.unicodeScalars.contains {
        switch $0.value {
        case 0x0009...0x000D, 0x0020, 0x00A0, 0x1680, 0x2000...0x200A,
          0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
          return false
        default: return true
        }
      }
  }
}

// Dynamic keys allow rejecting unknown fields; synthesized Codable ignores them.
struct WireKey: CodingKey {
  var stringValue: String
  var intValue: Int? { nil }
  init(_ value: String) { stringValue = value }
  init?(stringValue: String) { self.init(stringValue) }
  init?(intValue: Int) { return nil }
}
