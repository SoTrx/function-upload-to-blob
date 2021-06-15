/**
 * Form based-approach, suitable for small files that can be
 * fully uploaded within the 5-10 minutes function livespan
 */

import { Context, HttpRequest } from "@azure/functions";
import * as multipart from "parse-multipart";

export default async function httpTrigger(
  context: Context,
  req: HttpRequest
): Promise<any> {
  // Check for required parameters. A filename must be provided to write to the Blob Storage
  if (!req.query?.filename) return formatReply(`Filename is not defined`, 400);
  if (!req.body || !req.body.length)
    return formatReply(`Request body is not defined`, 400);

  try {
    // Each chunk of the file is delimited by a special string
    const bodyBuffer = Buffer.from(req.body);
    const boundary = multipart.getBoundary(req.headers["content-type"]);
    const parts = multipart.Parse(bodyBuffer, boundary);

    context.bindings.storage = parts[0].data;
  } catch (err) {
    context.log.error(err.message);
    return formatReply(err.message, 500);
  }
  return formatReply("OK");
}

/**
 * Use a message
 * @param message
 * @param statusCode
 * @returns
 */
function formatReply(message: string, statusCode = 200) {
  return {
    status: statusCode,
    body: message,
  };
}
