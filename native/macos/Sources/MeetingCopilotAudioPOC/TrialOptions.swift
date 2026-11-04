import Foundation

enum AudioSource: String, CaseIterable, Sendable {
  case mic, system
}

enum TrialFailure: String, Error {
  case invalidArguments = "POC_INVALID_ARGUMENTS"
  case terminalRequired = "POC_MANUAL_TERMINAL_REQUIRED"
  case interrupted = "POC_INTERRUPTED_DURING_START"
  case cleanup = "POC_CLEANUP_FAILED_EXITING"
  case unavailable = "POC_SPEECH_UNAVAILABLE"
  case unsupportedLocale = "POC_UNSUPPORTED_LOCALE"
  case assetsRequired = "POC_RUN_PREPARE_ASSETS"
  case assetPreparation = "POC_ASSET_PREPARATION_FAILED"
  case microphoneDenied = "POC_MICROPHONE_DENIED"
  case systemDenied = "POC_SYSTEM_ACCESS_OR_DISPLAY_UNAVAILABLE"
  case audioFormat = "POC_AUDIO_FORMAT_FAILED"
  case audioOverflow = "POC_AUDIO_QUEUE_OVERFLOW"
  case capture = "POC_CAPTURE_FAILED"
  case recognition = "POC_RECOGNITION_FAILED"
}

struct TrialOptions: Equatable {
  enum Mode: Equatable { case help, prepareAssets, capture }
  var mode: Mode = .help
  var sources: [AudioSource] = []
  var locale = "pt-BR"
  var showText = false

  static func parse(_ arguments: [String]) throws -> Self {
    if arguments.isEmpty || arguments == ["--help"] { return Self() }
    var options = Self()
    var seen = Set<String>()
    var index = 0
    while index < arguments.count {
      let flag = arguments[index]
      guard seen.insert(flag).inserted else { throw TrialFailure.invalidArguments }
      switch flag {
      case "--prepare-assets": options.mode = .prepareAssets
      case "--capture": options.mode = .capture
      case "--show-text": options.showText = true
      case "--source", "--locale":
        index += 1
        guard index < arguments.count else { throw TrialFailure.invalidArguments }
        let value = arguments[index]
        if flag == "--locale" {
          guard ["pt-BR", "en-US"].contains(value) else { throw TrialFailure.invalidArguments }
          options.locale = value
        } else {
          switch value {
          case "mic": options.sources = [.mic]
          case "system": options.sources = [.system]
          case "both": options.sources = [.mic, .system]
          default: throw TrialFailure.invalidArguments
          }
        }
      default: throw TrialFailure.invalidArguments
      }
      index += 1
    }
    guard !(seen.contains("--capture") && seen.contains("--prepare-assets")) else {
      throw TrialFailure.invalidArguments
    }
    switch options.mode {
    case .help: throw TrialFailure.invalidArguments
    case .prepareAssets:
      guard options.sources.isEmpty && !options.showText else {
        throw TrialFailure.invalidArguments
      }
    case .capture:
      guard !options.sources.isEmpty else { throw TrialFailure.invalidArguments }
    }
    return options
  }
}
