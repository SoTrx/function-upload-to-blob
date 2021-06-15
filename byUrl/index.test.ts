import func from "./index";
import { Context, HttpRequest } from "@azure/functions";
import { Substitute } from "@fluffy-spoon/substitute";
import { promises } from "fs";
import { join } from "path";
import * as FormData from "form-data";
describe("Should handle common errors gracefully", () => {
  it("Empty file", async () => {
    const [context, request] = formatUploadRequest("test", Buffer.alloc(0));
    const response = await func(context, request);
    expect(response.status).toBe(400);
  });
  it("Filename missing", async () => {
    const [context, request] = formatUploadRequest("", Buffer.alloc(0));
    const response = await func(context, request);
    expect(response.status).toBe(400);
  });
  it("No file provided", async () => {
    const [context, request] = formatUploadRequest("", undefined);
    const response = await func(context, request);
    expect(response.status).toBe(400);
  });
});

// This suite is non-fonctionnal, the returned form buffer from
// form data doesn't seem to have the correct format.
describe.skip("Should succeed to upload a file", () => {
  it("Small file", async () => {
    const form = new FormData();
    form.append(
      "test",
      await promises.readFile(join(__dirname, "../assets/hey.png"))
    );
    const [context, request] = formatUploadRequest(
      "test",
      form.getBuffer(),
      form.getHeaders()
    );
    const response = await func(context, request);
    expect(response.status).toBe(200);
  }, 20000);
});

/**
 * Returns mocked Az function Context and Request to test a function without a server
 * @param filename Name of the pseudo-file to upload
 * @param bytes Content of the file to upload
 * @returns
 */
function formatUploadRequest(
  filename: string,
  bytes?: Buffer,
  headers?: Record<string, string>
): [Context, HttpRequest] {
  // Mocking an http request as the function should receive
  const request = Substitute.for<HttpRequest>();
  (request.query.returns as any)({ filename: filename });
  if (bytes) (request.body.returns as any)(bytes);
  if (headers) (request.headers.returns as any)(headers);

  // Mocking the context, especially overriding the storage binding
  const context = Substitute.for<Context>();
  (context.req as any).returns({ req: request });
  (context.bindings as any).returns({ storage: undefined });

  return [context, request];
}
