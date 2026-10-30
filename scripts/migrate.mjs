import { execSync } from "child_process";

if (process.env.DATABASE_URL) {
  console.log("DATABASE_URL detected. Running drizzle-kit migrate...");
  execSync("drizzle-kit migrate", { stdio: "inherit" });
} else {
  console.log("DATABASE_URL not set. Skipping drizzle-kit migrate for offline build.");
}
