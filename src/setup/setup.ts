import fs from "fs";

import config from "config";
import { logger } from "../logger/logger";
import { initSentry } from "./sentry";

const REQUIRED_FIELDS = [
  { fieldName: "app.logsDir", msg: "Logs Directory" },
  { fieldName: "app.datadogApiKey", msg: "Datadog API Key" },
  { fieldName: "app.sentryDsn", msg: "Sentry DSN" },
  { fieldName: "app.apiKey", msg: "Metis API Key" }
];

export const setup = () => {
  logger.debug({ config, env: process.env.NODE_ENV });

  REQUIRED_FIELDS.forEach((configProp: { fieldName: string; msg: string }) => {
    if (!config.get(configProp.fieldName)) {
      throw new Error(`${configProp.msg} is not defined. We cannot continue.`);
    }
  });
  const {
    // @ts-ignore
    app: { logsDir }
  } = config;

  try {
    if (!fs.lstatSync(logsDir).isDirectory()) {
      throw new Error(`Logs diriectory is required: ${logsDir}`);
    }
  } catch (error) {
    if (error && error?.code === "ENOENT") {
      logger.error(`Couldnt find directory or file at: ${logsDir}`, { error });
    }
  }

  initSentry();
};
