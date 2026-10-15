import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("./scripts/db-reset.sh", { stdio: "ignore" });
}
