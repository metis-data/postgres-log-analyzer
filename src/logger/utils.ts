export function log(
  level: string,
  stream: NodeJS.WriteStream,
  message: string
) {
  if (stream && message) {
    const time = new Date().getTime() / 1000;
    stream.write(`${time.toFixed(3)} ${level || "INFO"}: ${message}\n`);
  }
}
