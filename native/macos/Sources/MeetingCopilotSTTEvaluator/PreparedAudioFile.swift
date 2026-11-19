import AVFoundation
import Foundation

@available(macOS 26.0, *)
struct PreparedAudioFile {
  let file: AVAudioFile
  let originalURL: URL
  let extractedAudio: Bool
  private let temporaryURL: URL?

  static func open(_ url: URL) async throws -> PreparedAudioFile {
    if let file = try? AVAudioFile(forReading: url) {
      return PreparedAudioFile(
        file: file, originalURL: url, extractedAudio: false, temporaryURL: nil)
    }

    let asset = AVURLAsset(url: url)
    let tracks: [AVAssetTrack]
    do { tracks = try await asset.loadTracks(withMediaType: .audio) } catch {
      throw EvaluationFailure.mediaUnreadable
    }
    guard !tracks.isEmpty else { throw EvaluationFailure.mediaUnreadable }
    let temporaryURL = FileManager.default.temporaryDirectory.appendingPathComponent(
      "meeting-copilot-stt-eval-\(UUID().uuidString).m4a")
    guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A)
    else { throw EvaluationFailure.mediaUnreadable }
    do {
      try await exporter.export(to: temporaryURL, as: .m4a)
      let file = try AVAudioFile(forReading: temporaryURL)
      return PreparedAudioFile(
        file: file, originalURL: url, extractedAudio: true, temporaryURL: temporaryURL)
    } catch {
      try? FileManager.default.removeItem(at: temporaryURL)
      throw EvaluationFailure.mediaUnreadable
    }
  }

  func cleanup() {
    if let temporaryURL { try? FileManager.default.removeItem(at: temporaryURL) }
  }
}
