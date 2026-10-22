import {chromium,expect} from "@playwright/test";
import {mkdir,writeFile,access} from "node:fs/promises";
import path from "node:path";
const url=process.env.BROWSER_TEST_URL ?? "http://localhost:4600";
const chromium102=process.env.CHROMIUM102_PATH ?? path.resolve(".cache/browsers/chromium102/chrome-win/chrome.exe");
await mkdir("artifacts",{recursive:true});
const results:unknown[]=[];
for(const engine of ["chrome","chromium102"]){
  if(engine==="chromium102")await access(chromium102);
  const browser=await chromium.launch(engine==="chrome"?{channel:"chrome",headless:true}:{executablePath:chromium102,headless:true});
  if(engine==="chromium102"&&!browser.version().startsWith("102."))throw new Error("必须使用真实 Chromium 102");
  const errors:string[]=[];
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
  try{
    await page.goto(url);
    await expect(page.locator("textarea")).toBeVisible();
    await page.locator("textarea").fill("请介绍组件");
    await page.locator("textarea").press("Enter");
    await expect(page.getByText("你发送了：请介绍组件",{exact:false})).toBeVisible({timeout:15000});
    await expect(page.getByText("SDK 负责解析 SSE 事件",{exact:false}).first()).toBeVisible();
    await page.screenshot({path:`artifacts/${engine}-chat.png`,fullPage:true});
    for (let index = 0; index < 12; index++) {
      const query = `长会话验证 ${index}`;
      await page.locator("textarea").fill(query);
      await page.locator("textarea").press("Enter");
      await expect(page.getByText(`你发送了：${query}`, {exact:false})).toBeVisible({timeout:15000});
      await expect(page.getByRole("button", {name:"停止生成",exact:true})).toHaveCount(0);
    }
    await page.getByRole("button",{name:"English",exact:true}).click();
    await expect(page.getByRole("button",{name:"中文",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Theme",exact:true}).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const demoBackground = await page.locator(".agent-demo").evaluate(element=>getComputedStyle(element).backgroundColor);
    expect(demoBackground).not.toBe("rgba(0, 0, 0, 0)");
    await page.locator("select").first().selectOption("history");
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(page.getByText("长会话验证 11",{exact:true})).toBeVisible();
    await page.screenshot({path:`artifacts/${engine}-history-dark-en.png`,fullPage:true});
    await page.getByRole("button",{name:"中文",exact:true}).click();
    await page.locator("select").first().selectOption("workbench");
    await expect(page.getByText("源码分发接入示例",{exact:true}).first()).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
    await page.getByRole("button",{name:"工作区",exact:true}).click();
    await page.getByText("工作区制品",{exact:true}).click();
    await page.getByText("guide.md",{exact:true}).first().click();
    await expect(page.getByRole("heading",{name:"OpenAPI Agent UI",exact:true})).toBeVisible();
    expect(await page.getByRole("heading", {name:"OpenAPI Agent UI",exact:true}).evaluate(element => {
      const preview = element.closest('[data-slot="scroll-area"]');
      return preview ? getComputedStyle(preview).backgroundColor : null;
    })).toBe(demoBackground);
    await page.screenshot({path:`artifacts/${engine}-workbench.png`,fullPage:true});
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.setViewportSize({width:390,height:844});
    await page.locator("select").first().selectOption("chat");
    await expect(page.locator("textarea")).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    const text=Array.from({length:30},(_,i)=>`长输入第 ${i+1} 行`).join("\n");
    await page.locator("textarea").fill(text);
    const height=await page.locator("textarea").evaluate(element=>element.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(30);
    expect(height).toBeLessThan(400);
    await page.locator("textarea").focus();
    await page.keyboard.press("Tab");
    const focused=await page.evaluate(()=>{const active=document.activeElement;if(!(active instanceof HTMLElement))return null;const style=getComputedStyle(active);return {outline:style.outlineStyle,shadow:style.boxShadow,tag:active.tagName};});
    expect(focused?.tag).not.toBe("BODY");
    await page.screenshot({path:`artifacts/${engine}-narrow.png`,fullPage:true});
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    results.push({engine,version:browser.version(),url,status:"passed",scenarios:["SSR hydration","SSE send","history readonly","workbench","dark theme","English/Chinese","narrow viewport","textarea auto resize","keyboard focus","long conversation","workspace file preview"],focused});
  }finally{await browser.close();await writeFile("artifacts/browser.json",JSON.stringify({results,errors},null,2));}
}
console.log(JSON.stringify(results,null,2));
