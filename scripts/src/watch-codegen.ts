import { watch } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

// Safety guard: this script is a dev-only file watcher and must never run in
// production. The production artifact.toml uses an explicit args array (not a
// shell command) so it never starts this script, but we exit early here as an
// additional safeguard in case the production run command is changed in future.
if (process.env.NODE_ENV === "production") {
  console.error(
    "watch:codegen — refusing to run in production (NODE_ENV=production). Exiting."
  );
  process.exit(1);
}

const root = resolve(import.meta.dirname, "../..");
const specPath = resolve(root, "lib/api-spec/openapi.yaml");

console.log("watch:codegen — watching lib/api-spec/openapi.yaml for changes…");
console.log("  Press Ctrl+C to stop.\n");

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

function runCodegen(): void {
  if (running) return;
  running = true;
  console.log("watch:codegen — openapi.yaml changed, running codegen…");
  try {
    execSync("pnpm --filter @workspace/api-spec run codegen", {
      cwd: root,
      stdio: "inherit",
    });
    console.log("watch:codegen — codegen complete.\n");
  } catch {
    console.error("watch:codegen — codegen failed (see output above).\n");
  } finally {
    running = false;
  }
}

watch(specPath, (_event) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runCodegen, 300);
});
