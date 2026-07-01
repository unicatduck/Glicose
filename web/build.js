// Regenerates index.html as a single self-contained file (inline CSS + JS),
// so opening it on Android via "open with Chrome" from a file manager works
// even when Chrome only gets access to that one file (no sibling style.css/app.js).
// Run: node web/build.js
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const template = fs.readFileSync(path.join(dir, "template.html"), "utf8");
const style = fs.readFileSync(path.join(dir, "style.css"), "utf8");
const script = fs.readFileSync(path.join(dir, "app.js"), "utf8");

const output = template
  .replace("/*STYLE_PLACEHOLDER*/", style)
  .replace("/*SCRIPT_PLACEHOLDER*/", script);

fs.writeFileSync(path.join(dir, "index.html"), output);
console.log("Wrote web/index.html (" + output.length + " bytes)");
