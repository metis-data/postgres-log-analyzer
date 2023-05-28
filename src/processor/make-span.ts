import { getPackageVersion } from "../utils";
import { v4 as uuidv4 } from "uuid";
import os from "os";
let resource: object;
const version = getPackageVersion();
function getResource() {
  if (resource) {
    return resource;
  }

  const vendor = "nodejs";

  // get host name
  let hostName = vendor;
  try {
    hostName = os.hostname();
  } catch (e) {}

  resource = {
    "service.name": hostName,
    "service.version": version,
    "telemetry.sdk.name": vendor,
    "telemetry.sdk.version": version,
    "telemetry.sdk.language": vendor
  };

  return resource;
}

export function makeSpan(csvItem: any) {
  let {
    message: { duration, query, plan },
    startTime,
    endTime,
    action,
    user,
    database
  } = csvItem;

  const spanId = uuidv4();
  const traceId = uuidv4();

  duration = duration ?? ((plan && plan["Execution Time"]) || 1);

  return {
    parent_id: null,
    name: action,
    kind: "SpanKind.CLIENT",
    timestamp: Date.now(),
    duration: duration,
    start_time: startTime,
    end_time: new Date(new Date(startTime).getTime() + duration).toISOString(),
    attributes: {
      "db.name": database,
      "db.user": user,
      "db.system": "postgresql",
      "db.operation": action,
      "db.statement": query,
      "db.statement.metis": query,
      "db.statement.metis.plan": plan,
      "net.peer.name": "unknown",
      "net.peer.ip": "unknown"
    },
    status: {
      status_code: "UNSET"
    },
    context: {
      span_id: spanId,
      trace_id: traceId
    },
    resource: getResource()
  };
}
