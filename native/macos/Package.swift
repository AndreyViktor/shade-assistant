// swift-tools-version: 6.2
import PackageDescription

let package = Package(
  name: "MeetingCopilotNative",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "MeetingCopilotCapabilities", targets: ["MeetingCopilotCapabilities"])
  ],
  targets: [
    .executableTarget(name: "MeetingCopilotCapabilities"),
    .testTarget(
      name: "MeetingCopilotCapabilitiesTests",
      dependencies: ["MeetingCopilotCapabilities"]
    ),
  ]
)
