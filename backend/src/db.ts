import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const url = process.env.DATABASE_URL || ''

export const db = new Pool({
  connectionString: url,
  // Conexiones internas de Railway no usan SSL, externas sí
  ssl: url.includes('railway.internal') ? false : { rejectUnauthorized: false }
})
