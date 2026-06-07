import { existsSync } from "node:fs";
import { readCache, paths } from "../lib/store.js";
import { fail, parseModelRef } from "../lib/ui.js";

/** Print the absolute path to an installed model's .gguf file (for scripting). */
export async function which(ref: string): Promise<void> {
  const { name, version } = parseModelRef(ref);
  const cache = readCache();

  const matches = cache.models.filter(
    (m) => m.name === name && (version ? m.version === version : true)
  );

  if (matches.length === 0) {
    fail(`${ref} is not installed. Run 'aip install ${ref}' first.`);
    process.exitCode = 1;
    return;
  }

  if (matches.length > 1 && !version) {
    fail(
      `${name} has multiple versions installed (${matches
        .map((m) => m.version)
        .join(", ")}). Specify one, e.g. 'aip which ${name}:${matches[0].version}'.`
    );
    process.exitCode = 1;
    return;
  }

  const m = matches[0];
  const file = paths.modelFile(m.name, m.version);
  if (!existsSync(file)) {
    fail(`${m.name}@${m.version} is recorded but its file is missing. Reinstall it.`);
    process.exitCode = 1;
    return;
  }
  console.log(file);
}
