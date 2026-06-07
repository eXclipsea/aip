import ora from "ora";
import chalk from "chalk";
import { searchRegistry } from "../lib/registry.js";
import { info, table, printJson } from "../lib/ui.js";

export async function search(query?: string, opts: { json?: boolean } = {}): Promise<void> {
  if (!query) {
    info("Usage: aip search <query>  (e.g. 'aip search qwen', 'aip search embed')");
    return;
  }

  const spinner = opts.json ? null : ora(`Searching registry for "${query}"...`).start();
  let results;
  try {
    results = await searchRegistry(query);
  } catch (err) {
    spinner?.stop();
    if (opts.json) return printJson({ query, results: [], error: (err as Error).message });
    info((err as Error).message);
    process.exitCode = 1;
    return;
  }
  spinner?.stop();

  if (opts.json) return printJson(results.map((r) => r.name));

  if (results.length === 0) {
    info(`No models match "${query}".`);
    return;
  }

  console.log(chalk.dim(`Found ${results.length} model(s) matching "${query}":\n`));
  const rows = results.map((r) => [r.name]);
  console.log(table(["MODEL"], rows));
  console.log(chalk.dim(`\nView tags:  aip info <model>     Install:  aip install <model>:<tag>`));
}
