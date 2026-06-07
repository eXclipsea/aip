/**
 * Curated catalog of popular models hosted on the Ollama registry.
 *
 * This drives discovery (`search`, `info`, version listing, `outdated`).
 * It is NOT a gate on installs: `aip install <anything>:<tag>` resolves live
 * against the registry even if the model is not listed here.
 */
export interface CatalogModel {
  name: string;
  description: string;
  publisher: string;
  license: string;
  family: string;
  /** Known tags, most-popular first. The first entry is the default. */
  tags: string[];
}

export const CATALOG: CatalogModel[] = [
  {
    name: "llama3.3",
    description: "Meta's Llama 3.3 — 70B instruction-tuned, GPT-4-class quality.",
    publisher: "meta",
    license: "llama-3.3-community",
    family: "llama",
    tags: ["70b", "latest"],
  },
  {
    name: "llama3.2",
    description: "Meta's compact Llama 3.2 models for edge and on-device use.",
    publisher: "meta",
    license: "llama-3.2-community",
    family: "llama",
    tags: ["1b", "3b", "latest"],
  },
  {
    name: "llama3.1",
    description: "Meta's Llama 3.1 with 128K context, up to 405B parameters.",
    publisher: "meta",
    license: "llama-3.1-community",
    family: "llama",
    tags: ["8b", "70b", "405b", "latest"],
  },
  {
    name: "qwen2.5",
    description: "Alibaba's Qwen2.5 — strong multilingual + reasoning, 0.5B–72B.",
    publisher: "alibaba",
    license: "apache-2.0",
    family: "qwen2",
    tags: ["0.5b", "1.5b", "3b", "7b", "14b", "32b", "72b", "latest"],
  },
  {
    name: "qwen2.5-coder",
    description: "Code-specialized Qwen2.5 for generation, completion, and fixing.",
    publisher: "alibaba",
    license: "apache-2.0",
    family: "qwen2",
    tags: ["0.5b", "1.5b", "3b", "7b", "14b", "32b", "latest"],
  },
  {
    name: "mistral",
    description: "Mistral 7B — fast, capable open-weight base/instruct model.",
    publisher: "mistralai",
    license: "apache-2.0",
    family: "llama",
    tags: ["7b", "latest"],
  },
  {
    name: "mixtral",
    description: "Mistral's sparse Mixture-of-Experts (8x7B, 8x22B).",
    publisher: "mistralai",
    license: "apache-2.0",
    family: "llama",
    tags: ["8x7b", "8x22b", "latest"],
  },
  {
    name: "gemma3",
    description: "Google's Gemma 3 — multimodal, 1B–27B, large context.",
    publisher: "google",
    license: "gemma",
    family: "gemma3",
    tags: ["1b", "4b", "12b", "27b", "latest"],
  },
  {
    name: "gemma2",
    description: "Google's Gemma 2 open models, 2B–27B.",
    publisher: "google",
    license: "gemma",
    family: "gemma2",
    tags: ["2b", "9b", "27b", "latest"],
  },
  {
    name: "phi4",
    description: "Microsoft's Phi-4 14B — strong reasoning at small size.",
    publisher: "microsoft",
    license: "mit",
    family: "phi3",
    tags: ["14b", "latest"],
  },
  {
    name: "phi3",
    description: "Microsoft's Phi-3 family — efficient small language models.",
    publisher: "microsoft",
    license: "mit",
    family: "phi3",
    tags: ["3.8b", "14b", "latest"],
  },
  {
    name: "deepseek-r1",
    description: "DeepSeek-R1 reasoning models with visible chain-of-thought.",
    publisher: "deepseek",
    license: "mit",
    family: "qwen2",
    tags: ["1.5b", "7b", "8b", "14b", "32b", "70b", "671b", "latest"],
  },
  {
    name: "deepseek-v3",
    description: "DeepSeek-V3 — 671B MoE general-purpose model.",
    publisher: "deepseek",
    license: "deepseek",
    family: "deepseek2",
    tags: ["671b", "latest"],
  },
  {
    name: "codellama",
    description: "Meta's Code Llama — code generation and infilling, 7B–70B.",
    publisher: "meta",
    license: "llama-2-community",
    family: "llama",
    tags: ["7b", "13b", "34b", "70b", "latest"],
  },
  {
    name: "llava",
    description: "LLaVA multimodal — image understanding + chat.",
    publisher: "llava",
    license: "apache-2.0",
    family: "llama",
    tags: ["7b", "13b", "34b", "latest"],
  },
  {
    name: "nomic-embed-text",
    description: "High-performing open text embedding model (long context).",
    publisher: "nomic",
    license: "apache-2.0",
    family: "nomic-bert",
    tags: ["latest"],
  },
  {
    name: "all-minilm",
    description: "Sentence-Transformers MiniLM embeddings — tiny and fast.",
    publisher: "sentence-transformers",
    license: "apache-2.0",
    family: "bert",
    tags: ["22m", "33m", "latest"],
  },
  {
    name: "smollm2",
    description: "HuggingFace SmolLM2 — capable models from 135M to 1.7B.",
    publisher: "huggingface",
    license: "apache-2.0",
    family: "llama",
    tags: ["135m", "360m", "1.7b", "latest"],
  },
  {
    name: "tinyllama",
    description: "TinyLlama 1.1B — compact chat model for constrained hardware.",
    publisher: "tinyllama",
    license: "apache-2.0",
    family: "llama",
    tags: ["1.1b", "latest"],
  },
];

const BY_NAME = new Map(CATALOG.map((m) => [m.name, m]));

export function getCatalogModel(name: string): CatalogModel | undefined {
  return BY_NAME.get(name);
}

export function searchCatalog(query: string): CatalogModel[] {
  const q = query.toLowerCase();
  return CATALOG.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.publisher.toLowerCase().includes(q) ||
      m.family.toLowerCase().includes(q)
  );
}
