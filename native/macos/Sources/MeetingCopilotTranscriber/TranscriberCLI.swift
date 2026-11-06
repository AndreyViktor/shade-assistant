import Darwin
import Foundation
import MeetingCopilotProtocol

@main
struct TranscriberCLI {
  @MainActor
  static func main() async {
    // No developer/test switches and no automatic capture from command-line arguments.
    guard CommandLine.arguments.count == 1 else { exit(64) }
    signal(SIGPIPE, SIG_IGN)
    let output: ProcessOutput
    do { output = try ProcessOutput() } catch { exit(2) }
    let input = ProcessInput()
    let session = TranscriberSession(
      factory: { source, locale, result in
        guard #available(macOS 26.0, *) else { throw HelperFailure(.unavailable) }
        return AppleTranscriptionChannel(source: source, locale: locale, result: result) {
          input.fail($0)
        }
      },
      preflight: { sources in
        guard #available(macOS 26.0, *) else { throw HelperFailure(.unavailable) }
        try await CapturePermissions.request(sources)
      },
      cancelled: { input.cancelled }, write: { try output.write($0) },
      reportFailure: { input.fail($0) })
    signal(SIGINT, SIG_IGN)
    signal(SIGTERM, SIG_IGN)
    let signals = [SIGINT, SIGTERM].map { number in
      let source = DispatchSource.makeSignalSource(signal: number, queue: .global())
      // Explicitly non-actor: Dispatch invokes this on its global queue.
      source.setEventHandler { @Sendable in input.end() }
      source.resume()
      return source
    }
    let deadline = OperationDeadline()
    // A host must send start within 30s; thereafter only active operations are timed.
    deadline.arm(seconds: 30)
    input.readStdin()
    var failed = false
    for await event in input.events {
      deadline.arm(seconds: 30)
      if input.overflowed {
        await session.finish(reason: .error, error: .invalidCommand)
        failed = true
        break
      }
      do {
        switch event {
        case .command(let command): try await session.handle(command)
        case .failure(let code):
          await session.finish(reason: .error, error: code)
          failed = true
        case .end: await session.finish(reason: .cancelled)
        }
      } catch {
        input.requestStop()
        await session.finish(reason: .error, error: HelperFailure.code(for: error))
        failed = true
      }
      deadline.cancel()
      if session.state == .stopped { break }
    }
    // Includes queue overflow and input failure before a session was established.
    await session.finish(reason: .cancelled)
    for source in signals { source.cancel() }
    exit(failed || session.failed || input.overflowed ? 2 : 0)
  }
}
