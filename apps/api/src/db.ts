import postgres from 'postgres'

let client: postgres.Sql | undefined

/** Shared postgres.js client (lazy so tests can point DATABASE_URL first). */
export function db(): postgres.Sql {
  client ??= postgres(process.env.DATABASE_URL ?? 'postgres://vocab:vocab@localhost:5434/vocab', {
    onnotice: () => {},
  })
  return client
}

/** Close the shared client (used by tests and graceful shutdown). */
export async function closeDb(): Promise<void> {
  await client?.end()
  client = undefined
}
