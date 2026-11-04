import AVFoundation
import Speech
import Synchronization
import Testing

@testable import MeetingCopilotAudioPOC

@available(macOS 26.0, *)
private func silence(sampleRate: Double = 48_000) throws -> AVAudioPCMBuffer {
  let format = try #require(AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1))
  let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 1024))
  buffer.frameLength = 1024
  let channels = try #require(buffer.floatChannelData)
  channels[0].update(repeating: 0, count: 1024)
  return buffer
}

@Test @MainActor @available(macOS 26.0, *)
func microphoneTapAcceptsAudioFromBackgroundQueue() async throws {
  let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1))
  let errors = Mutex<[TrialFailure]>([])
  let ingress = AudioIngress(format: format) { error in errors.withLock { $0.append(error) } }
  let tap = makeMicrophoneTap(ingress: ingress)

  try await Task.detached {
    let buffer = try silence()
    tap(buffer, AVAudioTime(sampleTime: 0, atRate: 48_000))
  }.value

  ingress.finish()
  var received = 0
  for await _ in ingress.inputs { received += 1 }
  #expect(received == 1)
  #expect(errors.withLock { $0.isEmpty })
}

@Test @available(macOS 26.0, *)
func conversionOwnsBuffersAndFinishRejectsLateAudio() async throws {
  let errors = Mutex<[TrialFailure]>([])
  let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1))
  let ingress = AudioIngress(format: format) { error in errors.withLock { $0.append(error) } }
  let input = try silence()
  ingress.receive(input)
  ingress.finish()
  ingress.receive(input)
  var count = 0
  for await item in ingress.inputs {
    #expect(item.buffer.format.sampleRate == 16_000)
    #expect(item.buffer.frameLength > 0)
    #expect(item.buffer !== input)
    count += 1
  }
  #expect(count == 1)
  #expect(errors.withLock { $0.isEmpty })
}

@Test @available(macOS 26.0, *)
func slowConsumerFailsClosedWithBoundedQueue() async throws {
  let errors = Mutex<[TrialFailure]>([])
  let input = try silence()
  let ingress = AudioIngress(format: input.format) { error in errors.withLock { $0.append(error) } }
  for _ in 0..<100 { ingress.receive(input) }
  ingress.finish()
  var count = 0
  for await _ in ingress.inputs { count += 1 }
  #expect(count == 32)
  #expect(errors.withLock { $0 } == [.audioOverflow])
}

@Test @available(macOS 26.0, *)
func sourceClocksAreIndependentAndMonotonic() async throws {
  let input = try silence()
  let first = AudioIngress(format: input.format) { _ in Issue.record("Unexpected conversion error")
  }
  let second = AudioIngress(format: input.format) { _ in Issue.record("Unexpected conversion error")
  }
  first.receive(input)
  first.receive(input)
  second.receive(input)
  first.finish()
  second.finish()
  var firstTimes: [Double] = []
  for await item in first.inputs { firstTimes.append(try #require(item.bufferStartTime).seconds) }
  var secondTimes: [Double] = []
  for await item in second.inputs { secondTimes.append(try #require(item.bufferStartTime).seconds) }
  #expect(firstTimes.count == 2)
  #expect(firstTimes[0] == 0)
  #expect(firstTimes[1] > firstTimes[0])
  #expect(secondTimes == [0])
  #expect(first.statistics().buffers == 2)
  #expect(second.statistics().buffers == 1)
}

@Test @available(macOS 26.0, *)
func invalidBufferFailsOnceAndRejectsSubsequentInput() throws {
  let errors = Mutex<[TrialFailure]>([])
  let input = try silence()
  let ingress = AudioIngress(format: input.format) { error in errors.withLock { $0.append(error) } }
  input.frameLength = 0
  ingress.receive(input)
  input.frameLength = 1024
  ingress.receive(input)
  #expect(errors.withLock { $0 } == [.audioFormat])
  #expect(ingress.statistics().buffers == 0)
}
