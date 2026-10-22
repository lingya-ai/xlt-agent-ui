import Link from "next/link";
import {Article} from "../../components/article";
import {introduction} from "../../lib/content";
export const metadata = {title: "介绍"};
export default function Page() {return <Article page={introduction}>{introduction.chapters.map(chapter => <section className="doc-section" key={chapter.id}><h2 id={chapter.id}>{chapter.title}</h2>{chapter.blocks.map((block, i) => <p key={i}>{block.value}</p>)}{chapter.id === "start" && <div className="start-links"><Link href="/docs/quick-start">01 · 快速开始 →</Link><Link href="/components">02 · 浏览核心组件 →</Link><Link href="/examples">03 · 体验交互演示 →</Link></div>}</section>)}</Article>;}
