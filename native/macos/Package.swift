// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "MeetingCopilotNative",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "MeetingCopilotCapabilities", targets: ["MeetingCopilotCapabilities"]),
    .executable(name: "MeetingCopilotAudioPOC", targets: ["MeetingCopilotAudioPOC"]),
  ],
  targets: [
    .executableTarget(name: "MeetingCopilotCapabilities"),
    .executableTarget(name: "MeetingCopilotAudioPOC"),
    .testTarget(name: "MeetingCopilotAudioPOCTests", dependencies: ["MeetingCopilotAudioPOC"]),
    .testTarget(
      name: "MeetingCopilotCapabilitiesTests",
      dependencies: ["MeetingCopilotCapabilities"]
    ),
  ]
)
