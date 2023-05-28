import * as Sentry from "@sentry/node";
import { getPackageVersion } from "../utils";
import config from "config";

const { sentryDsn, appEnv }: { sentryDsn: string; appEnv: string } =
  config.get("app");

export const initSentry = () => {
  Sentry.init({
    dsn: sentryDsn,
    environment: appEnv,
    tracesSampleRate: 1.0,
    release: `postgres-log-analyzer@${getPackageVersion()}`
  });
};
