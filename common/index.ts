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
