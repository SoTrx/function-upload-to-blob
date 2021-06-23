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
import HTTP_CODES from "http-status-enum";
import { formatReply } from "../common/index";

export default async function httpTrigger(
  context: Context,
  req: HttpRequest
): Promise<any> {
  context.log("HTTP trigger function processed a request.");

  const filename = req.query?.filename;
  if (!filename)
    return formatReply(`Filename is not defined`, HTTP_CODES.BAD_REQUEST);
  const inboundIp = req.headers["x-forwarded-for"];
  if (!inboundIp) {
    context.log.error(`Couldn't retrieve inbound ip. Headers dump :`);
    context.log.error(req.headers);
    return formatReply(`Malformed request`, HTTP_CODES.UNPROCESSABLE_ENTITY);
  }

  context.log.verbose(
    `Blob Storage QS is ${env.BlobStorageQS}. Input container is ${env.InputContainer}`
  );
  const blobClient = await getBlobClient(
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
    return formatReply(`Unexpected error.`, HTTP_CODES.INTERNAL_SERVER_ERROR);
  }
  // @TODO: A "file count by ip" limit could be implemented
  const sasKey = await generateSasKeyForClient(blobClient, inboundIp);
  context.log.info(
    `Successfully generated SAS key for file ${filename} and ip ${inboundIp}`
  );
  return formatReply(JSON.stringify({ key: sasKey }));
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
  const startDate = new Date();
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
    // Only allow the client to write to the Blob, not to read or list the container.
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
async function getBlobClient(
  storageQs: string,
  containerName: string,
  filePrefix?: string
): Promise<BlobClient> {
  const blobServiceClient = BlobServiceClient.fromConnectionString(storageQs);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();
  return containerClient.getBlobClient(`${filePrefix ?? ""}-${uuidv4()}`);
}
