import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/drizzle/schema.ts",
  tablesFilter: ["wanjiedaoyou_*"],
  dbCredentials: {
    url: `${process.env.DATABASE_URL}`,
  },
});
