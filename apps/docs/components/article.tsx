import Link from "next/link";
import type {ReactNode} from "react";
import {ArrowLeft, ArrowRight, ChevronRight} from "lucide-react";
import {navigation, type PageEntry} from "../lib/content";
import {CodeBlock} from "./highlight";
import {TableOfContents} from "./table-of-contents";
export function Article({page, children}: {page: PageEntry; children?: ReactNode}) {
  const index = navigation.findIndex(item => item.href === page.href);
  const previous = navigation[index - 1];
  const next = navigation[index + 1];
  return <div className="article-layout"><article className="doc-article"><div className="breadcrumb"><Link href="/docs">文档</Link><ChevronRight size={12}/><span>{page.group}</span></div><header className="article-header"><h1>{page.title}</h1><p>{page.description}</p></header>{children ?? page.chapters.map(chapter => <section key={chapter.id} className="doc-section" aria-labelledby={chapter.id}><h2 id={chapter.id}><a href={`#${chapter.id}`}>{chapter.title}<span className="heading-anchor">#</span></a></h2>{chapter.blocks.map((block, i) => block.kind === "code" ? <CodeBlock key={i} code={block.value} language={block.language}/> : <p key={i}>{block.value}</p>)}</section>)}<nav className="page-pagination" aria-label="前后篇">{previous ? <Link href={previous.href}><small><ArrowLeft size={13}/>上一篇</small><strong>{previous.title}</strong></Link> : <span/>}{next && <Link href={next.href}><small>下一篇<ArrowRight size={13}/></small><strong>{next.title}</strong></Link>}</nav></article><TableOfContents headings={page.chapters}/></div>;
}
