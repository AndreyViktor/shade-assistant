import Foundation

@MainActor
final class TrialSession {
  enum State { case idle, running, paused, stopped }
  private(set) var state: State = .idle
  private var channels: [any TrialChannel] = []
  private var segment = 0
  private let sources: [AudioSource]
  private let shouldStop: @Sendable () -> Bool
  private let factory: (AudioSource, Int) -> any TrialChannel

  init(
    sources: [AudioSource], shouldStop: @escaping @Sendable () -> Bool = { false },
    factory: @escaping (AudioSource, Int) -> any TrialChannel
  ) {
    self.sources = sources
    self.shouldStop = shouldStop
    self.factory = factory
  }

  func start() async throws {
    guard state == .idle || state == .paused else { return }
    segment += 1
    do {
      for source in sources {
        guard !shouldStop() else { throw TrialFailure.interrupted }
        let channel = factory(source, segment)
        channels.append(channel)
        try await channel.prepare()
      }
      for channel in channels {
        guard !shouldStop() else { throw TrialFailure.interrupted }
        try await channel.start()
      }
      guard !shouldStop() else { throw TrialFailure.interrupted }
      state = .running
    } catch {
      // Attempt every cleanup even when one source fails to start/stop.
      do { try await stop() } catch { throw TrialFailure.cleanup }
      throw error
    }
  }

  func pause() async throws {
    guard state == .running else { return }
    state = .paused
    try await closeChannels()
  }

  func stop() async throws {
    state = .stopped
    try await closeChannels()
  }

  private func closeChannels() async throws {
    for channel in channels { channel.suppressResults() }
    var failure: (any Error)?
    for channel in channels {
      do { try await channel.stop() } catch { failure = error }
    }
    channels.removeAll()
    if let failure { throw failure }
  }
}
