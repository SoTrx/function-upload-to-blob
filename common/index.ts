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
