export const getPackageVersion = () => {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }

  // eslint-disable-next-line global-require
  return require("./package.json").version;
};

const regexExtractDuration = /duration:\s+(\d+\.\d+)\s+ms/;

export const mapValuesFn = ({
  header,
  index: _,
  value
}: {
  header: string;
  index: number;
  value: any;
}): any => {
  if (header === "endTime" || header === "startTime") {
    try {
      return new Date(value).toISOString();
    } catch (err) {
      return null;
    }
  }
  if (header === "message") {
    if (value.includes("plan:")) {
      const splitted = value.split("plan:");
      const jsonStr = JSON.parse(splitted[1]);

      const match = regexExtractDuration.exec(splitted[0]);

      let duration = 0;
      if (match != null) {
        duration = parseFloat(match[1]);
      }

      return {
        duration,
        query: jsonStr["Query Text"],
        plan: JSON.stringify({ Plan: jsonStr["Plan"] }, null, 0)
      };
    }
  }

  return value;
};

export const mapHeadersFn = ({
  header: _,
  index
}: {
  header: string;
  index: number;
}):
  | "endTime"
  | "user"
  | "database"
  | "action"
  | "startTime"
  | "logType"
  | "message"
  | "clientName" => {
  if (index === 0) {
    return "endTime";
  }
  if (index === 1) {
    return "user";
  }
  if (index === 2) {
    return "database";
  }
  if (index === 7) {
    return "action";
  }
  if (index === 8) {
    return "startTime";
  }
  if (index === 11) {
    return "logType";
  }
  if (index === 13) {
    return "message";
  }
  if (index === 22) {
    return "clientName";
  }
  return null;
};
