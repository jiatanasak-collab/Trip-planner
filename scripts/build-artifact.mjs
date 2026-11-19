// build แอปเป็นหน้า artifact ของ claude.ai: ไฟล์ HTML เดียว (JS/CSS ฝังในหน้า) + ข้อมูลแผนที่โลกเป็นไฟล์แยก
// ใช้: npm run build:artifact → ได้ไฟล์ใน artifact/
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const tmp = ".artifact-build";
execSync("npx vite build", {
  stdio: "inherit",
  env: { ...process.env, VITE_BASE: "./", VITE_OUT_DIR: tmp, VITE_GEO_URL: "./countries-50m.json" },
});

const html = readFileSync(join(tmp, "index.html"), "utf8");
const assets = readdirSync(join(tmp, "assets"));
const jsFiles = assets.filter((f) => f.endsWith(".js"));
const cssFiles = assets.filter((f) => f.endsWith(".css"));
if (jsFiles.length !== 1) throw new Error("คาดว่าจะมีไฟล์ JS ไฟล์เดียว แต่พบ: " + jsFiles.join(", "));

const js = readFileSync(join(tmp, "assets", jsFiles[0]), "utf8").replace(/<\/script/gi, "<\\/script");
const css = cssFiles.map((f) => readFileSync(join(tmp, "assets", f), "utf8")).join("\n");
const fonts = [...html.matchAll(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/g)].map((m) => m[0]).join("\n");

// หน้า artifact ไม่ต้องมี <html>/<head>/<body> เอง (ระบบห่อให้ตอน publish)
const page = `<title>สมุดแผนเที่ยว</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0d0e11">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

mkdirSync("artifact", { recursive: true });
writeFileSync("artifact/index.html", page);
copyFileSync("node_modules/world-atlas/countries-50m.json", "artifact/countries-50m.json");
console.log(`artifact/index.html ${(page.length / 1024).toFixed(0)} KB + countries-50m.json`);
