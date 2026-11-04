import Darwin
import Foundation

// Diagnostic records for the standalone trial, NOT the T012 Electron protocol.
struct TrialRecord: Encodable {
  let trialVersion = 1
  let event: String
  let source: String?
  let locale: String?
  let segment: Int?
  let isFinal: Bool?
  let audioStartSeconds: Double?
  let audioEndSeconds: Double?
  let characters: Int?
  let text: String?
  let timestamp = Date().ISO8601Format()

  init(
    event: String, source: AudioSource? = nil, locale: String? = nil,
    segment: Int? = nil, isFinal: Bool? = nil, start: Double? = nil, end: Double? = nil,
    recognizedText: String? = nil, showText: Bool = false
  ) {
    self.event = event
    self.source = source?.rawValue
    self.locale = locale
    self.segment = segment
    self.isFinal = isFinal
    self.audioStartSeconds = start.flatMap { $0.isFinite ? $0 : nil }
    self.audioEndSeconds = end.flatMap { $0.isFinite ? $0 : nil }
    self.characters = recognizedText?.count
    self.text = showText ? recognizedText : nil
  }
}

@MainActor
final class TrialOutput {
  private(set) var finals: [AudioSource: Int] = [:]
  private(set) var partials: [AudioSource: Int] = [:]

  func emit(_ record: TrialRecord) {
    if let sourceName = record.source, let source = AudioSource(rawValue: sourceName) {
      if record.isFinal == true { finals[source, default: 0] += 1 }
      if record.isFinal == false { partials[source, default: 0] += 1 }
    }
    let data: Data
    do { data = try JSONEncoder().encode(record) } catch {
      FileHandle.standardError.write(Data("POC_OUTPUT_ENCODING_FAILED\n".utf8))
      exit(2)
    }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([10]))
  }

  func status(_ event: String) { emit(TrialRecord(event: event)) }

  func summary() {
    for source in AudioSource.allCases {
      status(
        "SUMMARY_\(source.rawValue)_finals=\(finals[source, default: 0])_partials=\(partials[source, default: 0])"
      )
    }
  }
}
