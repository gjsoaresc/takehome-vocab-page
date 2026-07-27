// One-off: extract sat.vocab.pdf -> seed_words.sql + parse-report.json.
// Run with `bun run db:parse`. The PDF is never parsed at app runtime.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractText, getDocumentProxy } from 'unpdf'
import { parseVocab, toSeedSql } from './vocab-parser'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(pkgRoot, '../..')
const pdfPath = process.argv[2] ?? resolve(repoRoot, 'Vocab Page - Amadeu/sat.vocab.pdf')

const pdf = await getDocumentProxy(new Uint8Array(readFileSync(pdfPath)))
const { text: pages } = await extractText(pdf, { mergePages: false })
const { words, report } = parseVocab(pages)

writeFileSync(resolve(pkgRoot, 'seed_words.sql'), toSeedSql(words))
writeFileSync(resolve(pkgRoot, 'parse-report.json'), JSON.stringify(report, null, 2) + '\n')

console.log(
  `parsed ${report.parsedWords} words / ${report.parsedSenses} senses ` +
    `(markers in source: ${report.totalPosMarkers})`,
)
console.log(`pos counts: ${JSON.stringify(report.posCounts)}`)
console.log(`skipped: ${report.skipped.length}, pos suspects: ${report.posSuspects.length}`)
