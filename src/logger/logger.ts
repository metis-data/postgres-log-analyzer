import * as Sentry from "@sentry/node";
import { createLogger, format, transports } from "winston";
import SentryTransporter from "winston-transport-sentry-node";
import DatadogWinston from "datadog-winston";

import config from "config";
import { LogLevelEnum, Environments } from "../types";
import { log } from "./utils";
const {
  logLevel,
  appEnv,
  datadogApiKey,
  apiKey,
  prettyPrint
}: {
  logLevel: string;
  appEnv: string;
  datadogApiKey: string;
  apiKey: string;
  prettyPrint: "true" | "false";
} = config.get("app");

function _createLogger(componentName: string, logLevel = LogLevelEnum.INFO) {
  const logFormat = [
    format.splat(),
    format.errors({ stack: true }),
    format.timestamp()
  ];

  if (
    ["true", "1"].includes(prettyPrint ?? "") ||
    (appEnv !== Environments.PRODUCTION && appEnv !== Environments.STAGING)
  ) {
    logFormat.push(format.prettyPrint());
  } else {
    logFormat.push(format.json());
  }

  const consoleTransporter = new transports.Console({
    level: LogLevelEnum[logLevel],
    stderrLevels: ["error"]
  });

  const {
    // @ts-ignore
    app: { sentryDsn }
  } = config;

  const options = {
    level: logLevel,
    sentry: {
      dsn: sentryDsn
    },
    handleExceptions: true,
    handleRejections: true
  };
  const sentryTransporter = new SentryTransporter(options);

  const datadogTransporter = new DatadogWinston({
    apiKey: datadogApiKey,
    hostname: apiKey,
    service: "postgresLogsAgent",
    ddsource: "nodejs"
  });

  const winstonLogger = createLogger({
    level: logLevel || logLevel,
    defaultMeta: { component: componentName, user: { id: apiKey } },
    exitOnError: false,
    format: format.combine(...logFormat),
    transports: [sentryTransporter, datadogTransporter, consoleTransporter],
    handleExceptions: true,
    handleRejections: true
  });

  return winstonLogger;
}

const logger = _createLogger("app");

function createSubLogger(componentName: string) {
  return logger.child({ componentName });
}

async function loggerExit(msg?: string) {
  await Promise.allSettled([
    new Promise((resolve) => {
      logger.on("finish", resolve);
      logger.end();
    }),
    Sentry.close(2000)
  ]);

  log("INFO", process.stdout, msg);
}

export { logger, createSubLogger, loggerExit };
