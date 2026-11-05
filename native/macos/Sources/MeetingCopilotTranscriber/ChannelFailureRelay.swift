import MeetingCopilotProtocol
import os

/// Capture callbacks run off-actor. Close before stopping so teardown errors cannot kill a resume.
final class ChannelFailureRelay: Sendable {
  private let closed = OSAllocatedUnfairLock(initialState: false)
  private let handler: @Sendable (NativeErrorCode) -> Void

  init(_ handler: @escaping @Sendable (NativeErrorCode) -> Void) { self.handler = handler }

  func report(_ code: NativeErrorCode) {
    let accepted = closed.withLock { value in
      if value { return false }
      value = true
      return true
    }
    if accepted { handler(code) }
  }

  func close() { closed.withLock { $0 = true } }
}
