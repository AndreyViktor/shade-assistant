import Foundation
import MeetingCopilotProtocol

/// One session per process. The command loop is the only caller of async lifecycle methods.
@MainActor
final class TranscriberSession {
  enum State { case idle, starting, listening, paused, stopping, stopped }
  typealias Factory = (AudioSource, TranscriptionLocale, @escaping (SpeechResult) -> Void) throws ->
    any TranscriptionChannel
  private(set) var state: State = .idle
  private(set) var failed = false
  private var sessionId: String?
  private var sources: [AudioSource] = []
  private var locale: TranscriptionLocale = .portuguese
  private var channels: [any TranscriptionChannel] = []
  private var sequences: [AudioSource: Int64] = [:]
  private var timestamps: [AudioSource: Int64] = [:]
  private var offsets: [AudioSource: Int64] = [:]
  private var generation = 0
  private var origin: Int64 = 0
  private let factory: Factory
  private let preflight: @MainActor ([AudioSource]) async throws -> Void
  private let cancelled: () -> Bool
  private let now: () -> Int64
  private let write: (NativeEvent) throws -> Void
  private let reportFailure: (NativeErrorCode) -> Void

  init(
    factory: @escaping Factory,
    preflight: @escaping @MainActor ([AudioSource]) async throws -> Void,
    cancelled: @escaping () -> Bool,
    now: @escaping () -> Int64 = { Int64(DispatchTime.now().uptimeNanoseconds / 1_000_000) },
    write: @escaping (NativeEvent) throws -> Void,
    reportFailure: @escaping (NativeErrorCode) -> Void
  ) {
    self.factory = factory
    self.preflight = preflight
    self.cancelled = cancelled
    self.now = now
    self.write = write
    self.reportFailure = reportFailure
  }

  func handle(_ command: NativeCommand) async throws {
    if case .start(let sources, let locale) = command.action {
      guard state == .idle else { throw HelperFailure(.invalidCommand) }
      sessionId = command.sessionId
      self.sources = sources
      self.locale = locale
      origin = now()
      state = .starting
      if cancelled() { return }
      try await startChannels(initial: true)
      return
    }
    guard sessionId == command.sessionId else { throw HelperFailure(.invalidCommand) }
    switch command.action {
    case .start: throw HelperFailure(.invalidCommand)
    case .pause:
      guard state == .listening else { throw HelperFailure(.invalidCommand) }
      state = .paused
      try await closeChannels()
      for source in sources { try emit(.status(.paused), source: source) }
    case .resume:
      guard state == .paused else { throw HelperFailure(.invalidCommand) }
      if !cancelled() { try await startChannels(initial: false) }
    case .stop: await finish(reason: .cancelled)
    }
  }

  private func startChannels(initial: Bool) async throws {
    state = .starting
    generation += 1
    let generation = self.generation
    try await preflight(sources)
    for source in sources {
      if cancelled() { return }
      let channel = try factory(source, locale) { [weak self] result in
        self?.receive(result, source: source, generation: generation)
      }
      channels.append(channel)
      try await channel.prepare()
    }
    for (source, channel) in zip(sources, channels) {
      if cancelled() { return }
      offsets[source] = max(0, now() - origin)
      try await channel.start()
    }
    if cancelled() { return }
    for source in sources {
      if initial { try emit(.ready(supportsPartial: true), source: source) }
      try emit(.status(.listening), source: source)
    }
    state = .listening
  }

  private func receive(_ result: SpeechResult, source: AudioSource, generation: Int) {
    guard state == .listening, generation == self.generation, !cancelled() else { return }
    guard !result.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
    // Apple's times are relative to each fresh analyzer. Preserve a common session clock on resume.
    let offset = offsets[source, default: 0]
    guard result.start.isFinite, result.end.isFinite, result.start >= 0,
      result.end >= result.start, result.end * 1000 < Double(ProtocolLimits.maxInteger - offset)
    else {
      reportFailure(.transcriptionFailed)
      return
    }
    let start = offset + Int64(result.start * 1000)
    let end = offset + Int64(result.end * 1000)
    let id = "g\(generation)-t\(start)"
    let payload: NativeEvent.Payload =
      result.isFinal
      ? .final(segmentId: id, startMs: start, endMs: end, text: result.text)
      : .partial(segmentId: id, startMs: start, endMs: end, text: result.text)
    do { try emit(payload, source: source, minimumTime: end) } catch {
      reportFailure(.transcriptionFailed)
    }
  }

  func finish(reason: StopReason, error: NativeErrorCode? = nil) async {
    guard state != .stopped else { return }
    state = .stopping
    var code = error
    do { try await closeChannels() } catch { code = code ?? .captureFailed }
    if code != nil { failed = true }
    for source in sources {
      do {
        if let code { try emit(.error(code), source: source) }
        try emit(.stopped(code == nil ? reason : .error), source: source)
      } catch { failed = true }
    }
    state = .stopped
  }

  private func closeChannels() async throws {
    for channel in channels { channel.suppressResults() }
    var failed = false
    for channel in channels {
      do { try await channel.stop() } catch { failed = true }
    }
    channels.removeAll()
    if failed { throw HelperFailure(.captureFailed) }
  }

  private func emit(_ payload: NativeEvent.Payload, source: AudioSource, minimumTime: Int64 = 0)
    throws
  {
    guard let sessionId else { throw HelperFailure(.internal) }
    let seq = sequences[source, default: 0] + 1
    let timestamp = max(timestamps[source, default: 0], max(now() - origin, minimumTime))
    let event = NativeEvent(
      sessionId: sessionId, source: source, locale: locale,
      seq: seq, timestampMs: timestamp, payload: payload)
    // Validate before handing to any sink, including test sinks.
    _ = try event.encodeLine()
    try write(event)
    sequences[source] = seq
    timestamps[source] = timestamp
  }
}
