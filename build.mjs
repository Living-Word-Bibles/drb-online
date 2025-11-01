// DRB Online — Living Word Bibles
// Static verse-per-page generator for drb.livingwordbibles.com
// Keeps: AdSense injection, header/footer, optional remote JSON fallback (no top-level await)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Config (adjust only what you need)
const CONFIG = {
  VERSION_LABEL: "DRB Online (Alpha 1.0)",
  TRANSLATION_ABBR: "drb",
  TRANSLATION_NAME: "Douay-Rheims Bible",
  SITE_TITLE: "The Holy Bible: Douay-Rheims",
  BASE_URL: "https://drb.livingwordbibles.com",
  LOGO_URL:
    "https://static1.squarespace.com/static/68d6b7d6d21f02432fd7397b/t/690209b3567af44aabfbdaca/1761741235124/LivingWordBibles01.png",
  LOGO_DEST: "https://www.livingwordbibles.com/read-the-bible-online/drb",
  SHARE_ORDER: ["facebook", "instagram", "x", "linkedin", "email", "copy"],
  FONT_FAMILY: "EB Garamond",

  // ✅ Your AdSense publisher ID
  ADSENSE_CLIENT: "ca-pub-5303063222439969",

  // ✅ Optional remote JSON fallback (set to a PINNED URL if you want CI to pull data)
  // Leave "" to skip remote fetch and rely on local data/ files.
  REMOTE_DATA_URL: "",

  // Paths
  DATA_JSON: path.join(__dirname, "data", "drb_bible.json"),
  DATA_BOOKS_DIR: path.join(__dirname, "data", "books"),
  TEMPLATE_HTML: path.join(__dirname, "src", "template.html"),
  STYLES_CSS: path.join(__dirname, "src", "styles.css"),
  PUBLIC_DIR: path.join(__dirname, "public"),
  DIST_DIR: path.join(__dirname, "dist"),
};

// ===== Helpers
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const readIfExists = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
const htmlEscape = (s) =>
  String(s).replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Canon aliases for DRB ordering
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

function canonicalizeName(name) {
  const key = String(name).trim().toLowerCase();
  return NAME_ALIASES.get(key) || name;
}

function loadTemplate() {
  for (const p of [CONFIG.TEMPLATE_HTML, CONFIG.STYLES_CSS]) {
    if (!fs.existsSync(p)) {
      throw new Error(`Required file missing: ${p}. Make sure 'src/template.html' and 'src/styles.css' exist (exact casing).`);
    }
  }
  const html = fs.readFileSync(CONFIG.TEMPLATE_HTML, "utf8");
  const css = fs.readFileSync(CONFIG.STYLES_CSS, "utf8");
  return { html, css };
}

// ===== Data (local first, optional remote)
async function fetchRemoteJson(url) {
  if (!url) return null;
  if (typeof fetch !== "function") {
    console.error("[DRB] fetch() is unavailable. Remove REMOTE_DATA_URL or upgrade Node to 18+.");
    return null;
  }
  console.log(`[DRB] Fetching remote JSON: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[DRB] Remote fetch failed: HTTP ${res.status}`);
    return null;
  }
  return await res.json();
}

async function detectData() {
  if (fs.existsSync(CONFIG.DATA_JSON)) {
    console.log(`[DRB] Using local JSON: ${CONFIG.DATA_JSON}`);
    const raw = JSON.parse(fs.readFileSync(CONFIG.DATA_JSON, "utf8"));
    return normalizeFromJson(raw);
  }
  if (fs.existsSync(CONFIG.DATA_BOOKS_DIR)) {
    console.log(`[DRB] Using local folder data: ${CONFIG.DATA_BOOKS_DIR}`);
    return normalizeFromFolder(CONFIG.DATA_BOOKS_DIR);
  }
  const remote = await fetchRemoteJson(CONFIG.REMOTE_DATA_URL);
  if (remote) return normalizeFromJson(remote);

  throw new Error(
    "No input data found.\n- Add data/drb_bible.json, or\n- Add data/books/<Book>/<chapter>.(txt|json), or\n- Set CONFIG.REMOTE_DATA_URL to a pinned JSON URL."
  );
}

function normalizeFromJson(raw) {
  const books = [];
  for (const bookName of Object.keys(raw)) {
    const displayName = canonicalizeName(bookName);
    const chaptersObj = raw[bookName];
    const chapters = [];
    for (const ch of Object.keys(chaptersObj)) {
      const versesArr = chaptersObj[ch];
      const verses = versesArr.map((v, idx) => ({ n: idx + 1, text: String(v) }));
      chapters.push({ n: Number(ch), verses });
    }
    chapters.sort((a, b) => a.n - b.n);
    books.push({ name: displayName, slug: slugify(displayName), chapters });
  }
  return orderByCanon(books);
}

function normalizeFromFolder(root) {
  const books = [];
  for (const bookName of fs.readdirSync(root)) {
    const bookPath = path.join(root, bookName);
    if (!fs.statSync(bookPath).isDirectory()) continue;
    const displayName = canonicalizeName(bookName);
    const chapters = [];
    for (const f of fs.readdirSync(bookPath)) {
      const m = f.match(/(\d+)\.(txt|json)$/i);
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
            const m2 = line.match(/^(\d+)\s+(.*)$/);
            return m2 ? { n: Number(m2[1]), text: m2[2] } : null;
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
  const map = new Map();
  books.forEach((b) => map.set(b.name.toLowerCase(), b));
  const ordered = [];
  for (const name of canon) {
    if (map.has(name)) {
      ordered.push(map.get(name));
      map.delete(name);
    }
  }
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
  return entries.map((e, i) => ({
    ...e,
    prev: i > 0 ? entries[i - 1] : null,
    next: i < entries.length - 1 ? entries[i + 1] : null,
  }));
}

function urlFor(e) {
  return `/${CONFIG.TRANSLATION_ABBR}/${e.book.slug}/${e.chapter}/${e.verse}/`;
}

function renderPage(tpl, e) {
  const canonicalUrl = CONFIG.BASE_URL + urlFor(e);
  const prevUrl = e.prev ? urlFor(e.prev) : null;
  const nextUrl = e.next ? urlFor(e.next) : null;
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
    .replaceAll("{{ADSENSE_CLIENT}}", htmlEscape(CONFIG.ADSENSE_CLIENT))
    .replaceAll("{{PREV_URL}}", prevUrl ? htmlEscape(prevUrl) : "")
    .replaceAll("{{NEXT_URL}}", nextUrl ? htmlEscape(nextUrl) : "")
    .replaceAll("{{PREV_DISABLED}}", prevUrl ? "" : "disabled")
    .replaceAll("{{NEXT_DISABLED}}", nextUrl ? "" : "disabled");

  return html;
}

function renderIndex(tpl, books) {
  const list = books
    .map((b) => {
      const firstChapter = b.chapters[0]?.n ?? 1;
      const firstVerse = b.chapters[0]?.verses?.[0]?.n ?? 1;
      const href = `/${CONFIG.TRANSLATION_ABBR}/${b.slug}/${firstChapter}/${firstVerse}/`;
      return `<li><a href="${href}">${htmlEscape(b.name)}</a></li>`;
    })
    .join("\n");

  const html = tpl.html
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
    .replaceAll("{{ADSENSE_CLIENT}}", htmlEscape(CONFIG.ADSENSE_CLIENT))
    .replaceAll("{{PREV_URL}}", "")
    .replaceAll("{{NEXT_URL}}", "")
    .replaceAll("{{PREV_DISABLED}}", "disabled")
    .replaceAll("{{NEXT_DISABLED}}", "disabled");

  return html;
}

function copyPublic() {
  if (!fs.existsSync(CONFIG.PUBLIC_DIR)) return;
  for (const f of fs.readdirSync(CONFIG.PUBLIC_DIR)) {
    const src = path.join(CONFIG.PUBLIC_DIR, f);
    const dest = path.join(CONFIG.DIST_DIR, f);
    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
    }
  }
}

function writeFileSafe(outPath, content) {
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, content);
}

function buildSitemaps(entries) {
  const chunkSize = 45000;
  const chunks = [];
  for (let i = 0; i < entries.length; i += chunkSize) chunks.push(entries.slice(i, i + chunkSize));

  const smFiles = [];
  chunks.forEach((chunk, idx) => {
    const xml =
      ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        .concat(
          chunk.map((e) => {
            const loc = CONFIG.BASE_URL + urlFor(e);
            return `<url><loc>${loc}</loc></url>`;
          })
        )
        .concat(["</urlset>"])
        .join("\n");
    const fn = idx === 0 ? "sitemap.xml" : `sitemap-${idx + 1}.xml`;
    writeFileSafe(path.join(CONFIG.DIST_DIR, fn), xml);
    smFiles.push(fn);
  });

  const robots = ["User-agent: *", "Allow: /", ...smFiles.map((fn) => `Sitemap: ${CONFIG.BASE_URL}/${fn}`)].join("\n");
  writeFileSafe(path.join(CONFIG.DIST_DIR, "robots.txt"), robots);
}

async function main() {
  try {
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
      const page = renderPage(tpl, e);
      writeFileSafe(outPath, page);
      count++;
    }

    copyPublic();
    buildSitemaps(entries);

    console.log(`Built ${count} verse pages across ${books.length} books → dist/`);
  } catch (err) {
    console.error("[DRB] Build failed:\n" + err.message);
    process.exit(1);
  }
}

main();
