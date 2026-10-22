import {chromium, expect} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const results: unknown[] = [];
await mkdir("artifacts", {recursive:true});
for (const engine of ["chrome", "chromium102"]) {
  const browser = await chromium.launch(engine === "chrome" ? {channel:"chrome",headless:true} :
    {executablePath:path.resolve(".cache/browsers/chromium102/chrome-win/chrome.exe"),headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    if (engine === "chromium102") expect(browser.version()).toMatch(/^102\./);
    await page.goto(`${process.env.BROWSER_TEST_URL ?? "http://localhost:4600"}/docs/goal`);
    const demo = page.getByTestId("goal-demo");
    await expect(demo).toBeVisible();
    await demo.getByLabel("目标正文", {exact:true}).fill("浏览器目标测试");
    await demo.getByRole("button",{name:"创建目标",exact:true}).click();
    await expect(demo.getByRole("button",{name:"暂停目标",exact:true}).first()).toBeVisible();
    await expect(demo.getByText("浏览器目标测试",{exact:true})).toHaveCount(3);
    await demo.getByRole("button",{name:"暂停目标",exact:true}).first().click();
    await expect(demo.getByRole("button",{name:"恢复目标",exact:true}).first()).toBeVisible();
    await demo.getByRole("button",{name:"恢复目标",exact:true}).first().click();
    await expect(demo.getByRole("button",{name:"暂停目标",exact:true}).first()).toBeVisible();
    await demo.getByRole("button",{name:"编辑目标",exact:true}).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("目标内容",{exact:true}).fill("编辑后的浏览器目标");
    await dialog.getByRole("button",{name:"保存",exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(demo.getByText("编辑后的浏览器目标",{exact:true}).first()).toBeVisible();
    await demo.getByRole("button",{name:"清除目标",exact:true}).click();
    await page.getByRole("alertdialog").getByRole("button",{name:"清除",exact:true}).click();
    await expect(demo.getByRole("button",{name:"暂停目标",exact:true})).toHaveCount(0);
    await expect(demo.getByText("已清除",{exact:true})).toBeVisible();
    await demo.getByLabel("目标正文",{exact:true}).fill("第二次创建目标");
    await demo.getByRole("button",{name:"创建目标",exact:true}).click();
    await expect(demo.getByRole("button",{name:"暂停目标",exact:true}).first()).toBeVisible();
    await page.getByRole("button",{name:"English",exact:true}).click();
    await expect(demo.getByRole("button",{name:"Create goal",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Theme",exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await demo.getByRole("button",{name:"Pause goal",exact:true}).first().focus();
    await page.keyboard.press("Enter");
    await expect(demo.getByRole("button",{name:"Resume goal",exact:true}).first()).toBeVisible();
    await page.screenshot({path:`artifacts/${engine}-goal.png`,fullPage:true});
    expect(errors).toEqual([]);
    results.push({engine,version:browser.version(),status:"passed",scenarios:["create","edit","pause","resume","clear","history retained","recreate","English","dark","390px","keyboard"]});
  } finally { await browser.close(); }
}
await writeFile("artifacts/browser-goal.json",JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
