import path from "path";

import chokidar from "chokidar";
import csvParser from "csv-parser";

import { exec } from "child_process";
import config from "config";
import { EMPTY, fromEvent, Observable } from "rxjs";
import { bufferTime, distinct, filter, map, switchMap } from "rxjs/operators";
import { makeHttpRequest } from "./processor/http";
import { logger } from "./logger";
import { makeSpan } from "./processor/make-span";
import { mapHeadersFn as mapHeaders, mapValuesFn as mapValues } from "./utils";
import { setup } from "./setup";
import { MAX_BULK_ITEMS, MAX_ITEMS_IN_BULK } from "./consts";

function parseFile(filepath: string) {
  logger.info("Watching log file", { filepath });

  return new Observable((observer) => {
    const tailCmd = `tail -n +1 -F ${filepath}`;
    const tailProc = exec(tailCmd);
    tailProc.stdout
      .pipe(
        csvParser({
          mapHeaders,
          mapValues
        })
      )
      .on("error", (error) => {
        observer.error(error);
      })
      .on("data", (data) => {
        observer.next(data);
      })
      .on("close", () => {
        return observer.complete();
      });
  }).pipe(
    filter(
      (csvItem) =>
        csvItem["logType"] === "LOG" &&
        Object.prototype.toString.call(csvItem["message"]) === "[object Object]"
    ),
    map(makeSpan),
    bufferTime(
      config.get<number>("processor.bufferInMs") || MAX_ITEMS_IN_BULK,
      null,
      config.get<number>("processor.maxItemsInBulk") || MAX_BULK_ITEMS
    )
  );
}

const logsDir: string = path.resolve(config.get("app.logsDir"));
const apiKey: string = config.get("app.apiKey");
const httpConfig: any = config.get("http");

// @ts-ignore
const backendUrl =
  httpConfig.port === 443
    ? `${httpConfig.scheme}://${httpConfig.host}/`
    : `${httpConfig.scheme}://${httpConfig.host}:${httpConfig.port}/`;

const postSpans = (listOfItems: any[]) => {
  if (listOfItems.length === 0) return EMPTY;

  logger.debug("Sending spans to backend", { count: listOfItems.length });

  return new Observable((observer) => {
    makeHttpRequest(backendUrl, "POST", listOfItems, {
      "x-api-key": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json"
    })
      .then((response) => {
        observer.next(response.data);
        observer.complete();
      })
      .catch((error) => {
        if (error.response) {
          const headers = Object.keys(error.response.headers)
            .filter((key) => key.startsWith("x-amzn"))
            .reduce((obj, key) => {
              obj[key] = error.response.headers[key];
              return obj;
            }, {});

          // Request made and server responded
          logger.error("Request made and server responded with error", {
            data: error.response.data,
            status: error.response.status,
            headers,
            error: {
              code: error.code,
              message: error.message
            }
          });
        } else {
          // Request made and server responded
          logger.error(
            "Something happened in setting up the request that triggered an error",
            {
              message: error.message,
              code: error.code
            }
          );
        }
        observer.error(error);
        observer.complete();
      });
  });
};

function main() {
  setup();

  fromEvent(chokidar.watch(`${logsDir}/*.csv`, { persistent: true }), "all")
    .pipe(
      filter((item) => {
        return path.extname(item[1]) === ".csv";
      }),
      map((item) => {
        const filename = item[1];
        return filename;
      }),
      distinct(),
      switchMap(parseFile),
      switchMap(postSpans)
    )
    .subscribe(
      (x) => logger.debug("Check", { x }),
      (error) => logger.error("Debug error:", { message: error.message })
    );
}

main();
