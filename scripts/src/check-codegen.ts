import { createHash } from "crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { resolve, join } from "path";

const root = resolve(import.meta.dirname, "../..");
const specPath = resolve(root, "lib/api-spec/openapi.yaml");
const hashPath = resolve(root, "lib/api-spec/.codegen-hash");
const outputHashPath = resolve(root, "lib/api-spec/.codegen-output-hash");

const generatedDirs = [
  resolve(root, "lib/api-client-react/src/generated"),
  resolve(root, "lib/api-zod/src/generated"),
];

function hashDirectory(dirPath: string): string {
  const h = createHash("sha256");
  if (!existsSync(dirPath)) return h.digest("hex");

  function walk(dir: string, base: string): void {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = join(base, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        h.update(rel);
        h.update(readFileSync(full));
      }
    }
  }

  walk(dirPath, "");
  return h.digest("hex");
}

function hashGeneratedOutput(): string {
  const h = createHash("sha256");
  for (const dir of generatedDirs) {
    h.update(hashDirectory(dir));
  }
  return h.digest("hex");
}

if (!existsSync(specPath)) {
  console.error(`check:codegen — spec not found at ${specPath}`);
  process.exit(1);
}

const currentSpecHash = createHash("sha256")
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

const storedSpecHash = readFileSync(hashPath, "utf8").trim();

if (currentSpecHash !== storedSpecHash) {
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

if (!existsSync(outputHashPath)) {
  console.error(
    "check:codegen — .codegen-output-hash is missing. Generated files may have been manually edited."
  );
  console.error(
    "  Run: pnpm --filter @workspace/api-spec run codegen"
  );
  process.exit(1);
}

const storedOutputHash = readFileSync(outputHashPath, "utf8").trim();
const currentOutputHash = hashGeneratedOutput();

if (currentOutputHash !== storedOutputHash) {
  console.error(
    "check:codegen — generated files have been manually edited or are out of sync."
  );
  console.error(
    "  lib/api-client-react/src/generated/ or lib/api-zod/src/generated/ do not match the last codegen run."
  );
  console.error(
    "  Run: pnpm --filter @workspace/api-spec run codegen"
  );
  process.exit(1);
}

console.log("check:codegen — generated files are up to date.");
