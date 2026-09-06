/**
 * Reading a CSV file.
 *
 * Writing one is easy and lives in attendanceExport.ts. Reading one is
 * where the trouble is, because the file arrives from somebody else's
 * spreadsheet and will contain things a naive `split(',')` gets wrong:
 *
 *   - a comma inside a quoted field — "27 Acme Road, Agidingbi"
 *   - a line break inside a quoted field, which Excel produces whenever
 *     somebody presses Alt+Enter in a cell
 *   - a doubled quote standing for a literal one
 *   - a UTF-8 byte-order mark at the very start, which Excel writes and
 *     which would otherwise become part of the first column heading, so
 *     that "First name" silently stops matching
 *   - CRLF, LF, or a mixture
 *
 * Every one of those produces a file that looks fine and imports wrongly,
 * which is the failure this task can least afford: the whole point of a
 * preview is that what it shows is what will happen.
 *
 * This is a parser for RFC 4180 as Excel actually writes it, in one pass,
 * with no dependency.
 */

/**
 * Split a CSV document into rows of fields.
 *
 * Returns raw strings. Nothing is trimmed, coerced or interpreted here —
 * that belongs to whatever knows what the columns mean.
 */
export function parseCsv(text: string): string[][] {
  // The BOM, if Excel left one. Stripping it here rather than in the
  // caller means every consumer of this function is protected from it.
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let index = 0

  /** A field ends. */
  const endField = () => {
    row.push(field)
    field = ''
  }

  /** A row ends. */
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (index < source.length) {
    const char = source[index]

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (source[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        quoted = false
        index += 1
        continue
      }
      // Anything else inside quotes is literal, line breaks included.
      field += char
      index += 1
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
      index += 1
      continue
    }

    if (char === ',') {
      endField()
      index += 1
      continue
    }

    if (char === '\r') {
      // CRLF and a lone CR both end the row. Excel on Windows writes the
      // first; some older exports write the second.
      endRow()
      index += source[index + 1] === '\n' ? 2 : 1
      continue
    }

    if (char === '\n') {
      endRow()
      index += 1
      continue
    }

    field += char
    index += 1
  }

  // Whatever is left when the text runs out is the last field of the
  // last row — unless the file ended with a line break, in which case
  // there is nothing pending and appending would invent a blank row.
  if (field !== '' || row.length > 0) endRow()

  // Rows that are entirely empty are dropped. A spreadsheet saved with
  // trailing blank lines is completely ordinary, and every one of them
  // would otherwise arrive as a row with no name in it and be reported
  // to the user as an error they did not make.
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}
