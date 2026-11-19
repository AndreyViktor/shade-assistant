import AVFoundation
import Darwin
import Foundation

@main
enum CreateSTTEvaluationVideo {
  static func main() async {
    guard CommandLine.arguments.count == 4 else {
      fail("usage: create-stt-evaluation-video VIDEO_TEMPLATE AUDIO OUTPUT_MOV")
    }
    let templateURL = URL(fileURLWithPath: CommandLine.arguments[1])
    let audioURL = URL(fileURLWithPath: CommandLine.arguments[2])
    let outputURL = URL(fileURLWithPath: CommandLine.arguments[3])
    do {
      let videoAsset = AVURLAsset(url: templateURL)
      let audioAsset = AVURLAsset(url: audioURL)
      guard let videoTrack = try await videoAsset.loadTracks(withMediaType: .video).first,
        let audioTrack = try await audioAsset.loadTracks(withMediaType: .audio).first
      else { fail("STT_EVAL_VIDEO_TRACK_MISSING") }
      let audioDuration = try await audioAsset.load(.duration)
      let videoDuration = try await videoAsset.load(.duration)
      guard videoDuration >= audioDuration else { fail("STT_EVAL_VIDEO_TEMPLATE_TOO_SHORT") }

      let composition = AVMutableComposition()
      guard
        let compositionVideo = composition.addMutableTrack(
          withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
        let compositionAudio = composition.addMutableTrack(
          withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
      else { fail("STT_EVAL_VIDEO_COMPOSITION_FAILED") }
      let timeRange = CMTimeRange(start: .zero, duration: audioDuration)
      try compositionVideo.insertTimeRange(timeRange, of: videoTrack, at: .zero)
      try compositionAudio.insertTimeRange(timeRange, of: audioTrack, at: .zero)

      guard
        let exporter = AVAssetExportSession(
          asset: composition, presetName: AVAssetExportPresetHighestQuality)
      else { fail("STT_EVAL_VIDEO_EXPORT_UNAVAILABLE") }
      try await exporter.export(to: outputURL, as: .mov)
      print("STT_EVAL_SYNTHETIC_AUDIO_VIDEO_CREATED")
    } catch {
      fail("STT_EVAL_VIDEO_CREATION_FAILED")
    }
  }

  private static func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    exit(2)
  }
}
