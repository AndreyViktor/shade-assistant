public enum AudioFailure: Error, Sendable {
  case microphoneDenied, systemDenied, audioFormat, audioOverflow, capture
}
