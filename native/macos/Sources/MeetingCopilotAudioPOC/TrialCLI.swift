import AVFoundation
import Darwin
import Foundation
import Synchronization

@main
struct TrialCLI {
  static let help = """
    MeetingCopilotAudioPOC — APPLE LOCAL (SWIFT), T006 only
    --prepare-assets [--locale pt-BR|en-US]  Reserve/install Apple assets; NO capture/TCC.
    --capture --source mic|system|both [--locale pt-BR|en-US] [--show-text]
    Capture is MANUAL ONLY; macOS may ask you for access. Never use a real meeting.
    Default output: metadata only. --show-text displays synthetic test speech locally.
    During capture: p + Enter pauses; r + Enter resumes; q + Enter or Ctrl-C stops.
    Auto-stop: 120 seconds after capture starts. No raw audio files, OpenAI or Electron.
    """

  @MainActor
  static func main() async {
    let options: TrialOptions
    do { options = try TrialOptions.parse(Array(CommandLine.arguments.dropFirst())) } catch {
      fail(.invalidArguments, status: 64)
    }
    if options.mode == .help {
      print(help)
      return
    }
    guard #available(macOS 26.0, *) else { fail(.unavailable) }
    let output = TrialOutput()
    // Last-resort process bound if an Apple service ignores cooperative cancellation.
    // Exiting releases OS capture handles; this is not a successful graceful-stop result.
    DispatchQueue.global().asyncAfter(
      deadline: .now() + (options.mode == .prepareAssets ? 600 : 180)
    ) {
      FileHandle.standardError.write(Data("POC_WATCHDOG_TIMEOUT\n".utf8))
      exit(2)
    }
    if options.mode == .prepareAssets {
      do { try await SpeechAssets.prepare(locale: options.locale, output: output) } catch {
        fail((error as? TrialFailure) ?? .assetPreparation)
      }
      return
    }
    guard isatty(STDIN_FILENO) == 1, isatty(STDOUT_FILENO) == 1 else {
      fail(.terminalRequired, status: 64)
    }
    await capture(options, output: output)
  }

  @available(macOS 26.0, *)
  @MainActor
  private static func capture(_ options: TrialOptions, output: TrialOutput) async {
    print(help)
    output.status(
      "MANUAL_CAPTURE_REQUESTED_\(options.sources.map(\.rawValue).joined(separator: "+"))_\(options.locale)"
    )
    let (commands, continuation) = AsyncStream<TrialCommand>.makeStream(
      bufferingPolicy: .bufferingOldest(16))
    let stopRequested = Mutex(false)
    let session = TrialSession(
      sources: options.sources, shouldStop: { stopRequested.withLock { $0 } },
      factory: { source, segment in
        SpeechChannel(source: source, options: options, segment: segment, output: output) { error in
          continuation.yield(.failure(error))
        }
      })
    signal(SIGINT, SIG_IGN)
    signal(SIGTERM, SIG_IGN)
    let signals = [SIGINT, SIGTERM].map { number in
      let signalSource = DispatchSource.makeSignalSource(signal: number, queue: .global())
      signalSource.setEventHandler {
        stopRequested.withLock { $0 = true }
        continuation.yield(.stop)
        DispatchQueue.global().asyncAfter(deadline: .now() + 8) {
          FileHandle.standardError.write(Data("POC_FORCED_INTERRUPT\n".utf8))
          exit(130)
        }
      }
      signalSource.resume()
      return signalSource
    }
    defer { for signalSource in signals { signalSource.cancel() } }
    do {
      if options.sources.contains(.mic) {
        output.status("MICROPHONE_PERMISSION_CHECK_USER_ACTION_MAY_BE_REQUIRED")
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        if status == .notDetermined {
          guard await AVCaptureDevice.requestAccess(for: .audio) else {
            throw TrialFailure.microphoneDenied
          }
        } else if status != .authorized {
          throw TrialFailure.microphoneDenied
        }
      }
      if options.sources.contains(.system) {
        output.status("SYSTEM_PERMISSION_CHECK_USER_ACTION_MAY_BE_REQUIRED")
      }
      try await session.start()
      output.status("CAPTURE_ACTIVE_SPEAK_SYNTHETIC_PHRASES_NOW")
      DispatchQueue.global().async {
        while let line = readLine() {
          switch line.trimmingCharacters(in: .whitespacesAndNewlines) {
          case "p": continuation.yield(.pause)
          case "r": continuation.yield(.resume)
          case "q":
            continuation.yield(.stop)
            return
          default: break
          }
        }
        continuation.yield(.stop)
      }
      let deadline = Task {
        try? await Task.sleep(for: .seconds(120))
        if !Task.isCancelled { continuation.yield(.stop) }
      }
      defer { deadline.cancel() }
      commandLoop: for await command in commands {
        switch command {
        case .pause:
          try await session.pause()
          output.status("PAUSED_CAPTURE_OFF")
        case .resume:
          try await session.start()
          output.status("CAPTURE_ACTIVE_SPEAK_SYNTHETIC_PHRASES_NOW")
        case .stop: break commandLoop
        case .failure(let error): throw error
        }
      }
      try await session.stop()
      continuation.finish()
      output.status("STOPPED_CAPTURE_OFF")
      output.summary()
    } catch {
      do { try await session.stop() } catch { output.status("POC_CLEANUP_FAILED_EXITING") }
      continuation.finish()
      output.summary()
      fail((error as? TrialFailure) ?? .capture)
    }
  }

  private static func fail(_ error: TrialFailure, status: Int32 = 2) -> Never {
    FileHandle.standardError.write(Data("\(error.rawValue)\n".utf8))
    exit(status)
  }
}

private enum TrialCommand: Sendable {
  case pause, resume, stop
  case failure(TrialFailure)
}
