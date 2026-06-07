import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import cliProgress from "cli-progress";
import chalk from "chalk";
import type { ModelMeta } from "../types.js";

const MB = 1024 * 1024;
const toMb = (bytes: number): number => Math.round(bytes / MB);

/**
 * Stream the real model blob to disk with a live progress bar.
 * Follows redirects (Ollama blobs redirect to a CDN). Throws on HTTP errors.
 */
export async function download(meta: ModelMeta, destPath: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(meta.downloadUrl, { redirect: "follow" });
  } catch (err) {
    throw new Error(
      `Download failed for ${meta.name}@${meta.version}: ${(err as Error).message}. ` +
        `Check your connection and try again.`
    );
  }

  if (!res.ok || !res.body) {
    throw new Error(
      `Download failed for ${meta.name}@${meta.version}: HTTP ${res.status} ${res.statusText}.`
    );
  }

  const totalBytes = Number(res.headers.get("content-length")) || meta.sizeBytes;
  const totalMb = Math.max(1, toMb(totalBytes));

  const bar = new cliProgress.SingleBar(
    {
      format: `  ${chalk.cyan("{bar}")} {percentage}% | {value}/{total} MB | ${meta.name}@${meta.version}`,
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  bar.start(totalMb, 0);
  let downloaded = 0;

  const nodeStream = Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
  nodeStream.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    bar.update(Math.min(totalMb, toMb(downloaded)));
  });

  try {
    await pipeline(nodeStream, createWriteStream(destPath));
  } finally {
    bar.update(totalMb);
    bar.stop();
  }
}
