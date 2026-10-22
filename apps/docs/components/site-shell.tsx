"use client";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {ThemeProvider, useTheme} from "./theme";
import {useEffect, useState, type ReactNode} from "react";
import {ArrowUpRight, Menu, Search, Sun, Moon, Monitor, ArrowRight, Github} from "lucide-react";
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger} from "@xlt/registry/ui/components/dialog";
import {Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger} from "@xlt/registry/ui/components/sheet";
import {DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem} from "@xlt/registry/ui/components/dropdown-menu";
import {Button} from "@xlt/registry/ui/components/button";
import {cn} from "@xlt/registry/ui/lib/utils";
import {assetPath, groups, navigation, searchPages, version, type searchIndex} from "../lib/content";

function Brand() {
  return <Link href="/" className="brand" aria-label="小灵通 Agent UI 首页"><img src={assetPath("/brand/logo.png")} width="28" height="28" alt=""/><span>小灵通 <span className="brand-divider">/</span> <span className="brand-product">Agent UI</span></span></Link>;
}
function Navigation({onNavigate}: {onNavigate?: () => void}) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return <nav className="docs-navigation" aria-label="文档导航">{groups.map(group => <div className="nav-group" key={group}><p>{group}</p>{navigation.filter(page => page.group === group).map(page => <Link key={page.href} href={page.href} onClick={onNavigate} aria-current={pathname === page.href ? "page" : undefined}>{page.title}{pathname === page.href && <span className="nav-dot"/>}</Link>)}</div>)}</nav>;
}
function ThemeToggle() {
  const {theme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="选择主题"><Sun className="theme-sun"/><Moon className="theme-moon"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuRadioGroup value={mounted ? theme : "system"} onValueChange={setTheme}><DropdownMenuRadioItem value="light"><Sun/>浅色</DropdownMenuRadioItem><DropdownMenuRadioItem value="dark"><Moon/>深色</DropdownMenuRadioItem><DropdownMenuRadioItem value="system"><Monitor/>跟随系统</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}
function SiteSearch({index}: {index: typeof searchIndex}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const results = searchPages(query, index);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {event.preventDefault(); setOpen(value => !value);} };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {if (open) {setQuery(""); setActive(0);}}, [open]);
  useEffect(() => {document.getElementById(`search-result-${active}`)?.scrollIntoView({block: "nearest"});}, [active]);
  const select = (href: string) => {setOpen(false); router.push(href);};
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="search-trigger"><Search data-icon="inline-start"/><span>搜索文档…</span><kbd>Ctrl K</kbd></Button></DialogTrigger><DialogContent className="search-dialog"><DialogTitle className="sr-only">搜索文档</DialogTitle><DialogDescription className="sr-only">输入关键词，使用上下方向键选择，回车打开，Escape 关闭。</DialogDescription><div className="search-input-row"><Search size={18}/><input role="combobox" aria-label="搜索文档" aria-autocomplete="list" aria-expanded="true" aria-controls="search-results" aria-activedescendant={results[active] ? `search-result-${active}` : undefined} placeholder="搜索组件、接入指南、API…" value={query} onChange={event => {setQuery(event.target.value); setActive(0);}} onKeyDown={event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {event.preventDefault(); setActive(value => results.length ? (value + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : 0);}
    if (event.key === "Enter" && results[active]) {event.preventDefault(); select(results[active].href);}
  }}/></div><div id="search-results" role="listbox" aria-label="搜索结果" className="search-results">{results.length ? results.map((result, i) => <div role="option" aria-selected={active === i} id={`search-result-${i}`} key={result.href} onMouseMove={() => setActive(i)} onClick={() => select(result.href)} className={cn("search-result", active === i && "is-selected")}><span><small>{result.group}</small><strong>{result.title}</strong><span>{result.text.slice(0, 78)}</span></span><ArrowRight size={16}/></div>) : <p role="status" className="search-empty">没有找到“{query}”，试试“令牌”或“消息”。</p>}</div><div className="search-footer"><span>↑ ↓ 选择</span><span>↵ 打开</span><span>Esc 关闭</span></div></DialogContent></Dialog>;
}
function Shell({children, index}: {children: ReactNode; index: typeof searchIndex}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const docs = pathname.startsWith("/docs") || pathname.startsWith("/components");
  return <><a className="skip-link" href="#main-content">跳至内容</a><header className="site-header"><div className="header-inner"><Brand/><nav className="top-nav" aria-label="主导航">{[["/docs", "文档"], ["/components", "组件"], ["/examples", "交互演示"]].map(([href, title]) => <Link key={href} href={href!} aria-current={pathname.startsWith(href!) ? "page" : undefined}>{title}</Link>)}</nav><div className="header-tools"><SiteSearch index={index}/><Button asChild variant="ghost" size="icon"><a href="https://github.com/lingya-ai/xlt-agent-ui" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库（新窗口打开）" title="GitHub 仓库"><Github aria-hidden="true"/></a></Button><ThemeToggle/><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button className="mobile-trigger" variant="ghost" size="icon" aria-label="打开导航"><Menu/></Button></SheetTrigger><SheetContent side="left" className="mobile-navigation"><SheetTitle>小灵通 / Agent UI</SheetTitle><SheetDescription className="sr-only">文档和组件导航</SheetDescription><div className="mobile-top-links"><Link href="/" onClick={() => setMobileOpen(false)}>首页</Link><Link href="/components" onClick={() => setMobileOpen(false)}>组件目录</Link><Link href="/examples" onClick={() => setMobileOpen(false)}>交互演示</Link></div><Navigation onNavigate={() => setMobileOpen(false)}/></SheetContent></Sheet></div></div></header><div className={cn("site-frame", docs && "documentation-frame")}>{docs && <aside className="desktop-sidebar"><Navigation/><div className="sidebar-footer"><span className="status-dot"/>Registry v{version}<ArrowUpRight size={12}/></div></aside>}<main id="main-content" tabIndex={-1}>{children}</main></div><footer className="site-footer"><Brand/><span>源码属于你的项目，界面服务于你的产品。</span><span>React 19 · Tailwind 4</span></footer></>;
}
export function SiteShell({children, index}: {children: ReactNode; index: typeof searchIndex}) {
  return <ThemeProvider><Shell index={index}>{children}</Shell></ThemeProvider>;
}
