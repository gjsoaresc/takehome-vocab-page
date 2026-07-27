// Pure parsing logic for the SAT vocab PDF text (as extracted by unpdf).
// Kept free of I/O so the grammar is testable against fixture snippets.

export type Pos = 'v' | 'n' | 'adj' | 'adv'

export interface Sense {
  senseNo: number
  pos: Pos
  definition: string
  example: string | null
}

export interface WordEntry {
  headword: string
  senses: Sense[]
}

export interface SkippedEntry {
  raw: string
  reason: string
}

export interface PosSuspect {
  headword: string
  senseNo: number
  pos: Pos
  definition: string
  hint: string
}

export interface OrderAnomaly {
  headword: string
  previous: string
}

export interface ParseReport {
  totalPosMarkers: number
  parsedWords: number
  parsedSenses: number
  posCounts: Record<Pos, number>
  skipped: SkippedEntry[]
  posSuspects: PosSuspect[]
  orderAnomalies: OrderAnomaly[]
}

const PAGE_FURNITURE = new Set(['SAT Vocabulary', 'The 1000 Most', 'Common SAT', 'Words'])

function normalize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/\u00a0/g, ' ')
}

function cleanPages(pages: string[]): string {
  const kept: string[] = []
  for (const page of pages) {
    for (const line of page.split('\n')) {
      const t = line.trim()
      if (!t || PAGE_FURNITURE.has(t) || /^[A-Z]$/.test(t)) continue
      kept.push(t)
    }
  }
  return normalize(kept.join('\n'))
}

// A pos marker, optionally preceded by a sense number and/or a headword token.
// Headword present + no continuation number => a new entry begins here.
const MARKER_RE = /(?:([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]*)\s+)?(?:(\d)\.\s*)?\((v|n|adj|adv)\.\)/g

const HEADWORD_RE = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]*$/

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Split a sense body into definition + trailing parenthesized example. */
function splitDefinitionExample(body: string): {
  definition: string
  example: string | null
  trailing: string
} {
  // The example is the first "(" opening a capitalized/numbered sentence; it
  // runs to the last ")" of the body. Anything after that ")" is stray text.
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '(') continue
    const next = body[i + 1]
    if (next !== undefined && /[A-Z0-9]/.test(next)) {
      const close = body.lastIndexOf(')')
      if (close > i) {
        return {
          definition: collapse(body.slice(0, i)),
          example: collapse(body.slice(i + 1, close)),
          trailing: collapse(body.slice(close + 1)),
        }
      }
    }
  }
  return { definition: collapse(body), example: null, trailing: '' }
}

function suspectHint(pos: Pos, definition: string): string | null {
  if (pos !== 'v' && /^to /.test(definition)) return 'definition reads like a verb (starts with "to")'
  if (pos === 'adj' && /^(a|an|the|one who|one that|something) /.test(definition))
    return 'definition reads like a noun (starts with an article/"one who")'
  if (pos === 'n' && /^(having|characterized by|marked by|full of|capable of) /.test(definition))
    return 'definition reads like an adjective'
  return null
}

interface RawSense {
  senseNo: number
  pos: Pos
  body: string
}

interface RawEntry {
  headword: string
  senses: RawSense[]
}

export function parseVocab(pages: string[]): { words: WordEntry[]; report: ParseReport } {
  const text = cleanPages(pages)
  const totalPosMarkers = (text.match(/\((v|n|adj|adv)\.\)/g) ?? []).length

  interface Marker {
    headword: string | null
    senseNo: number | null
    pos: Pos
    matchStart: number // where the whole match (incl. headword) begins
    bodyStart: number // right after "(pos.)"
  }
  const markers: Marker[] = []
  for (const m of text.matchAll(MARKER_RE)) {
    markers.push({
      headword: m[1] ?? null,
      senseNo: m[2] !== undefined ? Number(m[2]) : null,
      pos: m[3] as Pos,
      matchStart: m.index,
      bodyStart: m.index + m[0].length,
    })
  }

  const entries: RawEntry[] = []
  const skipped: SkippedEntry[] = []
  const orderAnomalies: OrderAnomaly[] = []
  let current: RawEntry | null = null
  let prevHeadword = ''

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!
    const next = markers[i + 1]
    // The sense body runs to the start of the next marker's own match
    // (excluding that marker's headword token, which belongs to the next entry).
    const bodyEnd = next ? next.matchStart : text.length
    const body = text.slice(marker.bodyStart, bodyEnd)

    const startsEntry =
      marker.headword !== null && (marker.senseNo === null || marker.senseNo === 1)

    if (startsEntry) {
      const headword = marker.headword!
      if (HEADWORD_RE.test(headword) && headword.length >= 2) {
        // The source list is nominally alphabetical; violations are genuine
        // bad data (e.g. "covert" printed after "covet") worth reporting.
        if (
          prevHeadword &&
          headword.toLowerCase().localeCompare(prevHeadword.toLowerCase()) < 0
        ) {
          orderAnomalies.push({ headword, previous: prevHeadword })
        }
        current = { headword, senses: [{ senseNo: marker.senseNo ?? 1, pos: marker.pos, body }] }
        entries.push(current)
        prevHeadword = headword
        continue
      }
      skipped.push({
        raw: collapse(text.slice(marker.matchStart, Math.min(bodyEnd, marker.matchStart + 160))),
        reason: `rejected headword candidate "${headword}" (fails shape check)`,
      })
      // Fall through: treat as continuation of the current entry if one exists.
    }

    if (current) {
      current.senses.push({
        senseNo: marker.senseNo ?? current.senses.length + 1,
        pos: marker.pos,
        body,
      })
    } else {
      skipped.push({
        raw: collapse(text.slice(marker.matchStart, Math.min(bodyEnd, marker.matchStart + 160))),
        reason: 'sense marker before any recognizable entry',
      })
    }
  }

  // Text before the first marker that survived cleaning but matched nothing.
  const preamble = markers.length > 0 ? collapse(text.slice(0, markers[0]!.matchStart)) : collapse(text)
  if (preamble) {
    // Strip a trailing headword token: it belongs to the first entry.
    const stripped = markers[0]?.headword
      ? preamble.replace(new RegExp(`${markers[0].headword}$`), '').trim()
      : preamble
    if (stripped) skipped.push({ raw: stripped, reason: 'no part-of-speech marker found' })
  }

  const words: WordEntry[] = []
  const posSuspects: PosSuspect[] = []
  const posCounts: Record<Pos, number> = { v: 0, n: 0, adj: 0, adv: 0 }
  let parsedSenses = 0

  for (const entry of entries) {
    const senses: Sense[] = []
    for (const raw of entry.senses) {
      const { definition, example, trailing } = splitDefinitionExample(raw.body)
      if (trailing.length > 3) {
        skipped.push({
          raw: trailing.slice(0, 160),
          reason: `trailing text after the example of "${entry.headword}" (no pos marker)`,
        })
      }
      if (!definition) {
        skipped.push({
          raw: collapse(`${entry.headword} (${raw.pos}.) ${raw.body}`).slice(0, 160),
          reason: 'empty definition',
        })
        continue
      }
      senses.push({ senseNo: raw.senseNo, pos: raw.pos, definition, example })
      posCounts[raw.pos]++
      parsedSenses++
      const hint = suspectHint(raw.pos, definition)
      if (hint) {
        posSuspects.push({
          headword: entry.headword,
          senseNo: raw.senseNo,
          pos: raw.pos,
          definition,
          hint,
        })
      }
    }
    if (senses.length > 0) words.push({ headword: entry.headword, senses })
    else
      skipped.push({
        raw: entry.headword,
        reason: 'entry lost all senses during parsing',
      })
  }

  return {
    words,
    report: {
      totalPosMarkers,
      parsedWords: words.length,
      parsedSenses,
      posCounts,
      skipped,
      posSuspects,
      orderAnomalies,
    },
  }
}

function sqlString(value: string | null): string {
  if (value === null) return 'NULL'
  return `'${value.replace(/'/g, "''")}'`
}

export function toSeedSql(words: WordEntry[]): string {
  const wordRows: string[] = []
  const senseRows: string[] = []
  let senseId = 0
  words.forEach((word, i) => {
    const wordId = i + 1
    wordRows.push(`  (${wordId}, ${sqlString(word.headword)})`)
    for (const sense of word.senses) {
      senseId++
      senseRows.push(
        `  (${senseId}, ${wordId}, ${sense.senseNo}, '${sense.pos}', ${sqlString(sense.definition)}, ${sqlString(sense.example)})`,
      )
    }
  })
  return [
    '-- Generated by packages/db/src/parse-pdf.ts from sat.vocab.pdf. Do not edit by hand.',
    'BEGIN;',
    'INSERT INTO words (id, headword) OVERRIDING SYSTEM VALUE VALUES',
    wordRows.join(',\n') + ';',
    'INSERT INTO senses (id, word_id, sense_no, pos, definition, example) OVERRIDING SYSTEM VALUE VALUES',
    senseRows.join(',\n') + ';',
    "SELECT setval(pg_get_serial_sequence('words', 'id'), (SELECT MAX(id) FROM words));",
    "SELECT setval(pg_get_serial_sequence('senses', 'id'), (SELECT MAX(id) FROM senses));",
    'COMMIT;',
    '',
  ].join('\n')
}
