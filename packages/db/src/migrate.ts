// Apply schema.sql (+ functions.sql) to DATABASE_URL. Fresh databases only;
// resets are owned by the seed script and the test helpers.
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab'

const sql = postgres(url, { max: 1, onnotice: () => {} })
await sql.file(resolve(pkgRoot, 'schema.sql'))
const functions = resolve(pkgRoot, 'functions.sql')
if (existsSync(functions)) await sql.file(functions)
await sql.end()
console.log(`migrated ${url.replace(/:[^:@/]+@/, ':***@')}`)
