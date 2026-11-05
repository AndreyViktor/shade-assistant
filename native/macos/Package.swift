// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "MeetingCopilotNative",
  platforms: [.macOS(.v14)],
  products: [
    .library(name: "MeetingCopilotProtocol", targets: ["MeetingCopilotProtocol"]),
    .executable(name: "MeetingCopilotCapabilities", targets: ["MeetingCopilotCapabilities"]),
    .executable(name: "MeetingCopilotAudioPOC", targets: ["MeetingCopilotAudioPOC"]),
    .executable(name: "MeetingCopilotTranscriber", targets: ["MeetingCopilotTranscriber"]),
  ],
  targets: [
    .target(name: "MeetingCopilotProtocol"),
    .testTarget(
      name: "MeetingCopilotProtocolTests", dependencies: ["MeetingCopilotProtocol"],
      resources: [.copy("Fixtures")]
    ),
    .executableTarget(name: "MeetingCopilotCapabilities"),
    .target(name: "MeetingCopilotAudio"),
    .executableTarget(name: "MeetingCopilotAudioPOC", dependencies: ["MeetingCopilotAudio"]),
    .executableTarget(
      name: "MeetingCopilotTranscriber",
      dependencies: ["MeetingCopilotAudio", "MeetingCopilotProtocol"]),
    .testTarget(
      name: "MeetingCopilotTranscriberTests", dependencies: ["MeetingCopilotTranscriber"]),
    .testTarget(
      name: "MeetingCopilotAudioPOCTests",
      dependencies: ["MeetingCopilotAudioPOC", "MeetingCopilotAudio"]),
    .testTarget(
      name: "MeetingCopilotCapabilitiesTests",
      dependencies: ["MeetingCopilotCapabilities"]
    ),
  ]
)
