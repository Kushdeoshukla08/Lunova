/**
 * Runs before first paint to apply the saved theme and avoid a flash.
 * Stored value is one of: "light" | "dark" | "system" (default).
 */
const script = `(function(){try{var t=localStorage.getItem("lunova-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
