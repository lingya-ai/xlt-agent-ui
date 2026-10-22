import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
if (typeof ResizeObserver === "undefined") vi.stubGlobal("ResizeObserver", class {
  observe() {} unobserve() {} disconnect() {}
});
if (!window.matchMedia) Object.defineProperty(window, "matchMedia", { value: (query: string) => ({
  matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
}) });
