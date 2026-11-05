import AVFoundation
import Foundation
import Speech

// Apple callbacks arrive on non-actor queues. The lock owns converter/closed state;
// each yielded PCM buffer is newly allocated and never mutated after transfer.
@available(macOS 26.0, *)
public final class AudioIngress: @unchecked Sendable {
  public let inputs: AsyncStream<AnalyzerInput>
  private let continuation: AsyncStream<AnalyzerInput>.Continuation
  private let format: AVAudioFormat
  private let lock = NSLock()
  private var converter: AVAudioConverter?
  private var closed = false
  private var frames: Int64 = 0
  private var buffers = 0
  private let failure: @Sendable (AudioFailure) -> Void

  public init(format: AVAudioFormat, failure: @escaping @Sendable (AudioFailure) -> Void) {
    self.format = format
    self.failure = failure
    (inputs, continuation) = AsyncStream.makeStream(bufferingPolicy: .bufferingOldest(32))
  }

  public func receive(_ buffer: AVAudioPCMBuffer) {
    let error: AudioFailure? = lock.withLock {
      guard !closed else { return nil }
      do {
        guard buffer.frameLength > 0, buffer.format.sampleRate > 0,
          Double(buffer.frameLength) <= buffer.format.sampleRate * 2
        else {
          throw AudioFailure.audioFormat
        }
        if converter?.inputFormat != buffer.format {
          converter = AVAudioConverter(from: buffer.format, to: format)
        }
        guard let converter else { throw AudioFailure.audioFormat }
        let capacity =
          AVAudioFrameCount(
            ceil(Double(buffer.frameLength) * format.sampleRate / buffer.format.sampleRate)) + 256
        guard let converted = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
          throw AudioFailure.audioFormat
        }
        let input = ConversionInput(buffer: buffer)
        var conversionError: NSError?
        let status = converter.convert(to: converted, error: &conversionError) { _, inputStatus in
          let next = input.take()
          inputStatus.pointee = next == nil ? .noDataNow : .haveData
          return next
        }
        guard status != .error, conversionError == nil else { throw AudioFailure.audioFormat }
        guard converted.frameLength > 0 else { return nil }
        let time = CMTime(value: frames, timescale: CMTimeScale(format.sampleRate))
        frames += Int64(converted.frameLength)
        buffers += 1
        switch continuation.yield(AnalyzerInput(buffer: converted, bufferStartTime: time)) {
        case .enqueued: return nil
        case .terminated: return nil
        case .dropped: throw AudioFailure.audioOverflow
        @unknown default: throw AudioFailure.audioOverflow
        }
      } catch {
        closed = true
        continuation.finish()
        return (error as? AudioFailure) ?? .audioFormat
      }
    }
    if let error { failure(error) }
  }

  public func statistics() -> (buffers: Int, seconds: Double) {
    lock.withLock { (buffers, Double(frames) / format.sampleRate) }
  }

  public func finish() {
    lock.withLock {
      closed = true
      converter = nil
      continuation.finish()
    }
  }
}

// AVAudioConverter calls its input block synchronously during convert(). This
// borrowed input remains valid until receive() returns; it is never mutated here.
// The lock also makes the one-shot supply safe under the SDK's @Sendable signature.
private final class ConversionInput: @unchecked Sendable {
  private let buffer: AVAudioPCMBuffer
  private let lock = NSLock()
  private var supplied = false

  init(buffer: AVAudioPCMBuffer) { self.buffer = buffer }

  func take() -> AVAudioPCMBuffer? {
    lock.withLock {
      guard !supplied else { return nil }
      supplied = true
      return buffer
    }
  }
}
