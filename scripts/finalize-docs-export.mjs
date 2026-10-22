import {readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

/** Next 16.1.6 的 Windows 导出只替换 /，导致 RSC 分段文件保留反斜杠目录。
 * 浏览器使用扁平文件名请求分段；补齐同内容别名，普通静态服务器无需重写规则。
 * Linux 已输出正确文件名时此操作为空。只处理生成的 out，不修改 Registry。
 */
export async function finalizeDocsExport(root) {
  let count = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const source = path.join(directory, entry.name);
      if (entry.isDirectory()) {await visit(source); continue;}
      if (!entry.name.endsWith(".txt")) continue;
      const parts = path.relative(root, source).split(path.sep);
      const index = parts.findIndex(part => part.startsWith("__next."));
      if (index < 0 || index === parts.length - 1) continue;
      const target = path.join(root, ...parts.slice(0, index), parts.slice(index).join("."));
      const content = await readFile(source);
      try {await writeFile(target, content, {flag: "wx"}); count++;}
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!(await readFile(target)).equals(content)) throw new Error(`RSC 导出别名冲突：${target}`);
      }
    }
  }
  await visit(root);
  return count;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.env.GITHUB_PAGES === "true") {
  const root = fileURLToPath(new URL("../apps/docs/out/", import.meta.url));
  console.log(`静态导出：补齐 ${await finalizeDocsExport(root)} 个 RSC 分段文件别名`);
}
