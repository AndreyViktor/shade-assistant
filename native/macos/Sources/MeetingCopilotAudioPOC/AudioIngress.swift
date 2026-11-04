import AVFoundation
import Foundation
import Speech

// Apple callbacks arrive on non-actor queues. The lock owns converter/closed state;
// each yielded PCM buffer is newly allocated and never mutated after transfer.
@available(macOS 26.0, *)
final class AudioIngress: @unchecked Sendable {
  let inputs: AsyncStream<AnalyzerInput>
  private let continuation: AsyncStream<AnalyzerInput>.Continuation
  private let format: AVAudioFormat
  private let lock = NSLock()
  private var converter: AVAudioConverter?
  private var closed = false
  private var frames: Int64 = 0
  private var buffers = 0
  private let failure: @Sendable (TrialFailure) -> Void

  init(format: AVAudioFormat, failure: @escaping @Sendable (TrialFailure) -> Void) {
    self.format = format
    self.failure = failure
    (inputs, continuation) = AsyncStream.makeStream(bufferingPolicy: .bufferingOldest(32))
  }

  func receive(_ buffer: AVAudioPCMBuffer) {
    let error: TrialFailure? = lock.withLock {
      guard !closed else { return nil }
      do {
        guard buffer.frameLength > 0, buffer.format.sampleRate > 0,
          Double(buffer.frameLength) <= buffer.format.sampleRate * 2
        else {
          throw TrialFailure.audioFormat
        }
        if converter?.inputFormat != buffer.format {
          converter = AVAudioConverter(from: buffer.format, to: format)
        }
        guard let converter else { throw TrialFailure.audioFormat }
        let capacity =
          AVAudioFrameCount(
            ceil(Double(buffer.frameLength) * format.sampleRate / buffer.format.sampleRate)) + 256
        guard let converted = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
          throw TrialFailure.audioFormat
        }
        let input = ConversionInput(buffer: buffer)
        var conversionError: NSError?
        let status = converter.convert(to: converted, error: &conversionError) { _, inputStatus in
          let next = input.take()
          inputStatus.pointee = next == nil ? .noDataNow : .haveData
          return next
        }
        guard status != .error, conversionError == nil else { throw TrialFailure.audioFormat }
        guard converted.frameLength > 0 else { return nil }
        let time = CMTime(value: frames, timescale: CMTimeScale(format.sampleRate))
        frames += Int64(converted.frameLength)
        buffers += 1
        switch continuation.yield(AnalyzerInput(buffer: converted, bufferStartTime: time)) {
        case .enqueued: return nil
        case .terminated: return nil
        case .dropped: throw TrialFailure.audioOverflow
        @unknown default: throw TrialFailure.audioOverflow
        }
      } catch {
        closed = true
        continuation.finish()
        return (error as? TrialFailure) ?? .audioFormat
      }
    }
    if let error { failure(error) }
  }

  func statistics() -> (buffers: Int, seconds: Double) {
    lock.withLock { (buffers, Double(frames) / format.sampleRate) }
  }

  func finish() {
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
