import Foundation
import Speech

enum EvaluationFailure: String, Error {
  case invalidArguments = "STT_EVAL_INVALID_ARGUMENTS"
  case unsupportedSystem = "STT_EVAL_REQUIRES_MACOS_26"
  case unavailable = "STT_EVAL_SPEECH_UNAVAILABLE"
  case unsupportedLocale = "STT_EVAL_UNSUPPORTED_LOCALE"
  case assetsUnavailable = "STT_EVAL_ASSETS_UNAVAILABLE"
  case mediaUnreadable = "STT_EVAL_MEDIA_UNREADABLE"
  case referenceUnreadable = "STT_EVAL_REFERENCE_UNREADABLE"
  case transcriptionFailed = "STT_EVAL_TRANSCRIPTION_FAILED"
}

enum EvaluationPreset: String, Codable, CaseIterable {
  case production
  case quality

  @available(macOS 26.0, *)
  var speechPreset: SpeechTranscriber.Preset {
    switch self {
    case .production: .timeIndexedProgressiveTranscription
    case .quality: .transcription
    }
  }
}

struct EvaluationOptions: Equatable {
  enum Mode: Equatable { case help, evaluate }

  let mode: Mode
  let mediaPath: String?
  let referencePath: String?
  let locale: String
  let preset: EvaluationPreset
  let showText: Bool

  static func parse(_ arguments: [String]) throws -> EvaluationOptions {
    if arguments.isEmpty || arguments == ["--help"] {
      return EvaluationOptions(
        mode: .help, mediaPath: nil, referencePath: nil, locale: "pt-BR",
        preset: .production, showText: false)
    }

    var mediaPath: String?
    var referencePath: String?
    var locale = "pt-BR"
    var preset = EvaluationPreset.production
    var showText = false
    var index = 0
    var evaluate = false

    while index < arguments.count {
      let argument = arguments[index]
      switch argument {
      case "--evaluate":
        guard !evaluate else { throw EvaluationFailure.invalidArguments }
        evaluate = true
      case "--media":
        mediaPath = try uniqueValue(arguments, index: &index, existing: mediaPath)
      case "--reference":
        referencePath = try uniqueValue(arguments, index: &index, existing: referencePath)
      case "--locale":
        guard locale == "pt-BR" else { throw EvaluationFailure.invalidArguments }
        locale = try value(arguments, index: &index)
      case "--preset":
        let rawValue = try value(arguments, index: &index)
        guard let parsed = EvaluationPreset(rawValue: rawValue) else {
          throw EvaluationFailure.invalidArguments
        }
        preset = parsed
      case "--show-text":
        guard !showText else { throw EvaluationFailure.invalidArguments }
        showText = true
      default: throw EvaluationFailure.invalidArguments
      }
      index += 1
    }

    guard evaluate, let mediaPath, let referencePath, locale == "pt-BR" else {
      throw EvaluationFailure.invalidArguments
    }
    return EvaluationOptions(
      mode: .evaluate, mediaPath: mediaPath, referencePath: referencePath, locale: locale,
      preset: preset, showText: showText)
  }

  private static func uniqueValue(
    _ arguments: [String], index: inout Int, existing: String?
  ) throws -> String {
    guard existing == nil else { throw EvaluationFailure.invalidArguments }
    return try value(arguments, index: &index)
  }

  private static func value(_ arguments: [String], index: inout Int) throws -> String {
    index += 1
    guard index < arguments.count, !arguments[index].hasPrefix("--") else {
      throw EvaluationFailure.invalidArguments
    }
    return arguments[index]
  }
}
