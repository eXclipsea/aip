import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

/** SHA-256 of an in-memory buffer/string. */
export function sha256Buffer(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Stream a file through SHA-256 — works for large files without loading them. */
export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/** True when the file's hash matches the expected value. */
export async function verifyFile(filePath: string, expected: string): Promise<boolean> {
  const actual = await sha256File(filePath);
  return actual === expected;
}
