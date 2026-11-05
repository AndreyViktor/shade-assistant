import Foundation

/// Serially owned by the stdin reader. No capture or command lifecycle side effects.
public struct NativeCommandDecoder {
  private var line = Data()
  private var closed = false

  public init() {}

  /// A failure discards this call's batch and permanently closes the decoder.
  public mutating func push(_ chunk: Data) throws -> [NativeCommand] {
    guard !closed else { throw NativeProtocolFailure.closedStream }
    do {
      var commands: [NativeCommand] = []
      for byte in chunk {
        if byte == 10 {
          commands.append(try NativeCommand.decodeLine(line))
          clearLine()
        } else {
          guard line.count < ProtocolLimits.maxLineBytes else {
            throw NativeProtocolFailure.lineTooLarge
          }
          line.append(byte)
        }
      }
      return commands
    } catch {
      close()
      throw error
    }
  }

  /// Clean stdin EOF still requires the helper to release all capture resources (T013).
  public mutating func finish() throws {
    guard !closed else { throw NativeProtocolFailure.closedStream }
    defer { close() }
    guard line.isEmpty else { throw NativeProtocolFailure.truncatedLine }
  }

  private mutating func clearLine() {
    line.resetBytes(in: 0..<line.count)
    line.removeAll(keepingCapacity: true)
  }

  private mutating func close() {
    closed = true
    clearLine()
  }
}
