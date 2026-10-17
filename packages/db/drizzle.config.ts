import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_OWNER ?? "postgres://petshop_owner:petshop_owner@localhost:5432/petshop",
  },
  strict: true,
  verbose: true,
});
