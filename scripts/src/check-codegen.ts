import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "../..");
const specPath = resolve(root, "lib/api-spec/openapi.yaml");
const hashPath = resolve(root, "lib/api-spec/.codegen-hash");

if (!existsSync(specPath)) {
  console.error(`check:codegen — spec not found at ${specPath}`);
  process.exit(1);
}

const currentHash = createHash("sha256")
  .update(readFileSync(specPath))
  .digest("hex");

if (!existsSync(hashPath)) {
  console.error(
    "check:codegen — .codegen-hash is missing. Generated files may be out of sync."
  );
  console.error(
    "  Run: pnpm --filter @workspace/api-spec run codegen"
  );
  process.exit(1);
}

const storedHash = readFileSync(hashPath, "utf8").trim();

if (currentHash !== storedHash) {
  console.error(
    "check:codegen — openapi.yaml has changed but codegen has not been run."
  );
  console.error(
    "  The generated hooks and Zod schemas are out of sync with the spec."
  );
  console.error(
    "  Run: pnpm --filter @workspace/api-spec run codegen"
  );
  process.exit(1);
}

console.log("check:codegen — generated files are up to date.");
