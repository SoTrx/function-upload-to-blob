import { env } from "process";
import type { Context } from "@azure/functions";

/**
 * Use a message
 * @param message
 * @param statusCode
 * @returns
 */
export function formatReply(
  message: any,
  statusCode = 200,
  headers?: Record<string, any>
): Record<string, any> {
  const res: Record<string, any> = {
    status: statusCode,
    body: message,
  };
  res.headers = headers;
  return res;
}

/**
 * Safely retrieve a var from the environment.
 * @param varName Name of the env variable
 * @param fallback Fallback value
 * @param ctx used to issue a warning when a variable isn't defined
 * @returns the var value of a fallback
 */
export function getEnvVar<T>(varName: string, fallback: T, ctx: Context): T {
  const envVar = env[varName];
  if (envVar === undefined) {
    ctx.log.warn(`${varName} isn't defined ! Defaulting to ${fallback}.`);
    return fallback;
  }
  return envVar as unknown as T;
}

/**
 * Ensure an ip range is something like '176.134.171.0-176.134.171.255'. Throws if the range isn't valid
 * @param ipRange candidate ip range
 * @returns both ip separated
 */
export function parseIpRange(ipRange: string): [string, string] {
  const ipRegex = /(?=.*[^\.]$)((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.?){4}/;
  const ipArray = ipRange.split("-");
  if (
    // A range only has two IPs
    ipArray.length !== 2 ||
    // That must be valid IPs
    ipArray.map((ip) => ipRegex.test(ip)).some((valid) => !valid)
  )
    throw new Error(`Invalid ip range provided ${ipRange}`);

  return ipArray as [string, string];
}
