"use client";
import {useEffect, useSyncExternalStore, type ReactNode} from "react";
type Theme = "light" | "dark" | "system";
const eventName = "docs-theme-change";
function preference(): Theme {
  try {const value = localStorage.getItem("theme"); return value === "light" || value === "dark" ? value : "system";} catch {return "system";}
}
function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {attributes:true, attributeFilter:["class"]});
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {observer.disconnect(); window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback);};
}
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, preference, () => "system" as Theme);
  const resolvedTheme = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark") ? "dark" : "light", () => "light");
  return {theme, resolvedTheme, setTheme(value: string) {
    const next: Theme = value === "light" || value === "dark" ? value : "system";
    try {localStorage.setItem("theme", next);} catch { /* 受限存储中仍支持本次页面切换。 */ }
    applyTheme(next); window.dispatchEvent(new Event(eventName));
  }};
}
export function ThemeProvider({children}: {children: ReactNode}) {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme(preference());
    update(); media.addListener(update); window.addEventListener("storage", update);
    return () => {media.removeListener(update); window.removeEventListener("storage", update);};
  }, []);
  return children;
}

