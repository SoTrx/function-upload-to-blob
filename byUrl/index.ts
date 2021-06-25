/**
 * Form based-approach, suitable for small files that can be
 * fully uploaded within the 5-10 minutes function livespan
 */

import { Context, HttpRequest } from "@azure/functions";
import * as multipart from "parse-multipart";
import { formatReply } from "../common/index";
import HTTP_CODES from "http-status-enum";

export default async function httpTrigger(
  context: Context,
  req: HttpRequest
): Promise<any> {
  // Check for required parameters. A filename must be provided to write to the Blob Storage
  if (!req.query?.filename)
    return formatReply(`Filename is not defined`, HTTP_CODES.BAD_REQUEST);
  if (!req.body || !req.body.length)
    return formatReply(`Request body is not defined`, HTTP_CODES.BAD_REQUEST);

  try {
    // Each chunk of the file is delimited by a special string
    const bodyBuffer = Buffer.from(req.body);
    const boundary = multipart.getBoundary(req.headers["content-type"]);
    const parts = multipart.Parse(bodyBuffer, boundary);

    // The file buffer is corrupted or incomplete ?
    if (!parts?.length)
      return formatReply("File buffer is incorrect", HTTP_CODES.BAD_REQUEST);

    // Actual upload, using an output binding
    context.bindings.storage = parts[0]?.data;
  } catch (err) {
    context.log.error(err.message);
    return formatReply(err.message, HTTP_CODES.INTERNAL_SERVER_ERROR);
  }
  return formatReply("OK");
}
