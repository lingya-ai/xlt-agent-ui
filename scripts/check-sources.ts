import {readFile, writeFile, mkdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import path from "node:path";

// 只读核对迁移来源，不修改、清理或回退兄弟仓库。
const source = JSON.parse(await readFile("provenance/source.json", "utf8")) as {
  frontendWorkingTree: string;
  backendWorkingTree: string;
  files: {source: string; sha256: string}[];
};
const sibling = path.resolve("..");
const frontend = path.join(sibling, "xiaolingtong-fe");
const backend = path.join(sibling, "xiaolingtong-be");
const authentication = JSON.parse(await readFile("provenance/backend-auth.json", "utf8")) as {files: {source: string; sha256: string}[]};
const changedAuthentication: string[] = [];
for (const file of authentication.files) {
  const content = await readFile(path.join(backend, file.source));
  if (createHash("sha256").update(content).digest("hex") !== file.sha256) changedAuthentication.push(file.source);
}
const status = (cwd: string) => execFileSync("git", ["status", "--porcelain"], {cwd, encoding: "utf8"}).replaceAll("\r\n", "\n");
const changed: string[] = [];
const backendFiles = execFileSync("rg", ["--files", "packages/agent-runtime", "apps/agents-server"], {cwd: backend, encoding: "utf8"}).trim().split(/\r?\n/);
const changedContracts: string[] = [];
for (const name of ["OpenApiChannelChatController.kt", "AbstractAgentsController.kt", "AbstractAgentsStreamController.kt", "AbstractAgentsConversationReadController.kt"]) {
  const file = backendFiles.find(file => path.basename(file) === name);
  if (!file) throw new Error(`契约来源丢失 ${name}`);
  const current = (await readFile(path.join(backend, file), "utf8")).replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const captured = (await readFile(path.join("provenance/backend", name), "utf8")).replaceAll("\r\n", "\n");
  if (current !== captured) changedContracts.push(file);
}
for (const file of source.files) {
  const content = await readFile(path.join(frontend, file.source));
  if (createHash("sha256").update(content).digest("hex") !== file.sha256) changed.push(file.source);
}
const report = {
  checkedAt: new Date().toISOString(),
  frontendStatusUnchanged: status(frontend) === source.frontendWorkingTree.replaceAll("\r\n", "\n"),
  backendStatusUnchanged: status(backend) === source.backendWorkingTree.replaceAll("\r\n", "\n"),
  checkedSourceFiles: source.files.length,
  changedSourceFiles: changed,
  changedBackendContracts: changedContracts,
  changedBackendAuthentication: changedAuthentication,
};
await mkdir("artifacts", {recursive: true});
await writeFile("artifacts/sources.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!report.frontendStatusUnchanged || !report.backendStatusUnchanged || changed.length || changedContracts.length || changedAuthentication.length) process.exitCode = 2;
