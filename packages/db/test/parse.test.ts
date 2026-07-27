import { describe, expect, it } from 'vitest'
import { parseVocab, toSeedSql } from '../src/vocab-parser'

// Fixtures mirror real unpdf extraction output (line-wrapped, page furniture,
// curly quotes). Expected values are hand-derived from the PDF text.

const PAGE_ONE = [
  'SAT Vocabulary',
  'The 1000 Most',
  'Common SAT',
  'Words',
  'A',
  'abase (v.) to humiliate, degrade (After being overthrown and abased, the deposed',
  'leader offered to bow down to his conqueror.)',
  'abate (v.) to reduce, lessen (The rain poured down for a while, then abated.)',
].join('\n')

const MULTI_SENSE_PAGE = [
  'SAT Vocabulary',
  'A',
  'abide 1. (v.) to put up with (Though he did not agree with the decision, Chuck decided',
  'to abide by it.) 2. (v.) to remain (Despite the beating they’ve taken from the weather',
  'throughout the millennia, the mountains abide.)',
].join('\n')

describe('parseVocab', () => {
  it('parses a simple entry and joins wrapped lines', () => {
    const { words, report } = parseVocab([PAGE_ONE])
    expect(words).toHaveLength(2)
    const abase = words[0]!
    expect(abase.headword).toBe('abase')
    expect(abase.senses).toHaveLength(1)
    expect(abase.senses[0]!.pos).toBe('v')
    expect(abase.senses[0]!.definition).toBe('to humiliate, degrade')
    expect(abase.senses[0]!.example).toBe(
      'After being overthrown and abased, the deposed leader offered to bow down to his conqueror.',
    )
    expect(report.skipped).toHaveLength(0)
  })

  it('strips page furniture (headers, section letters, title block)', () => {
    const { words } = parseVocab([PAGE_ONE])
    const headwords = words.map((w) => w.headword)
    expect(headwords).not.toContain('A')
    expect(headwords).not.toContain('Words')
    expect(headwords).toEqual(['abase', 'abate'])
  })

  it('splits numbered senses into separate rows with sense_no', () => {
    const { words } = parseVocab([MULTI_SENSE_PAGE])
    expect(words).toHaveLength(1)
    const abide = words[0]!
    expect(abide.headword).toBe('abide')
    expect(abide.senses).toHaveLength(2)
    expect(abide.senses[0]!.senseNo).toBe(1)
    expect(abide.senses[0]!.definition).toBe('to put up with')
    expect(abide.senses[1]!.senseNo).toBe(2)
    expect(abide.senses[1]!.definition).toBe('to remain')
  })

  it('normalizes curly quotes to ASCII apostrophes', () => {
    const { words } = parseVocab([MULTI_SENSE_PAGE])
    expect(words[0]!.senses[1]!.example).toContain("they've taken")
  })

  it('handles a multi-sense entry with differing pos per sense', () => {
    const page = [
      'abridge 1. (v.) to cut down, shorten (The publisher thought the dictionary was too long',
      'and abridged it.) 2. (adj.) shortened (Moby-Dick is such a long book that even the',
      'abridged version is longer than most normal books.)',
    ].join('\n')
    const { words } = parseVocab([page])
    expect(words[0]!.senses.map((s) => s.pos)).toEqual(['v', 'adj'])
  })

  it('flags pos suspects when the definition shape contradicts the label', () => {
    const page = [
      'bogus (n.) to trick or deceive (He bogused his way into the party.)',
      'phony (adj.) a person who pretends (The phony fooled everyone.)',
    ].join('\n')
    const { report } = parseVocab([page])
    const suspects = report.posSuspects.map((s) => s.headword)
    expect(suspects).toContain('bogus')
    expect(suspects).toContain('phony')
  })

  it('keeps out-of-alphabetical-order words but reports them as order anomalies', () => {
    // Real case from the PDF: "covert" appears after "covet" in the source.
    const page = [
      'covet (v.) to desire enviously (I coveted his house.)',
      'covert (adj.) secretly engaged in (Nerwin waged a covert campaign.)',
    ].join('\n')
    const { words, report } = parseVocab([page])
    expect(words.map((w) => w.headword)).toEqual(['covet', 'covert'])
    expect(report.orderAnomalies).toEqual([{ headword: 'covert', previous: 'covet' }])
  })

  it('parses headwords with accented characters (façade)', () => {
    const page = [
      "façade 1. (n.) the wall of a building (Meet me in front of the museum's main façade.) 2.",
      '(n.) a deceptive appearance or attitude (Despite my smiling façade, I am pessimistic.)',
    ].join('\n')
    const { words, report } = parseVocab([page])
    expect(words).toHaveLength(1)
    expect(words[0]!.headword).toBe('façade')
    expect(words[0]!.senses).toHaveLength(2)
    expect(report.skipped).toHaveLength(0)
  })

  it('skips unparseable blocks and reports them with raw text', () => {
    const page = [
      'abase (v.) to humiliate, degrade (After the coup, he was abased.)',
      'garbled fragment with no part of speech marker at all',
    ].join('\n')
    const { words, report } = parseVocab([page])
    expect(words).toHaveLength(1)
    expect(report.skipped).toHaveLength(1)
    expect(report.skipped[0]!.raw).toContain('garbled fragment')
  })

  it('reports per-pos counts and reconciles marker totals', () => {
    const { report } = parseVocab([PAGE_ONE, MULTI_SENSE_PAGE])
    expect(report.posCounts['v']).toBe(4)
    expect(report.totalPosMarkers).toBe(4)
    expect(report.parsedSenses).toBe(4)
    expect(report.parsedWords).toBe(3)
  })
})

describe('toSeedSql', () => {
  it('emits transactional inserts with escaped quotes and sequence resets', () => {
    const { words } = parseVocab([MULTI_SENSE_PAGE])
    const sql = toSeedSql(words)
    expect(sql).toContain('BEGIN;')
    expect(sql).toContain('COMMIT;')
    expect(sql).toContain("(1, 'abide')")
    // curly quote normalized then SQL-escaped: they've -> they''ve
    expect(sql).toContain("they''ve taken")
    expect(sql).toContain('OVERRIDING SYSTEM VALUE')
    expect(sql).toMatch(/setval/)
  })
})
