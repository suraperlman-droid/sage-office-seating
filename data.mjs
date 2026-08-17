// node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify: Netlify2, process } = globalThis;
  return Netlify2?.env ?? Deno?.env ?? {
    delete: (key) => delete process?.env[key],
    get: (key) => process?.env[key],
    has: (key) => Boolean(process?.env[key]),
    set: (key, value) => {
      if (process?.env) {
        process.env[key] = value;
      }
    },
    toObject: () => process?.env ?? {}
  };
};

// node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// node_modules/@netlify/blobs/dist/chunk-FWVYH726.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var DEPLOY_STORE_PREFIX = "deploy:";
var SITE_STORE_PREFIX = "site:";
var isDeniedWrite = (res, { method, storeName }) => (res.status === 401 || res.status === 403) && (method === "put" || method === "delete") && storeName !== void 0 && !storeName.startsWith(DEPLOY_STORE_PREFIX);
var blobsErrorMessage = (res, context) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
  }
  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX) ? context.storeName.slice(SITE_STORE_PREFIX.length) : context.storeName;
    return `Netlify Blobs could not write to store '${storeName}' (${details}). Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`;
  }
  return `Netlify Blobs has generated an internal error (${details})`;
};
var BlobsInternalError = class extends Error {
  constructor(res, context = {}) {
    super(blobsErrorMessage(res, context));
    this.name = "BlobsInternalError";
  }
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY) => {
  try {
    const res = await fetch(url, options);
    if (attemptsLeft > 0 && (res.status === 429 || res.status >= 500)) {
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      return fetchAndRetry(fetch, url, options, attemptsLeft - 1);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    return fetchAndRetry(fetch, url, options, attemptsLeft - 1);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw new BlobsInternalError(res, { method, storeName });
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    return fetchAndRetry(this.fetch, url, options);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res, { method: "delete", storeName: this.name });
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        throw new BlobsInternalError(res, { method: "delete", storeName: this.name });
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200) {
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res, { method: "put", storeName: this.name });
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        return res.status === STATUS_PRE_CONDITION_FAILED ? { modified: false } : { etag, modified: true };
      }
      if (res.status === STATUS_OK) {
        return {
          etag,
          modified: true
        };
      }
      throw new BlobsInternalError(res, { method: "put", storeName: this.name });
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const clientOptions = getClientOptions(input);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// netlify/functions/seed-data.json
var seed_data_default = [
  {
    id: "room-room-1",
    name: "Room 1",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R01-11",
        status: "occupied",
        occupant: "Sarah Einhorn",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R01-12",
        status: "occupied",
        occupant: "Rochi Gelfand",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R01-15",
        status: "occupied",
        occupant: "Layala Brach",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R01-14",
        status: "occupied",
        occupant: "Zissy Hershkowitz",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R01-10",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R01-13",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-2",
    name: "Room 2 \u2014 Conference Room",
    type: "conference",
    seats: []
  },
  {
    id: "room-room-3",
    name: "Room 3",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R03-31",
        status: "occupied",
        occupant: "Malky Friedman",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R03-32",
        status: "occupied",
        occupant: "Peri Rottenberg",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R03-33",
        status: "occupied",
        occupant: "Henny Fischer",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R03-34",
        status: "occupied",
        occupant: "Chany Brecher",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R03-35",
        status: "occupied",
        occupant: "Chany Tyberg",
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R03-36",
        status: "occupied",
        occupant: "Shifra Kaufman",
        leave: null,
        team: null
      },
      {
        seatNumber: 7,
        deskId: "SAGE-R03-37",
        status: "occupied",
        occupant: "Nechama Miriam Herman",
        leave: null,
        team: null
      },
      {
        seatNumber: 8,
        deskId: "SAGE-R03-38",
        status: "occupied",
        occupant: "Rochel Leah Goldberger",
        leave: null,
        team: null
      },
      {
        seatNumber: 9,
        deskId: "SAGE-R03-39",
        status: "occupied",
        occupant: "Malky Brach",
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-4",
    name: "Room 4",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R04-41",
        status: "occupied",
        occupant: "Romi Feldman",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R04-42",
        status: "occupied",
        occupant: "Gitty Jacobawitz",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R04-43",
        status: "occupied",
        occupant: "Nomi Reich",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R04-44",
        status: "occupied",
        occupant: "Breindy Frand",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R04-48",
        status: "occupied",
        occupant: "Rina Benedikt",
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R04-49",
        status: "occupied",
        occupant: "Vivian Cohen",
        leave: null,
        team: null
      },
      {
        seatNumber: 7,
        deskId: "SAGE-R04-50",
        status: "occupied",
        occupant: "Chayala Englard",
        leave: null,
        team: null
      },
      {
        seatNumber: 8,
        deskId: "SAGE-R04-47",
        status: "occupied",
        occupant: "Dini Wolodarsky",
        leave: null,
        team: null
      },
      {
        seatNumber: 9,
        deskId: "SAGE-R04-46",
        status: "occupied",
        occupant: "Chavy Guttman",
        leave: null,
        team: null
      },
      {
        seatNumber: 10,
        deskId: "SAGE-R04-45",
        status: "occupied",
        occupant: "Sura Gitty Perlman",
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-5",
    name: "Room 5",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R05-51",
        status: "occupied",
        occupant: "Leah Brach",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R05-52",
        status: "occupied",
        occupant: "Ruchi Eisen",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R05-53",
        status: "occupied",
        occupant: "Blimi Schwartz",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R05-54",
        status: "occupied",
        occupant: "Shoshana Raizel",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R05-55",
        status: "occupied",
        occupant: "Perella Benedikt",
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R05-56",
        status: "occupied",
        occupant: "Rivki Schwartz",
        leave: null,
        team: null
      },
      {
        seatNumber: 7,
        deskId: "SAGE-R05-59",
        status: "occupied",
        occupant: "Malli Schreiber",
        leave: null,
        team: null
      },
      {
        seatNumber: 8,
        deskId: "SAGE-R05-58",
        status: "occupied",
        occupant: "Goldy Gottlieb",
        leave: null,
        team: null
      },
      {
        seatNumber: 9,
        deskId: "SAGE-R05-57",
        status: "occupied",
        occupant: "Udi Zelcer",
        leave: null,
        team: null
      },
      {
        seatNumber: 10,
        deskId: "SAGE-R05-62",
        status: "occupied",
        occupant: "Chayelle Wolf",
        leave: null,
        team: null
      },
      {
        seatNumber: 11,
        deskId: "SAGE-R05-61",
        status: "occupied",
        occupant: "Rikki Wiesner",
        leave: null,
        team: null
      },
      {
        seatNumber: 12,
        deskId: "SAGE-R05-60",
        status: "occupied",
        occupant: "Rikki Meisels",
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-7",
    name: "Room 7",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R07-71",
        status: "occupied",
        occupant: "Hennie Langner",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R07-72",
        status: "occupied",
        occupant: "Pelli Naiman",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R07-73",
        status: "occupied",
        occupant: "Yehudis Appel",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R07-74",
        status: "occupied",
        occupant: "Chani Kovelenko",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R07-75",
        status: "occupied",
        occupant: "Esther Wengner",
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R07-76",
        status: "occupied",
        occupant: "Gitty Katzenberg",
        leave: null,
        team: null
      },
      {
        seatNumber: 7,
        deskId: "SAGE-R07-77",
        status: "occupied",
        occupant: "Mirala Fink",
        leave: null,
        team: null
      },
      {
        seatNumber: 8,
        deskId: "SAGE-R07-78",
        status: "occupied",
        occupant: "Chani Pluczenik",
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-8-\u2014-little-room",
    name: "Room 8 \u2014 Little Room",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R08-81",
        status: "occupied",
        occupant: "Golda Gold",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R08-82",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R08-83",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-9",
    name: "Room 9",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R09-91",
        status: "occupied",
        occupant: "Fraidy Greenwald",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R09-92",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R09-93",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R09-94",
        status: "empty",
        occupant: null,
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-10",
    name: "Room 10",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R10-101",
        status: "occupied",
        occupant: "Zissy Bernstien",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R10-102",
        status: "occupied",
        occupant: "Dina Friedman",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R10-103",
        status: "occupied",
        occupant: "Esti Friedman",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R10-104",
        status: "occupied",
        occupant: "Bella Reiner",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R10-105",
        status: "occupied",
        occupant: "Bina Blau",
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-11",
    name: "Room 11",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R11-111",
        status: "occupied",
        occupant: "Suri Hayum",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R11-112",
        status: "occupied",
        occupant: "Malky Templer",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R11-113",
        status: "occupied",
        occupant: "Goldi Kraus",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R11-114",
        status: "occupied",
        occupant: "Chanie Fink",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R11-115",
        status: "occupied",
        occupant: "Sarah Ettinger",
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R11-117",
        status: "occupied",
        occupant: "Perela Goldenberg",
        leave: null,
        team: null
      },
      {
        seatNumber: 7,
        deskId: "SAGE-R11-116",
        status: "occupied",
        occupant: "Malky Templer",
        leave: null,
        team: null
      }
    ]
  },
  {
    id: "room-room-12",
    name: "Room 12",
    type: "desks",
    seats: [
      {
        seatNumber: 1,
        deskId: "SAGE-R12-121",
        status: "occupied",
        occupant: "Chany Van Messel / Mayerfeld",
        leave: null,
        team: null
      },
      {
        seatNumber: 2,
        deskId: "SAGE-R12-122",
        status: "occupied",
        occupant: "Miri Weinstock",
        leave: null,
        team: null
      },
      {
        seatNumber: 3,
        deskId: "SAGE-R12-123",
        status: "occupied",
        occupant: "Rachel Saffer",
        leave: null,
        team: null
      },
      {
        seatNumber: 4,
        deskId: "SAGE-R12-124",
        status: "occupied",
        occupant: "Chevy Goldner",
        leave: null,
        team: null
      },
      {
        seatNumber: 5,
        deskId: "SAGE-R12-125",
        status: "occupied",
        occupant: "Sari Stern",
        leave: null,
        team: null
      },
      {
        seatNumber: 6,
        deskId: "SAGE-R12-126",
        status: "occupied",
        occupant: "Ruchy Bergman",
        leave: null,
        team: null
      },
      {
        seatNumber: 7,
        deskId: "SAGE-R12-127",
        status: "occupied",
        occupant: "Batsheva Eckstein",
        leave: null,
        team: null
      }
    ]
  }
];

// netlify/functions/data.mts
var STORE_NAME = "sage-office";
var KEY = "state";
function checkPasscode(req) {
  const expected = Netlify.env.get("OFFICE_PASSCODE");
  if (!expected) return true;
  const provided = req.headers.get("x-office-passcode") || "";
  return provided === expected;
}
function corsHeaders() {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, x-office-passcode",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  };
}
function indexSeats(rooms) {
  const map = /* @__PURE__ */ new Map();
  for (const room of rooms || []) {
    for (const seat of room.seats || []) {
      map.set(room.id + "::" + seat.seatNumber, seat);
    }
  }
  return map;
}
async function loadState(store) {
  const existing = await store.get(KEY, { type: "json" });
  if (existing && Array.isArray(existing.rooms)) return existing;
  const fresh = { rooms: seed_data_default, requests: [], updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  await store.setJSON(KEY, fresh);
  return fresh;
}
var data_default = async (req, _context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (!checkPasscode(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: corsHeaders()
    });
  }
  const store = getStore(STORE_NAME);
  if (req.method === "GET") {
    const state = await loadState(store);
    return new Response(JSON.stringify(state), { status: 200, headers: corsHeaders() });
  }
  if (req.method === "POST") {
    let parsed;
    try {
      parsed = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "bad json" }), { status: 400, headers: corsHeaders() });
    }
    const incomingRooms = Array.isArray(parsed.rooms) ? parsed.rooms : null;
    if (!incomingRooms) {
      return new Response(JSON.stringify({ error: "missing rooms" }), { status: 400, headers: corsHeaders() });
    }
    const incomingRequests = Array.isArray(parsed.requests) ? parsed.requests : null;
    const confirmedChanges = Array.isArray(parsed.confirmDeskIdChanges) ? parsed.confirmDeskIdChanges : [];
    const current = await loadState(store);
    const currentSeats = indexSeats(current.rooms);
    const blockedChanges = [];
    for (const room of incomingRooms) {
      for (const seat of room.seats || []) {
        const key = room.id + "::" + seat.seatNumber;
        const existingSeat = currentSeats.get(key);
        const existingDeskId = existingSeat ? existingSeat.deskId : null;
        if (existingDeskId && seat.deskId !== existingDeskId) {
          const confirmed = confirmedChanges.find(
            (c) => c.room === room.id && c.seatNumber === seat.seatNumber && c.oldId === existingDeskId && c.newId === seat.deskId
          );
          if (!confirmed) {
            blockedChanges.push({ room: room.id, seatNumber: seat.seatNumber, attempted: seat.deskId, keptAs: existingDeskId });
            seat.deskId = existingDeskId;
          }
        }
      }
    }
    const nextState = {
      rooms: incomingRooms,
      requests: incomingRequests !== null ? incomingRequests : current.requests || [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await store.setJSON(KEY, nextState);
    return new Response(JSON.stringify({ ok: true, state: nextState, blockedChanges }), {
      status: 200,
      headers: corsHeaders()
    });
  }
  return new Response("Method not allowed", { status: 405, headers: corsHeaders() });
};
var config = { path: "/api/data" };
export {
  config,
  data_default as default
};
