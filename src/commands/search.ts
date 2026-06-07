import ora from "ora";
import chalk from "chalk";
import { searchRegistry } from "../lib/registry.js";
import { info, table } from "../lib/ui.js";

export async function search(query?: string): Promise<void> {
  if (!query) {
    info("Usage: aip search <query>  (e.g. 'aip search qwen', 'aip search embed')");
    return;
  }

  const spinner = ora(`Searching registry for "${query}"...`).start();
  let results;
  try {
    results = await searchRegistry(query);
  } catch (err) {
    spinner.stop();
    info((err as Error).message);
    process.exitCode = 1;
    return;
  }
  spinner.stop();

  if (results.length === 0) {
    info(`No models match "${query}".`);
    return;
  }

  console.log(chalk.dim(`Found ${results.length} model(s) matching "${query}":\n`));
  const rows = results.map((r) => [r.name]);
  console.log(table(["MODEL"], rows));
  console.log(chalk.dim(`\nView tags:  aip info <model>     Install:  aip install <model>:<tag>`));
}
