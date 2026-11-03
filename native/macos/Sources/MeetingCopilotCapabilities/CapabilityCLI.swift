import Darwin
import Foundation

@main
struct CapabilityCLI {
  static func main() async {
    guard CommandLine.arguments.count == 1 else {
      fail("CAPABILITY_INVALID_ARGUMENTS", status: 64)
    }
    // OS service calls may not cooperate with task cancellation. Bound the diagnostic process.
    DispatchQueue.global().asyncAfter(deadline: .now() + 30) {
      fail("CAPABILITY_TIMEOUT", status: 2)
    }
    let report = await probeCapabilities()
    do {
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
      let data = try encoder.encode(report)
      FileHandle.standardOutput.write(data)
      FileHandle.standardOutput.write(Data([0x0A]))
    } catch {
      fail("CAPABILITY_ENCODING_FAILED", status: 2)
    }
  }

  private static func fail(_ code: String, status: Int32) -> Never {
    FileHandle.standardError.write(Data("\(code)\n".utf8))
    exit(status)
  }
}
