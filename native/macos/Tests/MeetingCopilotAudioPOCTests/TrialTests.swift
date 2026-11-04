import Foundation
import Synchronization
import Testing

@testable import MeetingCopilotAudioPOC

@Test func noArgumentsNeverStartCapture() throws {
  #expect(try TrialOptions.parse([]).mode == .help)
  #expect(try TrialOptions.parse(["--help"]).mode == .help)
  let assets = try TrialOptions.parse(["--prepare-assets"])
  #expect(assets.mode == .prepareAssets)
  #expect(assets.sources.isEmpty)
  #expect(assets.locale == "pt-BR")
  #expect(!assets.showText)
}

@Test(arguments: [
  ["--capture"], ["--source", "mic"], ["--prepare-assets", "--capture", "--source", "mic"],
  ["--prepare-assets", "--show-text"], ["--prepare-assets", "--source", "system"],
  ["--capture", "--source", "both", "--locale", "pt-BR,en-US"],
  ["--capture", "--source", "system", "--unknown"], ["--locale"],
  ["--capture", "--source", "mic", "--capture"], ["--capture", "--source", "file"],
])
func unsafeOrAmbiguousOptionsAreRejected(_ arguments: [String]) {
  #expect(throws: TrialFailure.invalidArguments) { try TrialOptions.parse(arguments) }
}

@Test func sourceAndLocaleAreExplicit() throws {
  let options = try TrialOptions.parse([
    "--capture", "--source", "both", "--locale", "en-US", "--show-text",
  ])
  #expect(options.sources == [.mic, .system])
  #expect(options.locale == "en-US")
  #expect(options.showText)
}

@Test func outputRedactsSpeechByDefaultAndHandlesInvalidTime() throws {
  let record = TrialRecord(
    event: "transcription", source: .mic, locale: "pt-BR", segment: 1,
    isFinal: false, start: .nan, end: 2, recognizedText: "SYNTHETIC PRIVATE TEXT")
  let data = try JSONEncoder().encode(record)
  let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
  #expect(json["text"] == nil)
  #expect(json["audioStartSeconds"] == nil)
  #expect(json["source"] as? String == "mic")
  #expect(json["locale"] as? String == "pt-BR")
  #expect(json["characters"] as? Int == 22)
  #expect(json["isFinal"] as? Bool == false)
  let visible = TrialRecord(event: "transcription", recognizedText: "synthetic", showText: true)
  #expect(String(decoding: try JSONEncoder().encode(visible), as: UTF8.self).contains("synthetic"))
}

@MainActor
private final class FakeChannel: TrialChannel {
  let source: AudioSource
  let segment: Int
  var prepared = false
  var started = false
  var suppressed = false
  var stopped = false
  var failPrepare = false
  var failStart = false
  var failStop = false
  var onPrepare: (() -> Void)?
  var onStop: (() -> Void)?

  init(source: AudioSource, segment: Int) {
    self.source = source
    self.segment = segment
  }
  func prepare() async throws {
    prepared = true
    onPrepare?()
    if failPrepare { throw TrialFailure.assetsRequired }
  }
  func start() async throws {
    started = true
    if failStart { throw TrialFailure.capture }
  }
  func suppressResults() { suppressed = true }
  func stop() async throws {
    onStop?()
    stopped = true
    if failStop { throw TrialFailure.capture }
  }
}

@Test @MainActor func independentChannelsPauseAndResumeWithFreshSegments() async throws {
  var created: [FakeChannel] = []
  let session = TrialSession(sources: [.mic, .system]) { source, segment in
    let channel = FakeChannel(source: source, segment: segment)
    created.append(channel)
    return channel
  }
  try await session.start()
  #expect(created.map(\.source) == [.mic, .system])
  #expect(created.allSatisfy { $0.started && $0.prepared })
  created[0].onStop = { #expect(created.allSatisfy { $0.suppressed }) }
  try await session.pause()
  #expect(session.state == .paused)
  #expect(created.allSatisfy { $0.stopped })
  try await session.start()
  #expect(created.map(\.segment) == [1, 1, 2, 2])
  try await session.start()
  #expect(created.count == 4)
  try await session.stop()
  try await session.stop()
  try await session.start()
  #expect(session.state == .stopped)
  #expect(created.count == 4)
  #expect(created.allSatisfy { $0.stopped })
}

@Test(arguments: [true, false]) @MainActor
func partialStartupFailureCleansEveryChannel(_ duringPreparation: Bool) async {
  var created: [FakeChannel] = []
  let session = TrialSession(sources: [.mic, .system]) { source, segment in
    let channel = FakeChannel(source: source, segment: segment)
    channel.failPrepare = source == .system && duringPreparation
    channel.failStart = source == .system && !duringPreparation
    created.append(channel)
    return channel
  }
  do {
    try await session.start()
    Issue.record("Expected startup failure")
  } catch {}
  #expect(session.state == .stopped)
  #expect(created.count == 2)
  #expect(created.allSatisfy { $0.suppressed && $0.stopped })
  if duringPreparation { #expect(created.allSatisfy { !$0.started }) }
}

@Test @MainActor func cleanupContinuesAfterOneSourceFails() async throws {
  var created: [FakeChannel] = []
  let session = TrialSession(sources: [.mic, .system]) { source, segment in
    let channel = FakeChannel(source: source, segment: segment)
    channel.failStop = source == .mic
    created.append(channel)
    return channel
  }
  try await session.start()
  do {
    try await session.stop()
    Issue.record("Expected cleanup failure")
  } catch {}
  #expect(created.allSatisfy { $0.suppressed && $0.stopped })
  #expect(session.state == .stopped)
}

@Test @available(macOS 26.0, *) @MainActor
func interruptionDuringPreparationPreventsCapture() async {
  let requested = Mutex(false)
  var created: [FakeChannel] = []
  let session = TrialSession(
    sources: [.mic, .system], shouldStop: { requested.withLock { $0 } },
    factory: {
      source, segment in
      let channel = FakeChannel(source: source, segment: segment)
      channel.onPrepare = { requested.withLock { $0 = true } }
      created.append(channel)
      return channel
    })
  do {
    try await session.start()
    Issue.record("Expected interruption")
  } catch { #expect(error as? TrialFailure == .interrupted) }
  #expect(created.count == 1)
  #expect(created.allSatisfy { !$0.started && $0.stopped })
}

@Test @MainActor func startupCleanupFailureIsReported() async {
  let session = TrialSession(sources: [.mic]) { source, segment in
    let channel = FakeChannel(source: source, segment: segment)
    channel.failStart = true
    channel.failStop = true
    return channel
  }
  do {
    try await session.start()
    Issue.record("Expected cleanup failure")
  } catch { #expect(error as? TrialFailure == .cleanup) }
}
