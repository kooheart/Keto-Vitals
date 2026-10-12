/**
 * Generates original, licence-free SVG artwork for the demo catalogue:
 * public/logo.svg, public/products/*, public/categories/*, public/collections/*, public/banners/*.
 * Replace any of these with real photography (see README → "Replacing placeholder images").
 *   npm run assets:generate
 */
import fs from "node:fs";
import path from "node:path";
import { categories, collections, products } from "../prisma/catalog-data";

const pub = path.join(process.cwd(), "public");
for (const d of ["products", "categories", "collections", "banners"]) fs.mkdirSync(path.join(pub, d), { recursive: true });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : 255 - v))));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join("");
}
function wrap(text: string, max: number, lines = 3) {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out.slice(0, lines);
}
const leaf = (x: number, y: number, s: number, r: number, fill: string) =>
  `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0C30-40 80-40 100 0C80 40 30 40 0 0Z" fill="${fill}"/><path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M0 0L90 0" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`;

function pack(shape: string, hue: string, label: string, cx: number, base: number, scale = 1) {
  const dark = shade(hue, -0.35), light = shade(hue, 0.35);
  const lines = wrap(label, 14, 3);
  const text = (x: number, y: number, w: number) =>
    lines.map((l, i) => `<text x="${x + w / 2}" y="${y + i * 24}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="20" fill="#fff">${esc(l)}</text>`).join("");
  let body = "";
  switch (shape) {
    case "bottle":
      body = `<rect x="-55" y="-300" width="110" height="300" rx="26" fill="${hue}"/><rect x="-30" y="-350" width="60" height="55" rx="8" fill="${dark}"/><rect x="-36" y="-368" width="72" height="26" rx="6" fill="${shade(dark, -0.2)}"/><rect x="-46" y="-215" width="92" height="150" rx="10" fill="#fff" fill-opacity=".92"/><text x="0" y="-175" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="14" fill="${dark}">KETO VITALS</text>${lines.map((l, i) => `<text x="0" y="${-148 + i * 18}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#333">${esc(l)}</text>`).join("")}<rect x="-40" y="-290" width="14" height="210" rx="7" fill="#fff" fill-opacity=".16"/>`;
      break;
    case "pouch":
      body = `<path d="M-95 -300 L95 -300 L105 0 L-105 0 Z" fill="${hue}"/><rect x="-95" y="-312" width="190" height="22" rx="4" fill="${dark}"/><path d="M-95 -290 L95 -290" stroke="#fff" stroke-opacity=".3" stroke-dasharray="6 6"/><rect x="-78" y="-235" width="156" height="150" rx="14" fill="#fff" fill-opacity=".93"/><text x="0" y="-198" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="${dark}">KETO VITALS</text>${lines.map((l, i) => `<text x="0" y="${-170 + i * 22}" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#222">${esc(l)}</text>`).join("")}<path d="M-95 -300 L-104 0 L-80 0 L-80 -300Z" fill="#fff" fill-opacity=".12"/>`;
      break;
    case "box":
      body = `<rect x="-110" y="-290" width="220" height="290" rx="6" fill="${hue}"/><rect x="-110" y="-290" width="220" height="64" fill="${dark}"/><text x="0" y="-250" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="20" fill="#fff" letter-spacing="2">KETO VITALS</text>${leaf(-30, -150, 0.9, -30, light)}${leaf(20, -140, 0.7, 30, shade(hue, 0.55))}${text(-110, -80, 220)}`;
      break;
    case "tin":
      body = `<rect x="-85" y="-250" width="170" height="250" rx="12" fill="${hue}"/><rect x="-92" y="-278" width="184" height="36" rx="10" fill="${dark}"/><ellipse cx="0" cy="-278" rx="92" ry="9" fill="${shade(dark, 0.25)}"/><rect x="-85" y="-205" width="170" height="3" fill="#fff" fill-opacity=".4"/>${leaf(-25, -150, 0.7, -25, light)}${leaf(5, -140, 0.55, 35, shade(hue, 0.55))}<text x="0" y="-228" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="14" fill="#fff" letter-spacing="2">KETO VITALS</text>${text(-85, -95, 170)}<rect x="-70" y="-190" width="14" height="180" rx="7" fill="#fff" fill-opacity=".14"/>`;
      break;
    case "scale":
      body = `<rect x="-150" y="-60" width="300" height="60" rx="22" fill="${dark}"/><rect x="-140" y="-70" width="280" height="22" rx="10" fill="${hue}"/><rect x="-60" y="-66" width="120" height="14" rx="4" fill="#0b1f18"/><text x="0" y="-55" text-anchor="middle" font-family="monospace" font-size="12" fill="#6fe3a8">68.4 kg</text>`;
      break;
    default: // jar / tub
      body = `<rect x="-100" y="-250" width="200" height="250" rx="22" fill="${hue}"/><rect x="-108" y="-300" width="216" height="62" rx="12" fill="${dark}"/><rect x="-108" y="-262" width="216" height="8" fill="#000" fill-opacity=".18"/><rect x="-82" y="-210" width="164" height="150" rx="12" fill="#fff" fill-opacity=".94"/><text x="0" y="-178" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="${dark}" letter-spacing="1">KETO VITALS</text>${lines.map((l, i) => `<text x="0" y="${-150 + i * 22}" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#222">${esc(l)}</text>`).join("")}${leaf(-14, -85, 0.35, -30, hue)}${leaf(8, -82, 0.28, 30, light)}<rect x="-92" y="-240" width="16" height="225" rx="8" fill="#fff" fill-opacity=".14"/>`;
  }
  return `<g transform="translate(${cx} ${base}) scale(${scale})"><ellipse cx="0" cy="6" rx="${shape === "scale" ? 150 : 110}" ry="12" fill="#000" fill-opacity=".14"/>${body}</g>`;
}

function productSvg(p: (typeof products)[number], variant: 1 | 2) {
  const bg = shade(p.hue, 0.88);
  if (variant === 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${esc(p.name)}"><rect width="800" height="800" fill="${bg}"/><circle cx="400" cy="380" r="300" fill="${shade(p.hue, 0.8)}"/>${leaf(90, 620, 1.1, -40, shade(p.hue, 0.55))}${leaf(650, 660, 0.9, 200, shade(p.hue, 0.6))}${pack(p.shape, p.hue, p.name.split(" – ")[0].replace(/\(.*\)/, "").trim(), 400, 640, 1.5)}</svg>`;
  }
  const feats = p.features.slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="Key features of ${esc(p.name)}"><rect width="800" height="800" fill="${shade(p.hue, -0.5)}"/><circle cx="640" cy="160" r="220" fill="${p.hue}" fill-opacity=".35"/>${pack(p.shape, p.hue, p.name.split(" – ")[0], 570, 700, 0.95)}<text x="60" y="130" font-family="Georgia,serif" font-weight="700" font-size="40" fill="#fff">Why you'll like it</text>${feats.map((f, i) => `<g><circle cx="76" cy="${220 + i * 96}" r="14" fill="${shade(p.hue, 0.45)}"/><path d="M69 ${220 + i * 96} l5 6 l10 -12" stroke="#0b1f18" stroke-width="3" fill="none"/>${wrap(f, 22, 2).map((l, j) => `<text x="108" y="${228 + i * 96 + j * 28 - (wrap(f, 22, 2).length > 1 ? 10 : 0)}" font-family="sans-serif" font-size="24" fill="#fff">${esc(l)}</text>`).join("")}</g>`).join("")}</svg>`;
}

for (const p of products) {
  fs.writeFileSync(path.join(pub, "products", `${p.slug}-1.svg`), productSvg(p, 1));
  fs.writeFileSync(path.join(pub, "products", `${p.slug}-2.svg`), productSvg(p, 2));
}

for (const c of categories) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${esc(c.name)}"><rect width="600" height="600" fill="${shade(c.hue, 0.86)}"/><circle cx="300" cy="320" r="230" fill="${shade(c.hue, 0.72)}"/>${leaf(60, 500, 1, -35, shade(c.hue, 0.5))}${pack(c.shape as string, c.hue, c.name.split(" ")[0], 300, 500, 1.1)}</svg>`;
  fs.writeFileSync(path.join(pub, "categories", `${c.slug}.svg`), svg);
}
for (const c of collections) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" role="img" aria-label="${esc(c.name)}"><rect width="800" height="520" fill="${shade(c.hue, 0.84)}"/><circle cx="560" cy="260" r="240" fill="${shade(c.hue, 0.68)}"/>${leaf(40, 470, 1.2, -30, shade(c.hue, 0.45))}${pack("jar", c.hue, "Keto", 300, 470, 0.95)}${pack("tin", shade(c.hue, -0.1), "Leaf", 520, 470, 0.9)}${pack("pouch", shade(c.hue, 0.1), "Daily", 700, 470, 0.8)}</svg>`;
  fs.writeFileSync(path.join(pub, "collections", `${c.slug}.svg`), svg);
}

// Hero artwork (right-hand side of the banner; text is real HTML for accessibility/SEO).
const hero = (hue: string, name: string, shapes: [string, string, number, number, number][]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700" role="img" aria-label="${name}"><circle cx="470" cy="360" r="320" fill="${shade(hue, 0.18)}" fill-opacity=".55"/><circle cx="470" cy="360" r="230" fill="${shade(hue, 0.3)}" fill-opacity=".45"/>${leaf(90, 560, 1.4, -35, shade(hue, 0.55))}${leaf(780, 600, 1.2, 205, shade(hue, 0.5))}${leaf(740, 120, 1, 160, shade(hue, 0.45))}${shapes.map(([s, h, x, y, k]) => pack(s, h, "", x, y, k)).join("")}</svg>`;
fs.writeFileSync(path.join(pub, "banners", "hero-1.svg"), hero("#1f8059", "Keto supplements", [["tin", "#7a2f5a", 300, 620, 1.35], ["bottle", "#b7801a", 560, 640, 1.45], ["jar", "#a8452f", 730, 620, 1.1]]));
fs.writeFileSync(path.join(pub, "banners", "hero-2.svg"), hero("#3f7a3a", "Exotic teas", [["tin", "#4f8f45", 320, 620, 1.5], ["tin", "#7a8a2f", 560, 640, 1.35], ["box", "#a8305a", 740, 620, 1.1]]));
fs.writeFileSync(path.join(pub, "banners", "hero-3.svg"), hero("#2f6f9f", "Protein and fitness", [["jar", "#5a3a2a", 300, 620, 1.45], ["bottle", "#2f6f9f", 540, 640, 1.4], ["scale", "#3a4a5a", 730, 620, 1.0]]));
const wide = (hue: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 360" role="img" aria-label="Promotional artwork"><rect width="700" height="360" fill="${shade(hue, 0.85)}"/><circle cx="460" cy="190" r="190" fill="${shade(hue, 0.7)}"/>${leaf(30, 330, 1, -30, shade(hue, 0.5))}${pack("jar", hue, "", 420, 330, 0.85)}${pack("pouch", shade(hue, -0.1), "", 570, 330, 0.7)}</svg>`;
fs.writeFileSync(path.join(pub, "banners", "mid-1.svg"), wide("#b7801a"));
fs.writeFileSync(path.join(pub, "banners", "mid-2.svg"), wide("#2f6f9f"));

// Brand mark: a stylised leaf in a ring (original artwork).
const mark = (c: string) => `<circle cx="24" cy="24" r="22" fill="none" stroke="${c}" stroke-width="3"/><path d="M14 33C14 20 22 13 35 13C35 26 28 34 16 34Z" fill="${c}"/><path d="M15 33L30 18" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
fs.writeFileSync(path.join(pub, "logo-mark.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${mark("#1a6648")}</svg>`);
fs.writeFileSync(path.join(pub, "icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#134332"/>${mark("#e8bd3f").replace(/#fff/g, "#134332")}</svg>`);
console.log(`Generated ${products.length * 2} product, ${categories.length} category, ${collections.length} collection and 5 banner images.`);
