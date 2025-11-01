// DRB Online — Living Word Bibles
// Static verse-per-page generator for drb.livingwordbibles.com
// Detects: data/drb_bible.json → data/books/... → Bible-DouayRheims-main/
// Injects: AdSense, header link, clickable footer; builds sitemaps & robots.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Config
const CONFIG = {
  VERSION_LABEL: "DRB Online (Alpha 1.0)",
  TRANSLATION_ABBR: "drb",
  TRANSLATION_NAME: "Douay-Rheims Bible",
  SITE_TITLE: "The Holy Bible: Douay-Rheims",
  BASE_URL: "https://drb.livingwordbibles.com",
  LOGO_URL:
    "https://static1.squarespace.com/static/68d6b7d6d21f02432fd7397b/t/690209b3567af44aabfbdaca/1761741235124/LivingWordBibles01.png",
  LOGO_DEST: "https://www.livingwordbibles.com/read-the-bible-online/drb",
  FONT_FAMILY: "EB Garamond",
  ADSENSE_CLIENT: "ca-pub-5303063222439969",

  // Optional remote JSON fallback; leave empty unless you have a pinned URL.
  REMOTE_DATA_URL: "",

  // Paths
  DATA_JSON: path.join(__dirname, "data", "drb_bible.json"),
  DATA_BOOKS_DIR: path.join(__dirname, "data", "books"),
  ALT_DIR: path.join(__dirname, "Bible-DouayRheims-main"),
  TEMPLATE_HTML: path.join(__dirname, "src", "template.html"),
  STYLES_CSS: path.join(__dirname, "src", "styles.css"),
  PUBLIC_DIR: path.join(__dirname, "public"),
  DIST_DIR: path.join(__dirname, "dist"),

  FOOTER_HTML:
    '\n<footer style="text-align:center;padding:14px;color:#666;font:13px/1.3 EB Garamond,serif;border-top:1px solid #eee;background:#faf9f7">\n' +
    'Copyright © 2025 | Living Word Bibles | All Rights Reserved | ' +
    '<a href="https://www.livingwordbibles.com" style="color:inherit;text-decoration:underline">www.livingwordbibles.com</a>\n' +
    "</footer>\n",
};

// ---------- Helpers
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const readIfExists = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const htmlEscape = (s) =>
  String(s).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const NAME_ALIASES = new Map([
  ["joshua", "Josue"], ["1 samuel", "1 Kings"], ["2 samuel", "2 Kings"],
  ["1 kings", "3 Kings"], ["2 kings", "4 Kings"],
  ["1 chronicles", "1 Paralipomenon"], ["2 chronicles", "2 Paralipomenon"],
  ["ezra", "1 Esdras"], ["nehemiah", "2 Esdras"],
  ["song of songs", "Canticles"], ["song of solomon", "Canticles"],
  ["isaiah", "Isaias"], ["jeremiah", "Jeremias"], ["ezekiel", "Ezechiel"],
  ["hosea", "Osee"], ["obadiah", "Abdias"], ["jonah", "Jonas"],
  ["micah", "Micheas"], ["habakkuk", "Habacuc"], ["zephaniah", "Sophonias"],
  ["haggai", "Aggeus"], ["zechariah", "Zacharias"], ["malachi", "Malachias"],
  ["wisdom of solomon", "Wisdom"], ["sirach", "Ecclesiasticus"],
  ["revelation", "Apocalypse"],
]);
const canonName = (name) => NAME_ALIASES.get(String(name).trim().toLowerCase()) || name;

// ---------- Template
function loadTemplate() {
  for (const p of [CONFIG.TEMPLATE_HTML, CONFIG.STYLES_CSS]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Required file missing: ${p} (check 'src/' paths & casing)`);
    }
  }
  const html = fs.readFileSync(CONFIG.TEMPLATE_HTML, "utf8");
  const css = fs.readFileSync(CONFIG.STYLES_CSS, "utf8");
  return { html, css };
}
function injectFooter(html) {
  if (html.includes("{{FOOTER_HTML}}")) return html.replaceAll("{{FOOTER_HTML}}", CONFIG.FOOTER_HTML);
  // Fallback: append before </body>
  return html.replace(/<\/body\s*>/i, `${CONFIG.FOOTER_HTML}</body>`);
}

// ---------- Data normalization
function normalizeFromJson(raw) {
  // Case A: desired shape { Genesis: { "1": [".."], "2": [...] }, ... }
  if (raw && raw.Genesis && typeof raw.Genesis === "object") return raw;

  // Case B: wrapped { "Douay-Rheims": { Genesis: {...} } }
  if (raw && typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 1 && raw[keys[0]] && raw[keys[0]].Genesis) return raw[keys[0]];
  }

  // Case C: array of rows { book, chapter, verse, text }
  if (Array.isArray(raw)) {
    const out = {};
    for (const r of raw) {
      const b = canonName(r.book || r.Book || r.name || "");
      const c = String(r.chapter || r.Chapter || 0);
      const v = Number(r.verse || r.Verse || 0);
      const t = r.text || r.Text || r.content || "";
      if (!b || !c || !v) continue;
      (out[b] ||= {}); (out[b][c] ||= []); out[b][c][v - 1] = String(t);
    }
    return out;
  }

  // Case D: flat KV { "Genesis 1:1": "text", ... }
  if (raw && typeof raw === "object") {
    const out = {};
    for (const k of Object.keys(raw)) {
      const m = k.match(/^(.+?)\s+(\d+):(\d+)$/);
      if (!m) continue;
      const b = canonName(m[1]); const c = m[2]; const v = Number(m[3]);
      (out[b] ||= {}); (out[b][c] ||= []); out[b][c][v - 1] = String(raw[k]);
    }
    if (Object.keys(out).length) return out;
  }

  throw new Error("Unrecognized DRB JSON structure");
}

function normalizeFromFolder(root) {
  const books = [];
  for (const bookName of fs.readdirSync(root)) {
    const bookPath = path.join(root, bookName);
    if (!fs.statSync(bookPath).isDirectory()) continue;
    const displayName = canonName(bookName);
    const chapters = [];
    for (const f of fs.readdirSync(bookPath)) {
      const m = f.match(/^(\d+)\.(txt|json)$/i);
      if (!m) continue;
      const chNum = Number(m[1]);
      const filePath = path.join(bookPath, f);
      const content = readIfExists(filePath);
      let verses = [];
      if (f.toLowerCase().endsWith(".json")) {
        const arr = JSON.parse(content);
        verses = arr.map((t, i) => ({ n: i + 1, text: String(t) }));
      } else {
        verses = content
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => {
            const mm = line.match(/^(\d+)\s+(.*)$/);
            return mm ? { n: Number(mm[1]), text: mm[2] } : null;
          })
          .filter(Boolean);
      }
      chapters.push({ n: chNum, verses });
    }
    chapters.sort((a, b) => a.n - b.n);
    books.push({ name: displayName, slug: slugify(displayName), chapters });
  }
  return orderByCanon(books);
}

function normalizeJsonToOrderedBooks(raw) {
  // raw: { Book: { "1":[..], "2":[..] } }
  const books = [];
  for (const bookName of Object.keys(raw)) {
    const displayName = canonName(bookName);
    const chObj = raw[bookName];
    const chapters = Object.keys(chObj)
      .map((n) => ({ n: Number(n), verses: chObj[n].map((t, i) => ({ n: i + 1, text: String(t) })) }))
      .sort((a, b) => a.n - b.n);
    books.push({ name: displayName, slug: slugify(displayName), chapters });
  }
  return orderByCanon(books);
}

// DRB 73-book order
function orderByCanon(books) {
  const canon = [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
    "Josue","Judges","Ruth",
    "1 Kings","2 Kings","3 Kings","4 Kings",
    "1 Paralipomenon","2 Paralipomenon",
    "1 Esdras","2 Esdras","Esdras","Nehemias",
    "Tobias","Judith","Esther","Job","Psalms","Proverbs","Ecclesiastes","Canticles",
    "Wisdom","Ecclesiasticus",
    "Isaias","Jeremias","Lamentations","Baruch","Ezechiel","Daniel",
    "Osee","Joel","Amos","Abdias","Jonas","Micheas","Nahum","Habacuc","Sophonias","Aggeus","Zacharias","Malachias",
    "Matthew","Mark","Luke","John","Acts","Romans",
    "1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
    "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews",
    "James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Apocalypse"
  ].map((n) => n.toLowerCase());
  const map = new Map(books.map((b) => [b.name.toLowerCase(), b]));
  const ordered = [];
  for (const name of canon) if (map.has(name)) { ordered.push(map.get(name)); map.delete(name); }
  for (const [, b] of map) ordered.push(b);
  return ordered;
}

function linearize(books) {
  const entries = [];
  books.forEach((book) => {
    book.chapters.forEach((ch) => {
      ch.verses.forEach((v) => {
        entries.push({ book, chapter: ch.n, verse: v.n, text: v.text });
      });
    });
  });
  return entries.map((e, i) => ({ ...e, prev: i ? entries[i - 1] : null, next: i + 1 < entries.length ? entries[i + 1] : null }));
}

function urlFor(e) {
  return `/${CONFIG.TRANSLATION_ABBR}/${e.book.slug}/${e.chapter}/${e.verse}/`;
}

// ---------- Renderers
function renderPage(tpl, e) {
  const canonicalUrl = CONFIG.BASE_URL + urlFor(e);
  const shareTitle = `${CONFIG.TRANSLATION_NAME} — ${e.book.name} ${e.chapter}:${e.verse}`;
  let html = tpl.html
    .replaceAll("{{SITE_TITLE}}", htmlEscape(CONFIG.SITE_TITLE))
    .replaceAll("{{VERSION_LABEL}}", htmlEscape(CONFIG.VERSION_LABEL))
    .replaceAll("{{FONT_FAMILY}}", htmlEscape(CONFIG.FONT_FAMILY))
    .replaceAll("{{LOGO_URL}}", htmlEscape(CONFIG.LOGO_URL))
    .replaceAll("{{LOGO_DEST}}", htmlEscape(CONFIG.LOGO_DEST))
    .replaceAll("{{TRANSLATION_NAME}}", htmlEscape(CONFIG.TRANSLATION_NAME))
    .replaceAll("{{BOOK_NAME}}", htmlEscape(e.book.name))
    .replaceAll("{{CHAPTER}}", String(e.chapter))
    .replaceAll("{{VERSE}}", String(e.verse))
    .replaceAll("{{VERSE_TEXT}}", htmlEscape(e.text))
    .replaceAll("{{CANONICAL_URL}}", htmlEscape(canonicalUrl))
    .replaceAll("{{SHARE_TITLE}}", htmlEscape(shareTitle))
    .replaceAll("{{SHARE_URL}}", htmlEscape(canonicalUrl))
    .replaceAll("{{CSS_INLINE}}", tpl.css)
    .replaceAll("{{ADSENSE_CLIENT}}", htmlEscape(CONFIG.ADSENSE_CLIENT));
  html = injectFooter(html);

  // prev/next buttons
  const prevUrl = e.prev ? urlFor(e.prev) : "";
  const nextUrl = e.next ? urlFor(e.next) : "";
  html = html
    .replaceAll("{{PREV_URL}}", prevUrl)
    .replaceAll("{{NEXT_URL}}", nextUrl)
    .replaceAll("{{PREV_DISABLED}}", e.prev ? "" : "disabled")
    .replaceAll("{{NEXT_DISABLED}}", e.next ? "" : "disabled");

  return html;
}

function renderIndex(tpl, books) {
  const list = books.map((b) => {
    const c1 = b.chapters[0]?.n ?? 1;
    const v1 = b.chapters[0]?.verses?.[0]?.n ?? 1;
    return `<li><a href="/${CONFIG.TRANSLATION_ABBR}/${b.slug}/${c1}/${v1}/">${htmlEscape(b.name)}</a></li>`;
  }).join("\n");

  let html = tpl.html
    .replaceAll("{{SITE_TITLE}}", htmlEscape(CONFIG.SITE_TITLE))
    .replaceAll("{{VERSION_LABEL}}", htmlEscape(CONFIG.VERSION_LABEL))
    .replaceAll("{{FONT_FAMILY}}", htmlEscape(CONFIG.FONT_FAMILY))
    .replaceAll("{{LOGO_URL}}", htmlEscape(CONFIG.LOGO_URL))
    .replaceAll("{{LOGO_DEST}}", htmlEscape(CONFIG.LOGO_DEST))
    .replaceAll("{{TRANSLATION_NAME}}", htmlEscape(CONFIG.TRANSLATION_NAME))
    .replaceAll("{{BOOK_NAME}}", "Table of Contents")
    .replaceAll("{{CHAPTER}}", "")
    .replaceAll("{{VERSE}}", "")
    .replaceAll("{{VERSE_TEXT}}", `<ul class="toc">${list}</ul>`)
    .replaceAll("{{CANONICAL_URL}}", htmlEscape(CONFIG.BASE_URL + "/"))
    .replaceAll("{{SHARE_TITLE}}", htmlEscape(CONFIG.SITE_TITLE))
    .replaceAll("{{SHARE_URL}}", htmlEscape(CONFIG.BASE_URL + "/"))
    .replaceAll("{{CSS_INLINE}}", tpl.css)
    .replaceAll("{{ADSENSE_CLIENT}}", htmlEscape(CONFIG.ADSENSE_CLIENT));
  html = injectFooter(html);
  html = html
    .replaceAll("{{PREV_URL}}", "")
    .replaceAll("{{NEXT_URL}}", "")
    .replaceAll("{{PREV_DISABLED}}", "disabled")
    .replaceAll("{{NEXT_DISABLED}}", "disabled");
  return html;
}

// ---------- Data detection
async function fetchRemoteJson(url) {
  if (!url) return null;
  if (typeof fetch !== "function") return null;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return null;
  }
}

function tryAltWholeBibleJson(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json"));
  if (!files.length) return null;
  // Prefer likely whole-bible filenames
  const preferred = files.find((f) => /entire|whole|dr\b|drb|douay|bible/i.test(f)) || files[0];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, preferred), "utf8"));
    return normalizeFromJson(raw);
  } catch {
    return null;
  }
}

async function detectData() {
  // 1) Single JSON in data/
  if (fs.existsSync(CONFIG.DATA_JSON)) {
    const raw = JSON.parse(fs.readFileSync(CONFIG.DATA_JSON, "utf8"));
    return normalizeJsonToOrderedBooks(raw);
  }
  // 2) Per-book folders in data/books/
  if (fs.existsSync(CONFIG.DATA_BOOKS_DIR)) {
    return normalizeFromFolder(CONFIG.DATA_BOOKS_DIR);
  }
  // 3) ALT root (Bible-DouayRheims-main/)
  if (fs.existsSync(CONFIG.ALT_DIR)) {
    // 3a) Try a whole-bible JSON sitting in ALT_DIR
    const whole = tryAltWholeBibleJson(CONFIG.ALT_DIR);
    if (whole) return normalizeJsonToOrderedBooks(whole);

    // 3b) Otherwise treat ALT_DIR like a per-book folder layout
    return normalizeFromFolder(CONFIG.ALT_DIR);
  }
  // 4) Remote fallback if provided
  const remote = await fetchRemoteJson(CONFIG.REMOTE_DATA_URL);
  if (remote) return normalizeJsonToOrderedBooks(normalizeFromJson(remote));

  throw new Error(
    "No input data found.\nLooked for: data/drb_bible.json, data/books/*, Bible-DouayRheims-main/*, REMOTE_DATA_URL"
  );
}

// ---------- Build utils
function copyPublic() {
  if (!fs.existsSync(CONFIG.PUBLIC_DIR)) return;
  for (const f of fs.readdirSync(CONFIG.PUBLIC_DIR)) {
    const src = path.join(CONFIG.PUBLIC_DIR, f);
    const dest = path.join(CONFIG.DIST_DIR, f);
    if (fs.statSync(src).isDirectory()) fs.cpSync(src, dest, { recursive: true });
    else { ensureDir(path.dirname(dest)); fs.copyFileSync(src, dest); }
  }
}

function writeFileSafe(outPath, content) { ensureDir(path.dirname(outPath)); fs.writeFileSync(outPath, content); }

function buildSitemaps(entries) {
  const chunkSize = 45000;
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) chunks.push(entries.slice(i, i + chunkSize));
  const smFiles = [];
  chunks.forEach((chunk, idx) => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
      .concat(chunk.map((e) => `<url><loc>${CONFIG.BASE_URL + urlFor(e)}</loc></url>`))
      .concat(["</urlset>"])
      .join("\n");
    const fn = idx === 0 ? "sitemap.xml" : `sitemap-${idx + 1}.xml`;
    writeFileSafe(path.join(CONFIG.DIST_DIR, fn), xml);
    smFiles.push(fn);
  });
  const robots = ["User-agent: *", "Allow: /", ...smFiles.map((fn) => `Sitemap: ${CONFIG.BASE_URL}/${fn}`)].join("\n");
  writeFileSafe(path.join(CONFIG.DIST_DIR, "robots.txt"), robots);
}

// ---------- Main
async function main() {
  fs.rmSync(CONFIG.DIST_DIR, { recursive: true, force: true });
  ensureDir(CONFIG.DIST_DIR);

  const { html, css } = loadTemplate();
  const tpl = { html, css };

  const books = await detectData();
  const entries = linearize(books);

  writeFileSafe(path.join(CONFIG.DIST_DIR, "index.html"), renderIndex(tpl, books));
  let count = 0;
  for (const e of entries) {
    const outPath = path.join(CONFIG.DIST_DIR, urlFor(e), "index.html");
    writeFileSafe(outPath, renderPage(tpl, e));
    count++;
  }

  copyPublic();
  buildSitemaps(entries);
  console.log(`Built ${count} verse pages across ${books.length} books → dist/`);
}

main().catch((err) => {
  console.error("[DRB] Build failed:\n" + err.message);
  process.exit(1);
});
