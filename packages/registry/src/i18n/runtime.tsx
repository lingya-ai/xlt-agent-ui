"use client";

import { createContext, createElement, Fragment, useContext, useMemo, type ReactElement, type ReactNode } from "react";
import { messages } from "./messages";

export enum AgentLocale { Zh = "zh", En = "en" }
export type MessageKey = keyof typeof messages;
type LocalizedText = ReactElement & { readonly value: string };
type Resolved<T> = T extends { readonly insert: true }
  ? (values: Record<string, string | number>) => LocalizedText
  : T extends { readonly locales: object } ? LocalizedText
  : { [K in keyof T]: Resolved<T[K]> };
type Overrides<T> = T extends { readonly locales: object } ? string : { [K in keyof T]?: Overrides<T[K]> };
export type AgentMessageOverrides = { [K in MessageKey]?: Overrides<(typeof messages)[K]> };
const Context = createContext<{ locale: AgentLocale; messages?: AgentMessageOverrides }>({ locale: AgentLocale.Zh });

/** 双语文案不依赖路由或第三方国际化框架；覆盖内容使用当前语言。 */
export function AgentMessagesProvider({ locale = AgentLocale.Zh, messages: overrides, children }: {
  locale?: AgentLocale; messages?: AgentMessageOverrides; children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages: overrides }), [locale, overrides]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function text(value: string): LocalizedText { return { ...createElement(Fragment, null, value), value }; }
function resolve(node: unknown, locale: AgentLocale, override?: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  if ("locales" in node && node.locales && typeof node.locales === "object") {
    const locales = node.locales as Record<string, unknown>;
    const value = typeof override === "string" ? override : String(locales[locale] ?? locales.zh ?? locales.en ?? "");
    if ("insert" in node && node.insert) {
      return (values: Record<string, string | number>) => text(value.replace(/\{\{\s*(\w+)\s*\}\}/g,
        (match, key: string) => values[key] === undefined ? match : String(values[key])));
    }
    return text(value);
  }
  if (Array.isArray(node)) return node.map((item, index) => resolve(item, locale, Array.isArray(override) ? override[index] : undefined));
  const replacement = override && typeof override === "object" ? override as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolve(value, locale, replacement[key])]));
}

/** 使用字面量字典键获得带类型的文案。 */
export function useAgentMessages<K extends MessageKey>(key: K): Resolved<(typeof messages)[K]> {
  const context = useContext(Context);
  return useMemo(() => resolve(messages[key], context.locale, context.messages?.[key]) as Resolved<(typeof messages)[K]>,
    [key, context.locale, context.messages]);
}
export function useAgentLocale() { return { locale: useContext(Context).locale }; }
