// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "MeetingCopilotNative",
  platforms: [.macOS(.v14)],
  products: [
    .library(name: "MeetingCopilotProtocol", targets: ["MeetingCopilotProtocol"]),
    .executable(name: "MeetingCopilotCapabilities", targets: ["MeetingCopilotCapabilities"]),
    .executable(name: "MeetingCopilotAudioPOC", targets: ["MeetingCopilotAudioPOC"]),
  ],
  targets: [
    .target(name: "MeetingCopilotProtocol"),
    .testTarget(
      name: "MeetingCopilotProtocolTests", dependencies: ["MeetingCopilotProtocol"],
      resources: [.copy("Fixtures")]
    ),
    .executableTarget(name: "MeetingCopilotCapabilities"),
    .executableTarget(name: "MeetingCopilotAudioPOC"),
    .testTarget(name: "MeetingCopilotAudioPOCTests", dependencies: ["MeetingCopilotAudioPOC"]),
    .testTarget(
      name: "MeetingCopilotCapabilitiesTests",
      dependencies: ["MeetingCopilotCapabilities"]
    ),
  ]
)
