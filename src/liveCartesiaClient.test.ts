import { describe, it, beforeEach } from "vitest";
import * as assert from "node:assert/strict";
import { LiveCartesiaClient } from "./liveCartesiaClient.js";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

describe("LiveCartesiaClient", () => {
  let client: LiveCartesiaClient;
  let outputDir: string;

  beforeEach(() => {
    client = new LiveCartesiaClient();
    outputDir = path.join(import.meta.dirname, "test-output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    console.log("Client initialized");
  });

  it("should generate audio from text stream", async () => {
    const sentences = [
      "This is the first sentence.",
      " Here comes the second one.",
      // 'And finally, the third sentence.',
    ];

    // Create a readable stream from the sentences
    const textStream = new Readable({
      read() {
        const sentence = sentences.shift();
        console.log("Reading stream", sentence);
        if (sentence) {
          this.push(sentence);
        } else {
          this.push(null);
        }
      },
    });

    console.log("Generating audio from stream");
    const outputStream = await client.generate(textStream);

    const outputFile = path.join(outputDir, "test-output-stream.raw");
    const writeStream = fs.createWriteStream(outputFile);

    await new Promise<void>((resolve, reject) => {
      outputStream.pipe(writeStream);
      writeStream.on("finish", () => {
        console.log("Stream finished");
        resolve();
      });
      writeStream.on("error", (error) => {
        console.error("Error writing stream:", error);
        reject(error);
      });
    });
    writeStream.end();
    console.log("Stream finished");
    client.stop();

    // Verify the file exists and has content
    assert.ok(fs.existsSync(outputFile));
    const stats = fs.statSync(outputFile);
    assert.ok(stats.size > 0);
  });
});
