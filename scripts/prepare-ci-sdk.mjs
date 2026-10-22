import { readFile, writeFile } from "node:fs/promises";

const response = await fetch("https://registry.npmjs.org/@lingya-ai%2Fagents-sdk/latest", {
  signal: AbortSignal.timeout(120_000),
});
if (!response.ok) throw new Error(`查询 npm SDK latest 失败：HTTP ${response.status}`);
const { version } = await response.json();
if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("npm 未返回有效的 SDK 版本");
}
for (const file of ["package.json", "packages/registry/package.json"]) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  manifest.dependencies["@lingya-ai/agents-sdk"] = version;
  if (file === "package.json") {
    manifest.pnpm ??= {};
    manifest.pnpm.overrides ??= {};
    manifest.pnpm.overrides["@lingya-ai/agents-sdk"] = version;
  }
  await writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
}
console.log(`SDK latest: @lingya-ai/agents-sdk@${version}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY,
    `## SDK latest\n\nTesting npm package: \`@lingya-ai/agents-sdk@${version}\`\n`,
    { flag: "a" });
}
