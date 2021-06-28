import func from "./index";
import { Context, HttpRequest } from "@azure/functions";
import { Substitute } from "@fluffy-spoon/substitute";
import { env } from "process";
import { decode } from "querystring";
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

  /**
   * Azurite must be running !
   */
  describe.each([
    ["None", undefined],
    ["SAS_LIMIT_HOURS", 6],
  ])("Setting SAS_LIMIT to env", (varName, value) => {
    it("Full test", async () => {
      env[varName] = String(value);
      const DEFAULT_SAS_LIMIT = 24;
      const [context, request] = formatUploadRequest("test", null, {
        "x-forwarded-for": "1.1.1.1",
      });
      const response = await func(context, request);
      expect(response.status).toBe(200);
      console.log(response.body);
      expect(response.body).toBeDefined();

      // Checking sas validity span. When not provided this value should be 24h
      const qs = decode(response.body.split("?")[1]);
      const sasValidFrom = new Date(qs.st as string);
      const sasValidTo = new Date(qs.se as string);
      const timeDiff = sasValidTo.getTime() - sasValidFrom.getTime();
      expect(Math.round(timeDiff / 1000 / 3600)).toBe(
        value ?? DEFAULT_SAS_LIMIT
      );
      //expect(response.body)
    }, 15000);
  });

  describe.each([
    ["None", undefined],
    ["SAS_IP_RANGE", "176.134.171.0-176.134.171.255"],
  ])("Setting SAS_IP_RANGE to valid values", (varName, value) => {
    it("Full test", async () => {
      env[varName] = String(value);
      const DEFAULT_IP_RANGE = undefined;
      const [context, request] = formatUploadRequest("test", null, {
        "x-forwarded-for": "1.1.1.1",
      });
      const response = await func(context, request);
      expect(response.status).toBe(200);
      console.log(response.body);
      expect(response.body).toBeDefined();
      const qs = decode(response.body.split("?")[1]);
      expect(qs.sip).toBe(value ?? DEFAULT_IP_RANGE);
    }, 15000);
  });
});

describe.each([
  ["SAS_IP_RANGE", "176.134.171.0"],
  ["SAS_IP_RANGE", "somerandomstring"],
  ["SAS_IP_RANGE", 6],
])("Setting SAS_IP_RANGE to invalid values", (varName, value) => {
  it("Full test", async () => {
    env[varName] = String(value);
    const [context, request] = formatUploadRequest("test", null, {
      "x-forwarded-for": "1.1.1.1",
    });
    expect(func(context, request)).rejects.toThrow();
  }, 15000);
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
