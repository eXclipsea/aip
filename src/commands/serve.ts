import { join } from "node:path";
import chalk from "chalk";
import { startRegistryServer } from "../lib/server.js";
import { paths } from "../lib/store.js";
import { ok, info } from "../lib/ui.js";

export interface ServeOpts {
  port?: string;
  dir?: string;
  host?: string;
}

/**
 * Run a self-hostable, OCI-compatible registry. `aip install`/`info`/`search`
 * work against it, and `aip publish` can push to it — this is what makes the
 * package manager's publish path real (and enables private registries).
 */
export async function serve(opts: ServeOpts): Promise<void> {
  const port = Number(opts.port ?? 5000);
  const dir = opts.dir ?? join(paths.home, "registry");
  const host = opts.host ?? "0.0.0.0";

  if (Number.isNaN(port)) {
    console.error(chalk.red(`Invalid port: ${opts.port}`));
    process.exitCode = 1;
    return;
  }

  await startRegistryServer({ port, dir, host });

  ok(`Registry listening on ${chalk.cyan(`http://localhost:${port}`)}`);
  info(`Storage: ${dir}`);
  console.log(chalk.dim("\nPoint a client at it with:"));
  console.log(chalk.dim(`  aip registry set http://localhost:${port}`));
  console.log(chalk.dim("Then 'aip publish <model:tag>' to push, 'aip install' to pull.\n"));
  console.log(chalk.dim("Press Ctrl+C to stop."));

  // Keep the process alive until interrupted.
  await new Promise<void>(() => {});
}
