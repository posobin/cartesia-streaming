import { CartesiaClient } from "@cartesia/cartesia-js";
import { Readable } from "node:stream";
import fs from "fs";
import * as crypto from "crypto";
import { PassThrough } from "stream";
import { Future } from "./promise.js";
import Websocket from "@cartesia/cartesia-js/wrapper/Websocket.js";
import { WebSocketResponse } from "@cartesia/cartesia-js/api/resources/tts/types/WebSocketResponse.js";
import { pino } from "pino";

export function ensure(cond: unknown, message?: string): asserts cond is true {
  if (!cond) {
    throw new Error(message ?? `Expected ${cond} to be truthy`);
  }
}

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

const outputFormat = "raw";
const streamingOptions = {
  modelId: "sonic-english",
  voice: {
    mode: "id",
    id: "a0e99841-438c-4a64-b679-ae501e7d6091",
  } as const,
  container: outputFormat,
  encoding: "pcm_f32le",
  sampleRate: 44100,
};

export class LiveCartesiaClient {
  private client: CartesiaClient;
  private websocket: Websocket.default | undefined;

  constructor() {
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) {
      throw new Error("Cartesia api key not found");
    }

    this.client = new CartesiaClient({
      apiKey: apiKey,
    });
  }

  private async ensureWebsocketConnection() {
    logger.info("Ensuring websocket connection");
    if (!this.websocket) {
      this.websocket = this.client.tts.websocket(streamingOptions);
      try {
        await this.websocket.connect();
      } catch (error) {
        console.error("Error connecting to websocket", error);
      }
    }
  }

  stop() {
    this.websocket?.socket?.close();
  }

  async generate(text: Readable): Promise<NodeJS.ReadableStream> {
    await this.ensureWebsocketConnection();
    const websocket = this.websocket;
    // TODO: consume the input stream nonetheless
    ensure(websocket, "Websocket not connected");

    const outputStream = new PassThrough();

    // Accumulate the first few words before sending to Cartesia
    let firstChunk = "";
    let sentFirstChunk = false;

    const contextId = crypto.randomUUID();
    const sendBuffer = async (
      chunk: string | undefined,
      _continueSending: boolean
    ) => {
      await responseFuture.promise;
      this.websocket?.continue({
        ...streamingOptions,
        contextId,
        transcript: chunk,
      });
    };
    const sendFirstChunk = async () => {
      try {
        logger.info(
          { contextId },
          "Sending first chunk to Cartesia: %s",
          firstChunk
        );
        const response = await websocket.send({
          ...streamingOptions,
          contextId,
          transcript: firstChunk,
        });
        sentFirstChunk = true;
        responseFuture.resolve(response);
      } catch (error: unknown) {
        logger.error({ error, contextId }, "Failed to send first chunk");
        responseFuture.reject(new Error("Failed to send first chunk"));
      }
    };
    const sendChunk = async (chunk: string) => {
      if (!sentFirstChunk) {
        firstChunk += chunk;
        // match sequences of non-space characters
        const numWords = (firstChunk.trim().match(/\S+/g) || []).length;
        // Only send the first chunk once we accumulate enough words
        if (numWords >= 4) {
          await sendFirstChunk();
        }
      } else if (chunk.length > 0) {
        logger.info({ contextId }, "Sending chunk to Cartesia: %s", chunk);
        await sendBuffer(chunk, true);
      }
    };
    const closeStream = async () => {
      if (!sentFirstChunk) {
        if (!firstChunk.length) {
          return;
        }
        await sendFirstChunk();
      }
      // sendBuffer(undefined, false);
    };

    const responseFuture = new Future<
      Awaited<ReturnType<Websocket.default["send"]>>
    >();

    void (async () => {
      try {
        for await (const chunk of text) {
          const chunkString = Buffer.from(chunk).toString("utf-8");
          await sendChunk(chunkString);
        }
        await closeStream();
      } catch (error) {
        logger.error({ error, contextId }, "Error streaming text");
      }
      logger.info({ contextId }, "Ending output stream");
    })();

    void (async () => {
      try {
        const response = await responseFuture.promise;
        for await (const rawMessage of response.events("message") ?? []) {
          const message = JSON.parse(rawMessage) as WebSocketResponse;
          if (message.type === "error") {
            logger.error(
              { error: message.error, contextId },
              "Error streaming speech"
            );
            throw new Error(message.error);
          } else if (message.type === "chunk") {
            logger.info(
              { ...message, data: "...", contextId },
              "Received message"
            );
            // decode the base64 audio data
            const audioData = Buffer.from(message.data, "base64");
            const outputFuture = new Future<void>();
            outputStream.write(audioData, undefined, () => {
              outputFuture.resolve();
            });
            await outputFuture.promise;
          }
          if (message.done) {
            break;
          }
        }
        outputStream.end();
      } catch (error) {
        logger.error({ error, contextId }, "Error streaming text");
        outputStream.destroy(error as Error);
      }
      logger.info({ contextId }, "Ending this stream");
      outputStream.end();
    })();

    return outputStream;
  }
}
