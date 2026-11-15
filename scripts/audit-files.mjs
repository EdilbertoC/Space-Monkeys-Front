import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const normalize = (file) => path.relative(root, file).replaceAll("\\", "/");
const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
const sources = walk(path.join(root, "src"));
const tests = walk(path.join(root, "tests"));
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const missing = [];
const graph = new Map();

for (const file of [...sources, ...tests]) {
  if (!/\.(?:tsx?|mjs)$/.test(file)) continue;
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const edges = [];
  const resolve = (specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return;
    const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
    const direct = path.resolve(path.dirname(file), specifier);
    const dependency = resolved?.resolvedFileName ?? (fs.existsSync(direct) ? direct : null);
    if (dependency) edges.push(path.resolve(dependency));
    else missing.push({ file: normalize(file), specifier });
  };
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      resolve(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      resolve(node.arguments[0].text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      resolve(node.argument.literal.text);
    } else if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "URL" &&
      node.arguments?.length &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      resolve(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  graph.set(file, edges);
}

function reachable(entries) {
  const visited = new Set();
  const pending = entries.map((entry) => path.resolve(root, entry));
  while (pending.length) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    pending.push(...(graph.get(file) ?? []));
  }
  return visited;
}

const application = reachable(["src/main.tsx"]);
// These entrypoints are explicitly reserved by docs/backend-integration.md.
const integration = reachable(["src/app/api.ts", "src/shared/api/useApiResource.ts"]);
const tested = reachable(tests);
const inventory = sources.map((file) => ({
  file: normalize(file),
  purpose: application.has(file)
    ? "application"
    : integration.has(file)
      ? "backend integration"
      : tested.has(file)
        ? "tests only"
        : file.endsWith(".d.ts")
          ? "TypeScript declarations"
          : "unreferenced",
}));
const unreferenced = inventory.filter((entry) => entry.purpose === "unreferenced");
if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify({ files: inventory.length, missing, unreferenced, inventory }, null, 2),
  );
} else {
  const counts = {};
  for (const entry of inventory) counts[entry.purpose] = (counts[entry.purpose] ?? 0) + 1;
  console.log(
    JSON.stringify({ files: inventory.length, categories: counts, missing, unreferenced }, null, 2),
  );
}
if (missing.length || unreferenced.length) process.exitCode = 1;
