import func from "./index";
import { Context, HttpRequest } from "@azure/functions";
import { Substitute } from "@fluffy-spoon/substitute";
import * as localSettings from "../local.settings.json";
import { env } from "process";
// Manually load up env variables, as the func runtime would
//require("dotenv-safe").config();
describe("Unit test bySas", () => {
  const localSettings = {
    IsEncrypted: false,
    Values: {
      AzureWebJobsStorage: "",
      FUNCTIONS_WORKER_RUNTIME: "node",
      BlobStorageQS: "UseDevelopmentStorage=true",
      InputContainer: "test",
    },
  };
  beforeAll(() => {
    Object.entries(localSettings.Values).forEach(
      ([key, value]) => (env[key] = value)
    );
  });

  describe("Should handle common errors gracefully", () => {
    it("Ip missing", async () => {
      const [context, request] = formatUploadRequest("test", null, {});
      const response = await func(context, request);
      expect(response.status).toBe(422);
    });
    it("Filename missing", async () => {
      const [context, request] = formatUploadRequest("", null, {
        "x-forwarded-for": "1.1.1.1",
      });
      const response = await func(context, request);
      expect(response.status).toBe(400);
    });
  });

  describe("Ideal case", () => {
    it("Basic", async () => {
      const [context, request] = formatUploadRequest("test", null, {
        "x-forwarded-for": "1.1.1.1",
      });
      const response = await func(context, request);
      expect(response.status).toBe(200);
      console.log(response.body);
      expect(response.body).toBeDefined();
    }, 10000);
  });
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
