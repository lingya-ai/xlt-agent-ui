/** Tailwind 4 的 @property 初始值和混色提供 Chromium 102 降级；现代浏览器保留原声明。 */
module.exports = () => ({
  postcssPlugin: "xlt-chromium102",
  OnceExit(root, {postcss}) {
    const defaults = postcss.rule({selector: "*, ::before, ::after, ::backdrop"});
    root.walkAtRules("property", rule => {
      const initial = rule.nodes?.find(node => node.prop === "initial-value");
      if (initial) defaults.append({prop: rule.params, value: initial.value});
    });
    if (defaults.nodes.length) root.prepend(defaults);
    root.walkDecls(declaration => {
      if (!declaration.value.includes("color-mix(")) return;
      const value = declaration.value.replace(/color-mix\(in (?:oklab|srgb),\s*(var\(--[\w-]+\)|#[\da-f]+|[a-z]+)\s+[\d.]+%,\s*transparent\)/gi, "$1");
      if (!value.includes("color-mix(")) declaration.cloneBefore({value});
    });
  },
});
module.exports.postcss = true;
