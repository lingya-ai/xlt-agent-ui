import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import path from "node:path";
const root = path.resolve("apps/docs/public");
const port = Number(process.env.REGISTRY_PORT ?? 4602);
const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  const file = path.resolve(root, `.${new URL(request.url ?? "/", "http://localhost").pathname}`);
  if (!file.startsWith(root + path.sep) || !file.endsWith(".json")) { response.writeHead(404).end(); return; }
  try { response.setHeader("Content-Type", "application/json; charset=utf-8"); response.end(await readFile(file)); }
  catch { response.writeHead(404).end(); }
});
server.listen(port, "127.0.0.1", () => console.log(`Registry http://localhost:${port}/r/0.2.1/registry.json`));
