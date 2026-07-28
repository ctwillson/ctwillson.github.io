import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const indexPath = join(root, "index.html");
const noJekyllPath = join(root, ".nojekyll");
const aboutPath = join(root, "about", "index.html");
const careersPath = join(root, "careers", "index.html");
const qaRolePath = join(root, "careers", "实习生招聘", "软件测试实习生");
const rnRolePath = join(root, "careers", "实习生招聘", "react native 开发实习生");
const cssPath = join(root, "styles.css");
const logoRelPath =
  "hooltech_full_company_name_vi/06_png_transparent/hooltech_fullname_horizontal_blue_outlined_4000px.png";
const faviconRelPath =
  "hooltech_full_company_name_vi/02_svg_outlined_production/hool_logo_only_blue_solid_outlined.svg";
const logoPath = join(root, logoRelPath);
const faviconPath = join(root, faviconRelPath);

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(existsSync(indexPath), "Missing index.html");
assert(existsSync(noJekyllPath), "Missing .nojekyll static site marker");
assert(existsSync(aboutPath), "Missing about/index.html");
assert(existsSync(careersPath), "Missing careers/index.html");
assert(existsSync(qaRolePath), "Missing software testing internship source");
assert(existsSync(rnRolePath), "Missing React Native internship source");
assert(existsSync(cssPath), "Missing styles.css");
assert(existsSync(logoPath), `Missing logo asset: ${logoRelPath}`);
assert(existsSync(faviconPath), `Missing favicon asset: ${faviconRelPath}`);

const html = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
const aboutHtml = existsSync(aboutPath) ? readFileSync(aboutPath, "utf8") : "";
const careersHtml = existsSync(careersPath) ? readFileSync(careersPath, "utf8") : "";
const qaRoleText = existsSync(qaRolePath) ? readFileSync(qaRolePath, "utf8") : "";
const rnRoleText = existsSync(rnRolePath) ? readFileSync(rnRolePath, "utf8") : "";
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";

assert(html.includes("<!doctype html>"), "index.html should use a doctype");
assert(html.includes('lang="zh-CN"'), "index.html should set lang=\"zh-CN\"");
assert(html.includes("<body>"), "Body should not carry the top anchor");
assert(
  html.includes('<span id="top" class="top-anchor" aria-hidden="true"></span>'),
  "Missing stable top page anchor"
);
assert(html.includes("<title>Hooltech | Coming Soon</title>"), "Missing expected title");
assert(
  html.includes('name="description"') &&
    html.includes("硅基生物还是碳基生物？"),
  "Missing useful description metadata"
);
assert(html.includes('name="viewport"'), "Missing viewport metadata");
assert(html.includes('href="styles.css"'), "Missing styles.css link");
assert(html.includes(`src="${logoRelPath}"`), "Missing primary logo image reference");
assert(html.includes(`href="${faviconRelPath}"`), "Missing favicon reference");
assert(html.includes("硅基生物还是碳基生物？"), "Missing Chinese mission statement");
assert(html.includes("coming soon"), "Missing coming soon status text");
assert(html.includes('<header class="site-header">'), "Missing top site header");
assert(html.includes('class="site-logo"'), "Missing header logo");
assert(html.includes('href="#top"'), "Header logo should link to the page top");
assert(!html.includes('href="/"'), "Header logo should not link to filesystem or site root");
assert(html.includes('href="about/"'), "Missing about navigation link");
assert(html.includes('href="careers/"'), "Missing careers navigation link");
assert(html.includes("关于我们"), "Missing about navigation text");
assert(html.includes("岗位招聘"), "Missing careers navigation text");
assert(html.includes('id="about"'), "Missing about section anchor");
assert(
  html.includes("Hooltech 关注硅基智能与碳基生命之间的新边界。"),
  "Missing about section copy"
);
assert(html.includes("anson@hooltech.com"), "Missing careers contact email on home page");
assert(
  html.includes('href="mailto:anson@hooltech.com"'),
  "Home page contact email should be a mailto link"
);
assert(!html.includes("comming"), "Found misspelled comming in HTML");
assert(!aboutHtml.includes("菜鸡"), "About page should not use the legacy blog copy");
assert(aboutHtml.includes("<title>关于我们 | Hooltech</title>"), "Missing about page title");
assert(
  aboutHtml.includes("Hooltech 关注硅基智能与碳基生命之间的新边界。"),
  "Missing about page company copy"
);
assert(
  careersHtml.includes("<title>岗位招聘 | Hooltech</title>"),
  "Missing careers page title"
);
assert(
  careersHtml.includes("技术开发实习生（React Native / 全栈方向）"),
  "Missing React Native internship role"
);
assert(careersHtml.includes("软件测试实习生"), "Missing software testing internship role");
assert(careersHtml.includes("投递方式"), "Missing application instructions");
assert(careersHtml.includes("anson@hooltech.com"), "Missing careers contact email");
assert(
  careersHtml.includes('href="mailto:anson@hooltech.com"'),
  "Careers contact email should be a mailto link"
);
assert(qaRoleText.includes("anson@hooltech.com"), "Missing contact email in QA role source");
assert(rnRoleText.includes("anson@hooltech.com"), "Missing contact email in RN role source");
assert(
  careersHtml.includes("招聘信息即将开放") === false,
  "Careers page should not use placeholder hiring copy"
);
assert(careersHtml.includes("job-summary-grid"), "Missing job summary grid");
assert(careersHtml.includes("job-detail"), "Missing job detail sections");
assert(!css.includes("comming"), "Found misspelled comming in CSS");
assert(
  !css.includes("linear-gradient(90deg, transparent 0 49."),
  "CSS should not render a vertical center divider line"
);
assert(css.includes("100svh"), "CSS should use 100svh for stable mobile viewport height");
assert(css.includes("clamp("), "CSS should use clamp() for responsive sizing");
assert(css.includes("overflow-wrap"), "CSS should guard against text overflow");
assert(css.includes("@media"), "CSS should include a mobile media query");
assert(css.includes(".site-header"), "CSS should style the top site header");
assert(css.includes(".about-section"), "CSS should style the about section");
assert(css.includes(".careers-section"), "CSS should style the careers section");
assert(css.includes(".content-shell"), "CSS should style subpages");
assert(css.includes(".job-card"), "CSS should style job cards");
assert(css.includes(".job-section"), "CSS should style job details");
assert(css.includes(".application-panel"), "CSS should style application instructions");
assert(css.includes(".application-email"), "CSS should style application email");
assert(css.includes(".role-list"), "CSS should style role lists");
assert(css.includes(".top-anchor"), "CSS should style the top anchor");
assert(
  !css.includes("scroll-behavior: smooth"),
  "Hash navigation should be instant for the logo top link"
);
assert(
  css.includes("width: clamp(150px, 15vw, 220px);"),
  "Desktop header logo should be enlarged"
);
assert(
  css.includes("width: clamp(132px, 38vw, 160px);"),
  "Mobile header logo should be enlarged"
);

if (existsSync(logoPath)) {
  assert(statSync(logoPath).size > 1000, "Logo asset should not be empty");
}

if (failures.length > 0) {
  console.error("Static site verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Static site verification passed.");
