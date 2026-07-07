import { readFileSync, readdirSync } from "node:fs";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL || "postgres://fair_meme:fair_meme@127.0.0.1:5432/fair_meme_trade";
const pool = new pg.Pool({ connectionString: databaseUrl });
const files = readdirSync("server/migrations").filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const sql = readFileSync(`server/migrations/${file}`, "utf8");
  await pool.query(sql);
  console.log(`Applied ${file}`);
}

await pool.end();
