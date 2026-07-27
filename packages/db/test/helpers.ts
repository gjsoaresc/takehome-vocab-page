import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ADMIN_URL = process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab'
const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab_test'

/** Drop + recreate the test database and apply schema.sql (+ functions.sql when present). */
export async function resetTestDb(): Promise<postgres.Sql> {
  const dbName = new URL(TEST_URL).pathname.slice(1)
  const admin = postgres(ADMIN_URL, { max: 1 })
  await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`)
  await admin.unsafe(`CREATE DATABASE ${dbName}`)
  await admin.end()

  const sql = postgres(TEST_URL, { max: 1, onnotice: () => {} })
  await sql.file(resolve(pkgRoot, 'schema.sql'))
  const functions = resolve(pkgRoot, 'functions.sql')
  if (existsSync(functions)) await sql.file(functions)
  return sql
}

/** Insert a minimal word + sense + user fixture; returns their ids. */
export async function seedFixture(sql: postgres.Sql): Promise<{
  wordId: number
  senseId: number
  userId: string
}> {
  const [word] = await sql`INSERT INTO words (headword) VALUES ('abase') RETURNING id`
  const [sense] = await sql`
    INSERT INTO senses (word_id, sense_no, pos, definition, example)
    VALUES (${word!.id}, 1, 'v', 'to humiliate, degrade', 'After the coup, he was abased.')
    RETURNING id`
  const [user] = await sql`INSERT INTO users DEFAULT VALUES RETURNING id`
  return { wordId: word!.id, senseId: sense!.id, userId: user!.id }
}
