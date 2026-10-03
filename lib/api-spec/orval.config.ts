import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  storefrontClient: {
    input: { target: "./storefront.yaml" },
    output: {
      target: path.resolve(root, "lib/erp-api-client-react/src/generated/storefront.ts"),
      schemas: path.resolve(root, "lib/erp-api-client-react/src/generated/storefront-models"),
      client: "react-query",
      mode: "single",
      baseUrl: "/api",
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: {
          path: path.resolve(root, "lib/erp-api-client-react/src/custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  storefrontZod: {
    input: { target: "./storefront.yaml" },
    output: {
      target: path.resolve(root, "lib/erp-api-zod/src/generated/storefront.ts"),
      client: "zod",
      mode: "single",
      override: { zod: { version: 3 } },
    },
  },
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
