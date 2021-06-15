/** These tests must be runned while the local function emulator is alive */
import * as FormData from "form-data";
import { createReadStream } from "fs";
import { join } from "path";
import { stringify } from "querystring";

describe("Should upload a file", () => {
  it("Small file", async () => {
    const form = new FormData();
    form.append("test", createReadStream(join(__dirname, "../assets/hey.png")));
    const qs = stringify({ filename: "meh.png" });
    form.submit(
      {
        method: "POST",
        port: 7071,
        host: "localhost",
        path: `/api/byUrl?${qs}`,
      },
      (err, res) => {
        expect(err).toBe(null);
        expect(res.statusCode).toBe(200);
        res.resume();
      }
    );
  });
});
