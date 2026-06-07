import chalk from "chalk";
import { CATALOG, searchCatalog } from "../lib/catalog.js";
import { info, table } from "../lib/ui.js";

export async function search(query?: string): Promise<void> {
  const results = query ? searchCatalog(query) : CATALOG;

  if (results.length === 0) {
    info(`No models match "${query}". Try a broader term, or any Ollama model name works with 'aip install'.`);
    return;
  }

  if (query) {
    console.log(chalk.dim(`Found ${results.length} model(s) matching "${query}":\n`));
  }

  const rows = results.map((m) => [
    m.name,
    m.publisher,
    m.tags.filter((t) => t !== "latest").join(", "),
    m.description,
  ]);

  console.log(table(["MODEL", "PUBLISHER", "TAGS", "DESCRIPTION"], rows));
  console.log(chalk.dim(`\nInstall any with:  aip install <model>:<tag>`));
}
