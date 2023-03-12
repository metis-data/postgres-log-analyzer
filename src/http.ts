import { DEFAULT_REQUEST_TIMEOUT_IN_SEC } from "./consts";
import axios from "axios";

export const makeHttpRequest = (
  url: string,
  method: string,
  data: any,
  headers: any,
  timeout = DEFAULT_REQUEST_TIMEOUT_IN_SEC
) => {
  return axios({
    method,
    url,
    data,
    headers,
    timeout: timeout * 1000,
    timeoutErrorMessage: "REQUEST_TIMEOUT"
  });
};

module.exports = {
  makeHttpRequest
};
