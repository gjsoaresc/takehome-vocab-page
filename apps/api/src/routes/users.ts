import { Hono } from 'hono'
import { db } from '../db'

export const users = new Hono()

users.post('/', async (c) => {
  const [row] = await db()`INSERT INTO users DEFAULT VALUES RETURNING id`
  return c.json({ id: row!.id as string }, 201)
})
