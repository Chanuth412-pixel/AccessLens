import pg from "pg";
import type { QueryResultRow } from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  ...config.database,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return pool.query<T>(text, values);
}
