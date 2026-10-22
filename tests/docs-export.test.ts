import {afterEach, expect, it} from "vitest";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
// @ts-expect-error 独立 Node 构建脚本，不引入额外运行时类型声明。
import {finalizeDocsExport} from "../scripts/finalize-docs-export.mjs";
let fixture: string | undefined;
afterEach(async () => {
  if (!fixture) return;
  if (path.dirname(path.resolve(fixture)) !== path.resolve(tmpdir()) || !path.basename(fixture).startsWith("xlt-docs-export-")) throw new Error("临时目录越界");
  await rm(fixture, {recursive:true,force:true});
});
it("Windows 分段目录补齐浏览器请求别名，并保留原始文件和重复执行幂等性", async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "xlt-docs-export-"));
  const nested = path.join(fixture, "docs", "quick-start", "__next.docs", "$d$slug");
  await mkdir(nested,{recursive:true});
  const source = path.join(nested,"__PAGE__.txt");
  await writeFile(source, "RSC payload");
  await writeFile(path.join(fixture,"index.txt"),"root payload");
  expect(await finalizeDocsExport(fixture)).toBe(1);
  const target = path.join(fixture,"docs","quick-start","__next.docs.$d$slug.__PAGE__.txt");
  expect(await readFile(target,"utf8")).toBe("RSC payload");
  expect(await readFile(source,"utf8")).toBe("RSC payload");
  expect(await finalizeDocsExport(fixture)).toBe(0);
  expect(await readFile(path.join(fixture,"index.txt"),"utf8")).toBe("root payload");
});
