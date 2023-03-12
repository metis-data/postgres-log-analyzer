import path from "path";

import chokidar from "chokidar";
import csvParser from "csv-parser";

import { exec, spawn } from "child_process";
import config from "config";
import { EMPTY, fromEvent, Observable } from "rxjs";
import { bufferTime, distinct, filter, map, switchMap } from "rxjs/operators";
import { makeHttpRequest } from "./http";
import { logger } from "./logger";
import { makeSpan } from "./make-span";
import { mapHeadersFn as mapHeaders, mapValuesFn as mapValues } from "./utils";

const MAX_BULK_ITEMS = 10;

function parseFileWithSpwan(filePath: string) {
  return new Observable((observer) => {
    const tail = spawn("tail", ["-f", filePath]);

    tail.stdout.on("data", (data) => {
      console.log(`Received: ${data}`);
    });

    tail.stdout
      .pipe(
        csvParser({
          mapHeaders,
          mapValues
        })
      )
      .on("data", (data) => {
        console.log(`data: ${data}`);
        observer.next(data);
      });

    tail.stderr.on("data", (data) => {
      console.error(`Received error: ${data}`);
      observer.error(data);
    });

    tail.on("close", (code) => {
      console.log(`Child process exited with code ${code}`);
      observer.complete();
    });
  });
}

function parseFile(filePath: string) {
  logger.debug(`Parsing file: ${filePath}`);

  return new Observable((observer) => {
    const tailCmd = `tail -n +1 -F ${filePath}`;
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
    bufferTime(5000, null, MAX_BULK_ITEMS)
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

fromEvent(chokidar.watch(`${logsDir}/*.csv`, { persistent: true }), "all")
  .pipe(
    filter((item) => {
      //   logger.debug("File detected", { file: item });
      return path.extname(item[1]) === ".csv";
    }),
    map((item) => {
      return item[1];
    }),
    distinct(),
    switchMap(parseFile),
    switchMap(postSpans)
  )
  .subscribe(
    (x) => logger.debug("Check", { x }),
    (error) => logger.error("Debug error:", { message: error.message })
  );
