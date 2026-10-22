import path from "node:path";
export default {plugins: {"@tailwindcss/postcss": {}, [path.resolve(process.cwd(), "../../scripts/postcss-chromium102.cjs")]: {}}};
