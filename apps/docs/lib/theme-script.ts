// 在页面内容绘制前应用偏好；值仅来自固定主题集合。
export const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){document.documentElement.classList.add('light')}})()`;

