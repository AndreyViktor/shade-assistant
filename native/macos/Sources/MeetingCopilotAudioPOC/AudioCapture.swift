import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

@MainActor
protocol AudioCapture: AnyObject {
  func start() async throws
  func stop() async throws
}

// AVAudioEngine invokes the tap on an audio queue, independently of MainActor.
@available(macOS 26.0, *)
func makeMicrophoneTap(ingress: AudioIngress) -> @Sendable (AVAudioPCMBuffer, AVAudioTime) -> Void {
  { @Sendable buffer, _ in ingress.receive(buffer) }
}

@available(macOS 26.0, *)
@MainActor
final class MicrophoneCapture: AudioCapture {
  private let engine = AVAudioEngine()
  private let ingress: AudioIngress
  private var tapped = false

  init(ingress: AudioIngress) { self.ingress = ingress }

  func start() async throws {
    guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else {
      throw TrialFailure.microphoneDenied
    }
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else { throw TrialFailure.audioFormat }
    input.installTap(
      onBus: 0, bufferSize: 1024, format: format, block: makeMicrophoneTap(ingress: ingress))
    tapped = true
    do {
      try engine.start()
    } catch {
      try await stop()
      throw TrialFailure.capture
    }
  }

  func stop() async throws {
    engine.stop()
    if tapped { engine.inputNode.removeTap(onBus: 0) }
    tapped = false
    ingress.finish()
  }
}

@available(macOS 26.0, *)
@MainActor
final class SystemCapture: AudioCapture {
  private var stream: SCStream?
  private let receiver: SystemAudioReceiver

  init(ingress: AudioIngress, failure: @escaping @Sendable (TrialFailure) -> Void) {
    receiver = SystemAudioReceiver(ingress: ingress, failure: failure)
  }

  func start() async throws {
    // Only called after the CLI's explicit manual --capture command and warning.
    let content = try await SCShareableContent.excludingDesktopWindows(
      false, onScreenWindowsOnly: true)
    guard let display = content.displays.first else { throw TrialFailure.systemDenied }
    let filter = SCContentFilter(display: display, excludingApplications: [], exceptingWindows: [])
    let config = SCStreamConfiguration()
    config.capturesAudio = true
    config.captureMicrophone = false
    config.excludesCurrentProcessAudio = true
    config.sampleRate = 48_000
    config.channelCount = 2
    // No .screen output is registered; no images are received, persisted or sent.
    config.width = 2
    config.height = 2
    config.minimumFrameInterval = CMTime(value: 1, timescale: 1)
    let stream = SCStream(filter: filter, configuration: config, delegate: receiver)
    self.stream = stream
    try stream.addStreamOutput(receiver, type: .audio, sampleHandlerQueue: receiver.queue)
    try await stream.startCapture()
  }

  func stop() async throws {
    receiver.ingress.finish()
    guard let stream else { return }
    self.stream = nil
    try await stream.stopCapture()
  }
}

@available(macOS 26.0, *)
private final class SystemAudioReceiver: NSObject, SCStreamOutput, SCStreamDelegate, Sendable {
  let ingress: AudioIngress
  let queue = DispatchQueue(label: "MeetingCopilotPOC.system")
  let failure: @Sendable (TrialFailure) -> Void

  init(ingress: AudioIngress, failure: @escaping @Sendable (TrialFailure) -> Void) {
    self.ingress = ingress
    self.failure = failure
  }

  func stream(_ stream: SCStream, didStopWithError error: any Error) { failure(.capture) }

  func stream(
    _ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
    of type: SCStreamOutputType
  ) {
    guard type == .audio, sampleBuffer.isValid, CMSampleBufferDataIsReady(sampleBuffer) else {
      return
    }
    guard let description = sampleBuffer.formatDescription else {
      failure(.audioFormat)
      return
    }
    let format = AVAudioFormat(cmAudioFormatDescription: description)
    let count = CMSampleBufferGetNumSamples(sampleBuffer)
    guard count > 0, count <= 96_000,
      let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))
    else {
      failure(.audioFormat)
      return
    }
    buffer.frameLength = AVAudioFrameCount(count)
    let status = CMSampleBufferCopyPCMDataIntoAudioBufferList(
      sampleBuffer, at: 0, frameCount: Int32(count), into: buffer.mutableAudioBufferList)
    guard status == noErr else {
      failure(.audioFormat)
      return
    }
    ingress.receive(buffer)
  }
}
