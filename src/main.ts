// call package read CSV file
import fs from "fs";
import csv from "csv-parser";
import debounce from "lodash.debounce";
import path from "path";
import config from "config";

console.log(config)
  
const filepath = path.join(
  __dirname,
  "../logs/postgresql-2023-03-06_213258.csv"
);


export const setup = ({ logsDir }) => {
  if(!fs.lstatSync(logsDir).isDirectory()){
    throw new Error(`Logs diriectory is required: ${logsDir}`);
  }
}

const regexExtractDuration = /duration:\s+(\d+\.\d+)\s+ms/;

let lastPosition = 0; // keep track of last position in file

let firstRun = true;

export const handle = debounce(() => {
  const readStream = fs.createReadStream(filepath, { start: lastPosition });
  readStream
    .pipe(
      csv({
        mapHeaders: ({ header: _, index }) => {
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
        },
        mapValues: ({ header, index: _, value }) => {
          if (header === "endTime" || header === "startTime") {
            return new Date(value).toISOString();
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
                query: `${jsonStr["Query Text"]}`,
                plan: jsonStr.Plan
              };
            }
          }

          return value;
        }
      })
    )
    .on("data", (data) => {
      // handle each new row of data here
      console.log(data);
    })
    .on("error", (error) => {
      // handle errors here
      console.error(error);
    })
    .on("end", () => {
      // update last position in file
      lastPosition = fs.statSync(filepath).size;
      if (firstRun) {
        firstRun = false;
        fs.watch(filepath, (event, _filename) => {
          if (event === "change") {
            handle();
          }
        });
      }

      console.log("End of file");
    });
}, 1000);

handle();
