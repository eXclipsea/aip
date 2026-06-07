/**
 * Identify a license from its full text. The registry serves the real license
 * as a layer blob; we read that text and name it — no per-model hardcoding.
 */
const MATCHERS: Array<{ test: (t: string) => boolean; name: string }> = [
  { name: "Apache-2.0", test: (t) => /apache license/i.test(t) && /version 2\.0/i.test(t) },
  { name: "MIT", test: (t) => /\bMIT License\b/i.test(t) || /permission is hereby granted, free of charge/i.test(t) },
  { name: "GPL-3.0", test: (t) => /gnu general public license/i.test(t) && /version 3/i.test(t) },
  { name: "GPL-2.0", test: (t) => /gnu general public license/i.test(t) && /version 2/i.test(t) },
  { name: "AGPL-3.0", test: (t) => /gnu affero general public license/i.test(t) },
  { name: "LGPL", test: (t) => /gnu lesser general public license/i.test(t) },
  { name: "BSD-3-Clause", test: (t) => /redistribution and use in source and binary forms/i.test(t) && /neither the name/i.test(t) },
  { name: "BSD-2-Clause", test: (t) => /redistribution and use in source and binary forms/i.test(t) },
  { name: "Mozilla-2.0", test: (t) => /mozilla public license/i.test(t) },
  { name: "Llama-Community", test: (t) => /llama.{0,40}community license/i.test(t) },
  { name: "Gemma", test: (t) => /gemma terms of use/i.test(t) || /\bgemma\b.{0,30}license/i.test(t) },
  { name: "Qwen", test: (t) => /\bqwen\b.{0,30}license/i.test(t) || /tongyi qianwen/i.test(t) },
  { name: "DeepSeek", test: (t) => /deepseek license/i.test(t) },
  { name: "CC-BY-NC-4.0", test: (t) => /creative commons/i.test(t) && /noncommercial/i.test(t) },
  { name: "CC-BY-4.0", test: (t) => /creative commons attribution/i.test(t) },
];

export function detectLicense(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "see model card";
  for (const m of MATCHERS) {
    if (m.test(trimmed)) return m.name;
  }
  // Fall back to the first meaningful line of the license document.
  const firstLine = trimmed
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return firstLine ? firstLine.slice(0, 60) : "custom";
}
