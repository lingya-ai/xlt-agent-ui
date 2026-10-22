import type {Metadata} from "next";
import type {ReactNode} from "react";
import {SiteShell} from "../components/site-shell";
import {assetPath, searchIndex} from "../lib/content";
import {themeScript} from "../lib/theme-script";
import "./globals.css";
export const metadata: Metadata = {title: {default: "小灵通 / Agent UI · 可组合的 Agent 界面", template: "%s · XLT Agent UI"}, icons: {icon: assetPath("/brand/logo-32x32.ico")}, description: "通过 shadcn Registry 安装可修改的 React Agent 组件源码。"};
export default function Layout({children}: {children: ReactNode}) {
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: themeScript}}/></head><body><SiteShell index={searchIndex}>{children}</SiteShell></body></html>;
}

