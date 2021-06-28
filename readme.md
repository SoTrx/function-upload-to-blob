# Upload file to Blob

[![codecov](https://codecov.io/gh/SoTrx/function-upload-to-blob/branch/master/graph/badge.svg?token=JOYBSR1RLZ)](https://codecov.io/gh/SoTrx/function-upload-to-blob)
[![Deploy to Azure](https://img.shields.io/badge/Deploy%20To-Azure-blue?logo=microsoft-azure)](https://portal.azure.com/?WT.mc_id=dotnet-0000-frbouche#create/Microsoft.Template/uri/https%3A%2F%2Fgist.githubusercontent.com%2FSoTrx%2Fd108f66c1c50af5e084e71af71be99b3%2Fraw%2F022cfad8c1a9df1345215a24f38f7b38c869841b%2Fdeploy.json%0A)

This Azure function allows for file uploading to a Storage container.

There are two uploading methods available :

- **Using a File URL**: Direct upload using a multipart form. Great for small files.
- **Using a SaS Key**: Indirect upload. In this case, the function only generates a SaS key. Great for large files.

### Why two upload methods ?

By design, a function timeouts after 5 minutes. Although this can be extended to 10 minutes, this is nowhere near enough for large file upload.

Using a function to generate a SaS key allows to circumvent this problem by letting the client handle the upload.

## Installation

The **deploy to Azure button** above will deploy a Node 14 linux functionApp with its associated storage container and application insight. The code will be deployed from GH directly.

You can also choose to deploy the function manually. To do that, you must first create an [Azure Function App](https://docs.microsoft.com/en-us/azure/azure-functions/functions-get-started?pivots=programming-language-csharp). You can either :

- Use a **Node 14** runtime and deploy the code using [the Az CLI](https://docs.microsoft.com/fr-fr/cli/azure/functionapp?view=azure-cli-latest#az_functionapp_deploy) , the VS Code extension (CTRL + SHIFT + P -> Deploy to Function App), or creating a new *Application Setting* (in the *Configuration* panel) with name `WEBSITE_RUN_FROM_PACKAGE` and value `https://github.com/SoTrx/function-upload-to-blob/releases/latest/download/default.function-upload-to-blob.zip`.
  
- Use a **Docker** runtime and then put _dockerutils/function-upload-to-blob_ in _Container Settings_ once the Function App is created.

## Usage

Two **POST** endpoints are exposed, corresponding to the two upload methods.

- _/api/byUrl_ : Direct upload method. This endpoint expect a multipart/form-data input. In browsers, the native [FormData object](https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects#sending_files_using_a_formdata_object) can be used to create such input.
- _/api/bySaS_ : Indirect upload method. Only returns a SaS url for a single blob in _InputContainer_.

See [the provided sample](#sample-client-side-service-browser-code-typescript) for a client-side service using this function.

**In both cases, a filename must be provided in the request body**. This stems from a [Blob output binding](https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-blob-output?tabs=csharp) limitation, it's not possible to set the filename parameter (see byUrl/function.json) during the function execution.

## Configuration

This function uses two variables :

- **BlobStorageQS** : The connection string for the storage account to use
- **InputContainer** : The storage account container to upload the file into

See [application settings documentation](https://docs.microsoft.com/en-us/azure/azure-functions/functions-how-to-use-azure-function-app-settings#settings) for more details.

```json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "dataType": "binary",
      "methods": ["post"]
    },
    {
      "direction": "out",
      "name": "$return",
      "type": "http"
    },
    {
      "name": "storage",
      "type": "blob",
      "path": "%InputContainer%/{filename}",
      "direction": "out",
      "connection": "BlobStorageQS"
    }
  ],
  "scriptFile": "../dist/byUrl/index.js"
}
```

## Running tests

Two types of tests are included :

- index.test.ts files are for unit testing, included in the coverage
- index.e2e.test.ts files needs the function server to run (using `yarn start`). These are excluded from the coverage report. You will also need your own _localsettings.json_.

## Sample client-side service (Browser code, Typescript)

```ts
import axios from "axios";
import { BlockBlobClient } from "@azure/storage-blob";
import { EventEmitter } from "events";

export class UploadService extends EventEmitter {
  private readonly endpoints = {
    uploadFile: (name: string) =>
      `${this.baseUrl}/api/byUrl?code=${this.key}&filename=${encodeURIComponent(
        name
      )}`,
    getSasKey: (name: string) =>
      `${this.baseUrl}/api/bySas?code=${this.key}&filename=${encodeURIComponent(
        name
      )}`,
  };
  /** A file is considered large when over 5 MB */
  private static readonly SIZE_THRESHOLD = 5 * 1024 * 1024;
  /** Size of a chunk for a chunked upload */
  private static readonly UPLOAD_BLOCK_SIZE = 2 * 1024 * 1024;
  /** Max concurrent chunk to upload in parallel */
  private static readonly UPLOAD_CONCURRENCY_LIMIT = 5;

  constructor(private baseUrl: string, private key: string) {
    super();
  }

  /**
   * Upload a file to the backend. The upload percentage is updated each time
   * @param file
   * @param filename
   */
  async upload(file: File, filename: string): Promise<void> {
    return file.size <= UploadService.SIZE_THRESHOLD
      ? this.uploadSmallFile(file, filename)
      : this.uploadLargeFile(file, filename);
  }

  /**
   * Upload a large file. As an Az function has a timeout of 5 to 10 minutes,
   * we instead ask the function for a SAS key, and handle the (chunked) upload
   * ourselves.
   * @param file File to upload
   * @param filename Filename
   */
  private async uploadLargeFile(file: File, filename: string): Promise<void> {
    const res = await axios.post(this.endpoints.getSasKey(filename));
    if (res.status !== 200) throw new Error(`Upload failed : ${res.data}`);
    const sasKey = res.data.key;
    const client = new BlockBlobClient(sasKey);
    await client.uploadBrowserData(file, {
      blockSize: UploadService.UPLOAD_BLOCK_SIZE,
      concurrency: UploadService.UPLOAD_CONCURRENCY_LIMIT,
      // @NOTE Workaround for issue https://github.com/Azure/azure-sdk-for-js/issues/4719
      // Without limiting the maxSingleshotSize, the progress event is fired randomly before
      // having uploaded anything.
      maxSingleShotSize: UploadService.UPLOAD_BLOCK_SIZE,
      onProgress: (p) => this.onUploadProgress(p.loadedBytes, file.size),
    });
  }

  /**
   * Upload a small file. A small file is a file that can be uploaded in the lifespan of an
   * Az function (5 to 10 minutes). In this case, the file is sent directly to the function.
   * @param file File to upload
   * @param filename File's name
   */
  private async uploadSmallFile(file: File, filename: string): Promise<void> {
    // FormData is natively available in browsers, this would need an external lib for node
    const formData = new FormData();
    formData.append("file", file);
    await axios.post(this.endpoints.uploadFile(filename), formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent: any) =>
        this.onUploadProgress(progressEvent.loaded, progressEvent.total),
    });
  }

  /**
   * Calculate and emit upload progress
   * @param loadedBytes currently uploaded bytes
   * @param totalBytes file size (bytes)
   */
  private onUploadProgress(loadedBytes: number, totalBytes: number): void {
    const uploadPercentage = Math.round((loadedBytes / totalBytes) * 100);
    if (uploadPercentage < 100) this.emit("progress", uploadPercentage);
    else this.emit("done");
  }
}
```
