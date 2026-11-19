import Darwin
import Foundation

@main
enum EvaluatorCLI {
  static func main() async {
    do {
      let options = try EvaluationOptions.parse(Array(CommandLine.arguments.dropFirst()))
      guard options.mode == .evaluate else {
        print(help)
        return
      }
      guard #available(macOS 26.0, *) else { throw EvaluationFailure.unsupportedSystem }
      let report = try await SpeechFileEvaluator.evaluate(options)
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.sortedKeys]
      FileHandle.standardOutput.write(try encoder.encode(report))
      FileHandle.standardOutput.write(Data("\n".utf8))
    } catch {
      let failure = (error as? EvaluationFailure) ?? .transcriptionFailed
      FileHandle.standardError.write(Data("\(failure.rawValue)\n".utf8))
      exit(2)
    }
  }

  private static let help = """
    MeetingCopilotSTTEvaluator reads one local media file and never captures or uses a network.

    --evaluate --media PATH --reference PATH [--locale pt-BR]
      [--preset production|quality] [--show-text]

    production = time-indexed progressive preset used by the app
    quality    = non-progressive transcription preset
    Output is JSON and redacts reference/hypothesis unless --show-text is explicit.
    """
}
