// Renders tools/uno-rules.html to docs/uno/rules.png, the picture the UNO
// tab's Rules button shows. Run it again after changing the rules sheet.
// Needs Playwright, which isn't a dependency of this repo: install it
// globally (or with npm i --no-save playwright) and set NODE_PATH if global.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");

const source = pathToFileURL(join(import.meta.dirname, "uno-rules.html")).href;
const target = join(import.meta.dirname, "..", "docs", "uno", "rules.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 800 }, deviceScaleFactor: 2 });
await page.goto(source);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: target, fullPage: true });
await browser.close();
console.log("wrote", target);
