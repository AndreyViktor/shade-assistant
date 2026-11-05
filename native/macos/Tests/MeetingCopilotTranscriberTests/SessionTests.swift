import Darwin
import Foundation
import MeetingCopilotAudio
import MeetingCopilotProtocol
import Testing
import os

@testable import MeetingCopilotTranscriber

@MainActor
private final class Channel: TranscriptionChannel {
  let source: AudioSource
  let result: (SpeechResult) -> Void
  var prepared = false
  var started = false
  var suppressed = false
  var stopped = false
  var prepareError: NativeErrorCode?
  var startError: NativeErrorCode?
  var stopError = false
  var onPrepare: () -> Void = {}
  var onStop: () -> Void = {}

  init(source: AudioSource, result: @escaping (SpeechResult) -> Void) {
    self.source = source
    self.result = result
  }

  func prepare() async throws {
    prepared = true
    onPrepare()
    if let prepareError { throw HelperFailure(prepareError) }
  }
  func start() async throws {
    started = true
    if let startError { throw HelperFailure(startError) }
  }
  func suppressResults() { suppressed = true }
  func stop() async throws {
    onStop()
    stopped = true
    if stopError { throw HelperFailure(.captureFailed) }
  }
  func speak(
    final: Bool = false, text: String = "Frase sintética.", start: Double = 0, end: Double = 0.2
  ) {
    result(SpeechResult(text: text, start: start, end: end, isFinal: final))
  }
}

@MainActor
private final class Harness {
  var events: [NativeEvent] = []
  var channels: [Channel] = []
  var failures: [NativeErrorCode] = []
  var cancelled = false
  var time: Int64 = 1_000
  var permissions = true
  var sinkFailed = false
  var configure: (Channel) -> Void = { _ in }

  lazy var session = TranscriberSession(
    factory: { source, _, result in
      let channel = Channel(source: source, result: result)
      self.configure(channel)
      self.channels.append(channel)
      return channel
    },
    preflight: { _ in if !self.permissions { throw HelperFailure(.permissionDenied) } },
    cancelled: { self.cancelled }, now: { self.time },
    write: { event in
      if self.sinkFailed { throw HelperFailure(.internal) }
      self.events.append(event)
    }, reportFailure: { self.failures.append($0) })

  func command(_ type: String, sessionId: String = "test") throws -> NativeCommand {
    let extra = type == "start" ? ",\"sources\":[\"mic\",\"system\"],\"locale\":\"pt-BR\"" : ""
    return try NativeCommand.decodeLine(
      Data("{\"version\":1,\"sessionId\":\"\(sessionId)\",\"type\":\"\(type)\"\(extra)}".utf8))
  }

  func send(_ type: String, sessionId: String = "test") async throws {
    try await session.handle(command(type, sessionId: sessionId))
  }
}

@Test @MainActor func separateSourcesKeepSequencesAndClockAcrossPause() async throws {
  let h = Harness()
  try await h.send("start")
  #expect(h.channels.map(\.source) == [.mic, .system])
  #expect(h.channels.allSatisfy { $0.prepared && $0.started })
  h.time = 1_300
  h.channels[0].speak()
  h.channels[0].speak(final: true)
  h.channels[1].speak(final: true)
  h.channels[0].onStop = { #expect(h.channels.allSatisfy { $0.suppressed }) }
  try await h.send("pause")
  #expect(h.channels.allSatisfy { $0.stopped })
  let pausedCount = h.events.count
  h.channels[0].speak()
  #expect(h.events.count == pausedCount)
  h.time = 5_000
  try await h.send("resume")
  #expect(h.channels.count == 4)
  h.channels[0].speak()
  let before = h.events.count
  h.channels[2].speak(final: true)
  #expect(h.events.count == before + 1)
  let event = try #require(h.events.last)
  if case .final(let id, let start, let end, _) = event.payload {
    #expect(id == "g2-t4000")
    #expect(start == 4_000)
    #expect(end == 4_200)
    #expect(event.timestampMs >= end)
  } else {
    Issue.record("Expected final")
  }
  try await h.send("stop")
  try await h.send("stop")
  #expect(h.channels.allSatisfy { $0.stopped })
  for source in [AudioSource.mic, .system] {
    let events = h.events.filter { $0.source == source }
    #expect(events.map(\.seq) == (1...events.count).map(Int64.init))
    #expect(events.map(\.timestampMs) == events.map(\.timestampMs).sorted())
    #expect(
      events.filter {
        if case .ready = $0.payload { return true }
        return false
      }.count == 1)
    if case .stopped(.cancelled) = events.last?.payload {} else { Issue.record("Missing stop") }
  }
}

@Test(arguments: [true, false]) @MainActor
func failedStartupCleansAllCreatedChannels(_ prepare: Bool) async throws {
  let h = Harness()
  h.configure = { channel in
    if channel.source == .system {
      if prepare {
        channel.prepareError = .assetsUnavailable
      } else {
        channel.startError = .captureFailed
      }
    }
  }
  do {
    try await h.send("start")
    Issue.record("Expected failure")
  } catch {
    await h.session.finish(reason: .error, error: HelperFailure.code(for: error))
  }
  #expect(h.channels.count == 2)
  #expect(h.channels.allSatisfy { $0.suppressed && $0.stopped })
  #expect(h.events.count == 4)
  #expect(h.session.failed)
  #expect(h.session.state == .stopped)
}

@Test @MainActor func permissionsFailBeforeCreatingAnyCapture() async throws {
  let h = Harness()
  h.permissions = false
  do {
    try await h.send("start")
    Issue.record("Expected permission failure")
  } catch {
    #expect(HelperFailure.code(for: error) == .permissionDenied)
    await h.session.finish(reason: .error, error: .permissionDenied)
  }
  #expect(h.channels.isEmpty)
  #expect(h.events.count == 4)
}

@Test @MainActor func cancellationDuringPreparationPreventsCapture() async throws {
  let h = Harness()
  h.configure = { channel in channel.onPrepare = { h.cancelled = true } }
  try await h.send("start")
  await h.session.finish(reason: .cancelled)
  #expect(h.channels.count == 1)
  #expect(h.channels.allSatisfy { !$0.started && $0.stopped })
  #expect(h.events.count == 2)
  #expect(!h.session.failed)
}

@Test @MainActor func cancelledBatchDoesNotEvenCheckPermissions() async throws {
  let h = Harness()
  h.permissions = false
  h.cancelled = true
  try await h.send("start")
  try await h.send("stop")
  #expect(h.channels.isEmpty)
  #expect(h.events.count == 2)
  #expect(!h.session.failed)
}

@Test @MainActor func cleanupFailureStillStopsSecondSource() async throws {
  let h = Harness()
  try await h.send("start")
  h.channels[0].stopError = true
  try await h.send("stop")
  #expect(h.channels.allSatisfy { $0.stopped })
  #expect(h.session.failed)
  #expect(h.events.count == 8)
}

@Test(arguments: ["start", "resume", "pause-other-session"]) @MainActor
func invalidTransitionsAndSessionIdsAreRejected(_ type: String) async throws {
  let h = Harness()
  try await h.send("start")
  do {
    try await h.send(
      type == "pause-other-session" ? "pause" : type,
      sessionId: type == "pause-other-session" ? "other" : "test")
    Issue.record("Expected invalid command")
  } catch { #expect(HelperFailure.code(for: error) == .invalidCommand) }
  await h.session.finish(reason: .error, error: .invalidCommand)
  #expect(h.channels.allSatisfy { $0.stopped })
}

@Test @MainActor func invalidResultsAndOutputFailureAreSanitized() async throws {
  let h = Harness()
  try await h.send("start")
  h.channels[0].speak(text: String(repeating: "a", count: 4097))
  h.channels[0].speak(start: .nan)
  #expect(h.failures == [.transcriptionFailed, .transcriptionFailed])
  #expect(h.events.count == 4)
  h.sinkFailed = true
  h.channels[0].speak()
  #expect(h.failures.count == 3)
  await h.session.finish(reason: .error, error: .internal)
  #expect(h.channels.allSatisfy { $0.stopped })
  #expect(h.session.failed)
}

@Test func audioErrorsMapToAllowlistedCodes() {
  #expect(HelperFailure.code(for: AudioFailure.microphoneDenied) == .permissionDenied)
  #expect(HelperFailure.code(for: AudioFailure.systemDenied) == .permissionDenied)
  #expect(HelperFailure.code(for: AudioFailure.audioOverflow) == .captureFailed)
  #expect(HelperFailure.code(for: NSError(domain: "PRIVATE", code: 99)) == .transcriptionFailed)
}

@Test func channelFailuresAreOneShotAndSuppressedBeforeTeardown() {
  let codes = OSAllocatedUnfairLock(initialState: [NativeErrorCode]())
  let first = ChannelFailureRelay { code in codes.withLock { $0.append(code) } }
  first.report(.captureFailed)
  first.report(.transcriptionFailed)
  let second = ChannelFailureRelay { code in codes.withLock { $0.append(code) } }
  second.close()
  second.report(.captureFailed)
  #expect(codes.withLock { $0 } == [.captureFailed])
}

@Test @MainActor func pauseFailureSuppressesLateResultsAndStopsEveryChannel() async throws {
  let h = Harness()
  try await h.send("start")
  h.channels[0].stopError = true
  do {
    try await h.send("pause")
    Issue.record("Expected cleanup failure")
  } catch {
    await h.session.finish(reason: .error, error: HelperFailure.code(for: error))
  }
  let count = h.events.count
  h.channels[0].speak()
  #expect(h.events.count == count)
  #expect(h.channels.allSatisfy { $0.stopped && $0.suppressed })
  #expect(h.session.failed)
}

@Test @MainActor func slowOutputConsumerFailsWithoutBlockingOrRetryingCorruptFrames() throws {
  var descriptors: [Int32] = [0, 0]
  #expect(pipe(&descriptors) == 0)
  defer {
    Darwin.close(descriptors[0])
    Darwin.close(descriptors[1])
  }
  let output = try ProcessOutput(descriptor: descriptors[1])
  let event = NativeEvent(
    sessionId: "backpressure", source: .mic, locale: .portuguese,
    seq: 1, timestampMs: 1,
    payload: .final(
      segmentId: "segment", startMs: 0, endMs: 1, text: String(repeating: "x", count: 4096)))
  var failed = false
  for _ in 0..<100 {
    do { try output.write(event) } catch {
      failed = true
      break
    }
  }
  #expect(failed)
  var drained = [UInt8](repeating: 0, count: 8192)
  #expect(read(descriptors[0], &drained, drained.count) > 0)
  // Once a partial write fails, later writes must not append to a truncated JSON frame.
  #expect(throws: (any Error).self) { try output.write(event) }
}
