import { spawn } from "node:child_process";
import chalk from "chalk";
import { readManifest, manifestExists } from "../lib/manifest.js";
import { readCache, paths } from "../lib/store.js";
import { fail, info, envName } from "../lib/ui.js";

/**
 * Build the env for a script run: every installed model gets an
 * AIP_MODEL_<NAME> var pointing at its .gguf, plus AIP_MODELS_DIR.
 */
function scriptEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, AIP_MODELS_DIR: paths.models };
  for (const m of readCache().models) {
    env[`AIP_MODEL_${envName(m.name)}`] = paths.modelFile(m.name, m.version);
  }
  return env;
}

export async function run(script: string | undefined, extraArgs: string[]): Promise<void> {
  if (!manifestExists()) {
    fail("No aip.json found. Run 'aip init' and add a \"scripts\" entry first.");
    process.exitCode = 1;
    return;
  }

  const manifest = readManifest();
  const scripts = manifest.scripts ?? {};

  if (!script) {
    const names = Object.keys(scripts);
    if (names.length === 0) {
      info("No scripts defined in aip.json. Add a \"scripts\" map to use 'aip run'.");
      return;
    }
    console.log(chalk.bold("Available scripts:"));
    for (const [name, cmd] of Object.entries(scripts)) {
      console.log(`  ${chalk.cyan(name)}\n    ${chalk.dim(cmd)}`);
    }
    return;
  }

  const command = scripts[script];
  if (!command) {
    fail(
      `No script "${script}" in aip.json. Available: ${Object.keys(scripts).join(", ") || "(none)"}.`
    );
    process.exitCode = 1;
    return;
  }

  const fullCommand = extraArgs.length ? `${command} ${extraArgs.join(" ")}` : command;
  info(`> ${fullCommand}`);

  const child = spawn(fullCommand, {
    shell: true,
    stdio: "inherit",
    env: scriptEnv(),
  });

  await new Promise<void>((resolve) => {
    child.on("exit", (code) => {
      if (code && code !== 0) process.exitCode = code;
      resolve();
    });
  });
}
