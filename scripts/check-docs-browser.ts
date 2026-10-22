import {chromium, expect} from "@playwright/test";
import {mkdir, writeFile} from "node:fs/promises";
const origin = process.env.DOCS_TEST_URL ?? "http://localhost:4600";
const basePath = process.env.DOCS_TEST_BASE_PATH ?? "";
const url = (path: string) => `${origin}${basePath}${path}`;
const folder = basePath ? "artifacts/docs-prefixed" : "artifacts/docs-redesign";
await mkdir(folder, {recursive:true});
const browser = await chromium.launch({channel:"chrome",headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}, permissions:["clipboard-read", "clipboard-write"]});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {if (message.type() === "error") errors.push(message.text());});
const scenarios: string[] = [];
try {
  await page.goto(url("/"));
  await expect(page.locator("textarea")).toBeVisible();
  await expect(page.getByText("配置真实渠道",{exact:true})).toHaveCount(0);
  await expect(page.locator('input[name="baseUrl"], input[name="tokenUrl"]')).toHaveCount(0);
  await page.locator("textarea").fill("文档改版验证");
  await page.locator("textarea").press("Enter");
  await expect(page.getByText("你发送了：文档改版验证",{exact:false})).toBeVisible();
  scenarios.push("首页聊天与 SSE");
  await page.getByRole("button",{name:"选择主题",exact:true}).click();
  await page.getByRole("menuitemradio",{name:"深色",exact:true}).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".agent-demo")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".agent-demo")).toHaveClass(/dark/);
  scenarios.push("主题持久化与演示继承");
  await page.getByRole("button",{name:"选择主题",exact:true}).click();
  await page.getByRole("menuitemradio",{name:"跟随系统",exact:true}).click();
  await page.emulateMedia({colorScheme:"light"});
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.emulateMedia({colorScheme:"dark"});
  await expect(page.locator("html")).toHaveClass(/dark/);
  scenarios.push("跟随系统主题动态切换");
  await page.getByRole("button",{name:"搜索文档",exact:false}).click();
  const search = page.getByRole("combobox",{name:"搜索文档"});
  await search.fill("单次使用令牌");
  await expect(page.getByRole("option").first()).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/docs\/authentication/);
  await page.keyboard.press("Control+k");
  await search.fill("zzzz-no-such-doc");
  await expect(page.getByRole("status")).toContainText("没有找到");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"搜索文档",exact:false})).toBeFocused();
  scenarios.push("搜索正文、键盘选择、空结果和焦点恢复");
  await page.goto(url("/components/chat"));
  await expect(page.locator("textarea")).toBeVisible();
  await page.getByRole("tab",{name:"代码",exact:true}).click();
  await expect(page.getByRole("tabpanel")).toContainText("export function ChatExample");
  await page.getByRole("tabpanel").getByRole("button",{name:"复制代码"}).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("ChatExample");
  await page.getByRole("tab",{name:"预览",exact:true}).click();
  await expect(page.locator("textarea")).toBeVisible();
  await page.getByRole("navigation",{name:"页内目录"}).getByRole("link",{name:"主要参数",exact:true}).click();
  await expect(page.locator("#section-4")).toBeInViewport();
  scenarios.push("预览切换、代码复制和章节定位");
  for (const slug of ["goal", "messages", "composer", "conversations", "workspace"]) {
    await page.goto(url(`/components/${slug}`));
    await expect(page.locator("h1")).toBeVisible();
    if (slug === "goal") await expect(page.getByLabel("目标正文", {exact:false})).toBeVisible();
    else if (slug === "messages") await expect(page.getByText("如何把 Agent 界面嵌入自己的产品？",{exact:false}).first()).toBeVisible();
    else await expect(page.locator("textarea")).toBeVisible();
  }
  scenarios.push("六个核心组件页面与真实组件预览");
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"打开导航",exact:true}).click();
  const drawer=page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link",{name:"快速开始",exact:true}).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/docs\/quick-start/);
  await page.getByRole("button",{name:"打开导航",exact:true}).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"打开导航",exact:true})).toBeFocused();
  scenarios.push("移动导航、路由切换和焦点恢复");
  for (const theme of ["light","dark"]) {
    await page.evaluate(theme => {localStorage.setItem("theme",theme);}, theme);
    for (const [width,height,label] of [[1440,1000,"desktop"],[900,1000,"tablet"],[390,844,"mobile"]] as const) {
      await page.setViewportSize({width,height});
      for (const [path,name] of [["/","home"],["/docs/quick-start","guide"],["/components/chat","component"],["/examples","examples"]]) {
        await page.goto(url(path!));
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        await expect(page.locator("h1")).toBeVisible();
        if (name !== "guide") await expect(page.locator("textarea")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),`${path} ${width} overflow`).toBe(true);
        expect(await page.locator(".brand img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        await page.screenshot({path:`${folder}/${name}-${label}-${theme}.png`,fullPage:true});
      }
    }
  }
  scenarios.push("24 张明暗主题与桌面/平板/手机截图、溢出检查、品牌资源加载");
  expect(errors).toEqual([]);
} finally {
  await writeFile(`${folder}/report.json`,JSON.stringify({origin,basePath,scenarios,errors},null,2));
  await browser.close();
}
console.log(JSON.stringify({scenarios,errors},null,2));

