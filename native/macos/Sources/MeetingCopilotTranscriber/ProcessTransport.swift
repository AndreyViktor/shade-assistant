import Darwin
import Foundation
import MeetingCopilotProtocol
import os

enum HelperInput: Sendable {
  case command(NativeCommand)
  case failure(NativeErrorCode)
  case end
}

/// Reader/signal callbacks may interrupt an Apple await without waiting for MainActor.
final class ProcessInput: Sendable {
  let events: AsyncStream<HelperInput>
  private let continuation: AsyncStream<HelperInput>.Continuation
  private let stop = OSAllocatedUnfairLock(initialState: false)
  private let overflow = OSAllocatedUnfairLock(initialState: false)

  init() {
    (events, continuation) = AsyncStream.makeStream(bufferingPolicy: .bufferingOldest(32))
  }

  var cancelled: Bool { stop.withLock { $0 } }
  var overflowed: Bool { overflow.withLock { $0 } }

  func requestStop() {
    let first = stop.withLock { value in
      if value { return false }
      value = true
      return true
    }
    if first {
      DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
        // Last resort if an Apple service does not cooperate. Never report graceful success.
        _exit(2)
      }
    }
  }

  func send(_ event: HelperInput) {
    switch continuation.yield(event) {
    case .dropped:
      overflow.withLock { $0 = true }
      requestStop()
      continuation.finish()
    case .enqueued, .terminated: break
    @unknown default:
      overflow.withLock { $0 = true }
      requestStop()
      continuation.finish()
    }
  }

  func fail(_ code: NativeErrorCode) {
    requestStop()
    send(.failure(code))
    continuation.finish()
  }

  func end() {
    requestStop()
    send(.end)
    continuation.finish()
  }

  func readStdin() {
    DispatchQueue.global().async { [self] in
      var decoder = NativeCommandDecoder()
      var buffer = [UInt8](repeating: 0, count: 4096)
      while true {
        let count = read(STDIN_FILENO, &buffer, buffer.count)
        if count < 0 {
          if errno == EINTR { continue }
          fail(.invalidCommand)
          return
        }
        do {
          if count == 0 {
            try decoder.finish()
            end()
            return
          }
          let commands = try decoder.push(Data(buffer.prefix(count)))
          // Mark stop before dispatching the batch, so start+stop never turns capture on.
          if commands.contains(where: { $0.action == .stop }) { requestStop() }
          for command in commands { send(.command(command)) }
        } catch {
          fail(.invalidCommand)
          return
        }
      }
    }
  }
}

/// No queue of transcripts: a slow/disconnected stdout consumer fails closed.
@MainActor
final class ProcessOutput {
  private var failed = false
  private let descriptor: Int32
  init(descriptor: Int32 = STDOUT_FILENO) throws {
    self.descriptor = descriptor
    let flags = fcntl(descriptor, F_GETFL)
    guard flags >= 0, fcntl(descriptor, F_SETFL, flags | O_NONBLOCK) >= 0 else {
      throw HelperFailure(.internal)
    }
  }

  func write(_ event: NativeEvent) throws {
    guard !failed else { throw HelperFailure(.internal) }
    do {
      let frame = try event.encodeLine()
      try frame.withUnsafeBytes { bytes in
        var sent = 0
        while sent < bytes.count {
          let count = Darwin.write(
            descriptor, bytes.baseAddress?.advanced(by: sent), bytes.count - sent)
          if count < 0, errno == EINTR { continue }
          guard count > 0 else { throw HelperFailure(.internal) }
          sent += count
        }
      }
    } catch {
      failed = true
      throw HelperFailure(.internal)
    }
  }
}

/// Each lifecycle operation is bounded even when a service ignores cancellation.
final class OperationDeadline: Sendable {
  private let generation = OSAllocatedUnfairLock(initialState: 0)

  func arm(seconds: Double) {
    let token = generation.withLock { value in
      value += 1
      return value
    }
    DispatchQueue.global().asyncAfter(deadline: .now() + seconds) { [self] in
      if generation.withLock({ $0 == token }) { _exit(2) }
    }
  }

  func cancel() { generation.withLock { $0 += 1 } }
}
