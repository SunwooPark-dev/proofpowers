import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
if (!existsSync(pkgPath)) {
  console.error("smoke: package.json not found");
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
console.log(`smoke: ok, package=${pkg.name}, node=${process.version}`);
