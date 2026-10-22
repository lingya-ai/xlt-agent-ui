"use client";
import {useEffect, useState} from "react";
import Link from "next/link";
import type {Heading} from "../lib/content";
export function TableOfContents({headings}: {headings: Heading[]}) {
  const [active, setActive] = useState(headings[0]?.id);
  useEffect(() => {
    setActive(headings[0]?.id);
    const update = () => {
      const passed = headings.filter(heading => (document.getElementById(heading.id)?.getBoundingClientRect().top ?? Infinity) < 150);
      setActive(passed.at(-1)?.id ?? headings[0]?.id);
    };
    window.addEventListener("scroll", update, {passive: true}); update();
    return () => window.removeEventListener("scroll", update);
  }, [headings]);
  return <aside className="page-toc"><nav aria-label="页内目录"><p>本页内容</p>{headings.map(heading => <a key={heading.id} href={`#${heading.id}`} aria-current={active === heading.id ? "location" : undefined}>{heading.title}</a>)}</nav><div className="toc-note"><span>构建属于你的 Agent</span><p>安装源码，自由组合。<br/>从一次对话开始。</p><Link href="/docs/quick-start">快速开始 →</Link></div></aside>;
}
