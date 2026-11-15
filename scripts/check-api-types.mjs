import fs from "node:fs/promises";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const generated = new URL("../src/shared/api/generated/schema.ts", import.meta.url);
const ast = await openapiTS(new URL("../contracts/openapi.yaml", import.meta.url));
const actual = (await fs.readFile(generated, "utf8")).replaceAll("\r\n", "\n");
const expected = (COMMENT_HEADER + astToString(ast)).replaceAll("\r\n", "\n");
if (actual !== expected) {
  console.error("API types differ from contracts/openapi.yaml. Run npm run api:generate.");
  process.exitCode = 1;
} else {
  console.log("API types match the OpenAPI contract.");
}
