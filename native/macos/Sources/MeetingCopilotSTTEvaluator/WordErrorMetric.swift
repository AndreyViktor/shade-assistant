import Foundation

struct WordErrorMetric: Codable, Equatable {
  let referenceWords: Int
  let hypothesisWords: Int
  let substitutions: Int
  let deletions: Int
  let insertions: Int
  let errors: Int
  let wordErrorRate: Double

  static func evaluate(reference: String, hypothesis: String) -> WordErrorMetric {
    let reference = normalizedWords(reference)
    let hypothesis = normalizedWords(hypothesis)
    var matrix = Array(
      repeating: Array(repeating: Edit.zero, count: hypothesis.count + 1),
      count: reference.count + 1)

    for row in reference.indices {
      let distance = row + 1
      matrix[distance][0] = Edit(
        cost: distance, substitutions: 0, deletions: distance, insertions: 0)
    }
    for column in hypothesis.indices {
      let distance = column + 1
      matrix[0][distance] = Edit(
        cost: distance, substitutions: 0, deletions: 0, insertions: distance)
    }
    if !reference.isEmpty, !hypothesis.isEmpty {
      for row in 1...reference.count {
        for column in 1...hypothesis.count {
          if reference[row - 1] == hypothesis[column - 1] {
            matrix[row][column] = matrix[row - 1][column - 1]
          } else {
            let substitution = matrix[row - 1][column - 1].adding(substitution: 1)
            let deletion = matrix[row - 1][column].adding(deletion: 1)
            let insertion = matrix[row][column - 1].adding(insertion: 1)
            matrix[row][column] = [substitution, deletion, insertion].min() ?? substitution
          }
        }
      }
    }
    let edit = matrix[reference.count][hypothesis.count]
    let errors = edit.substitutions + edit.deletions + edit.insertions
    let rate =
      reference.isEmpty
      ? (hypothesis.isEmpty ? 0 : 1) : Double(errors) / Double(reference.count)
    return WordErrorMetric(
      referenceWords: reference.count, hypothesisWords: hypothesis.count,
      substitutions: edit.substitutions, deletions: edit.deletions,
      insertions: edit.insertions, errors: errors, wordErrorRate: rate)
  }

  static func normalizedWords(_ text: String) -> [String] {
    let lowered = text.precomposedStringWithCanonicalMapping.lowercased(
      with: Locale(identifier: "pt-BR"))
    let normalized = lowered.unicodeScalars.map { scalar -> Character in
      CharacterSet.alphanumerics.contains(scalar) ? Character(String(scalar)) : " "
    }
    return String(normalized).split(whereSeparator: \.isWhitespace).map(String.init)
  }
}

private struct Edit: Comparable {
  static let zero = Edit(cost: 0, substitutions: 0, deletions: 0, insertions: 0)
  let cost: Int
  let substitutions: Int
  let deletions: Int
  let insertions: Int

  func adding(substitution: Int = 0, deletion: Int = 0, insertion: Int = 0) -> Edit {
    Edit(
      cost: cost + substitution + deletion + insertion,
      substitutions: substitutions + substitution, deletions: deletions + deletion,
      insertions: insertions + insertion)
  }

  static func < (lhs: Edit, rhs: Edit) -> Bool {
    (lhs.cost, lhs.substitutions, lhs.deletions, lhs.insertions)
      < (rhs.cost, rhs.substitutions, rhs.deletions, rhs.insertions)
  }
}
