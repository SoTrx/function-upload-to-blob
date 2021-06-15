/**
 * Uploading large file in a function cannot be done via a form based approach.
 * The function timeout (5 to 10 minutes) is way too short for it.
 * This approach is generating a saskey and letting the client handle the upload.
 */

import { Context, HttpRequest } from "@azure/functions";
import { env } from "process";
import {
  BlobClient,
  BlobSASPermissions,
  BlobServiceClient,
} from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

export default async function httpTrigger(
  context: Context,
  req: HttpRequest
): Promise<any> {
  context.log("HTTP trigger function processed a request.");

  const filename = req.query?.filename;
  if (!filename) return formatReply(`Filename is not defined`, 400);
  const inboundIp = req.headers["x-forwarded-for"];
  if (!inboundIp) {
    context.log.error(`Couldn't retrive inbound ip. Headers dump :`);
    context.log.error(req.headers);
    return formatReply(`Malformed request`, 422);
  }

  context.log.verbose(
    `Blob Storage QS is ${env.BlobStorageQS}. Input container is ${env.InputContainer}`
  );
  const blobClient = getBlobClient(
    env.BlobStorageQS,
    env.InputContainer,
    filename
  );
  if (blobClient === undefined) {
    context.log.error("Couldn't get blob client ! env dump :");
    context.log.error({
      qs: env.BlobStorageQS,
      containerName: env.InputContainer,
      filename: filename,
    });
    return formatReply(`Unexpected error.`, 500);
  }
  // @TODO: A "file count by ip" limit could be implemented
  const sasKey = await generateSasKeyForClient(blobClient, inboundIp);
  context.log.info(
    `Successfully generated SAS key for file ${filename} and ip ${inboundIp}`
  );
  return { status: 200, body: JSON.stringify({ key: sasKey }) };
}

/**
 * Generate a write-only key for the given blob
 * @param blobClient Azure blob client
 * @param inboundIp Ip to authorize the upload from
 * @param hours Time limit, in hours. Default is 24
 * @returns Sas key string
 */
function generateSasKeyForClient(
  blobClient: BlobClient,
  inboundIp: string,
  hours = 24
): Promise<string> {
  // Set start date to five minutes ago, to avoid some clock drifting shenaningans
  let startDate = new Date();
  startDate.setMinutes(startDate.getMinutes() - 5);
  // Give a x hours access to upload the blob.
  const expiresDate = new Date(
    new Date(startDate).getTime() + 1000 * 3600 * hours
  );

  // Only allows the calling ip to write to the Blob for a limited amount of time
  return blobClient.generateSasUrl({
    startsOn: startDate,
    expiresOn: expiresDate,
    //ipRange: { start: inboundIp, end: inboundIp },
    permissions: BlobSASPermissions.parse("w"),
  });
}
/**
 *
 * @param storageQs Connection string to the storage account
 * @param containerName Name of the container to access
 * @param filePrefix Optional blobname prefix. An uuid is concatenated to the end of the filename in any case
 * @returns BlobClient
 */
function getBlobClient(
  storageQs: string,
  containerName: string,
  filePrefix?: string
): BlobClient {
  const blobServiceClient = BlobServiceClient.fromConnectionString(storageQs);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  return containerClient.getBlobClient(`${filePrefix ?? ""}-${uuidv4()}`);
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
