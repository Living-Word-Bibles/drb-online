// DRB Online — Living Word Bibles (Root JSON + Douay-Rheims folder aware)
// Builds static verse-per-page site into /dist for drb.livingwordbibles.com

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CONFIG = {
  TXN_NAME: "Douay-Rheims Bible (DRB)",
  TXN_ABBR: "drb",
  BASE_URL: "https://drb.livingwordbibles.com",
  LOGO_URL: "https://static1.squarespace.com/static/68d6b7d6d21f02432fd7397b/t/690209b3567af44aabfbdaca/1761741235124/LivingWordBibles01.png",
  LOGO_DEST: "https://www.livingwordbibles.com/read-the-bible-online/drb",
  ADSENSE_CLIENT: "ca-pub-5303063222439969",
  CUSTOM_DOMAIN: "drb.livingwordbibles.com", // writes dist/CNAME
  DIST: path.join(__dirname, "dist"),

  // Preferred sources in order
  ROOT_JSON: path.join(__dirname, "EntireBible-DR.json"),      // ← your new root JSON
  ALT_JSON:  path.join(__dirname, "data", "drb_bible.json"),
  FOLDERS: [
    path.join(__dirname, "Douay-Rheims"),                      // ← your new folder
    path.join(__dirname, "Bible-DouayRheims-main"),            // safety net
  ],

  REMOTE_DATA_URL: "", // optional pinned JSON URL if you ever want remote fallback
};

// ---------- utils
const ensureDir = p => fs.mkdirSync(p, { recursive: true });
const write = (p, s) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, s); };
const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

// DRB aliasing
const ALIAS = new Map([
  ["joshua","Josue"],["1 samuel","1 Kings"],["2 samuel","2 Kings"],
  ["1 kings","3 Kings"],["2 kings","4 Kings"],
  ["1 chronicles","1 Paralipomenon"],["2 chronicles","2 Paralipomenon"],
  ["ezra","1 Esdras"],["nehemiah","2 Esdras"],
  ["song of songs","Canticles"],["song of solomon","Canticles"],
  ["isaiah","Isaias"],["jeremiah","Jeremias"],["ezekiel","Ezechiel"],
  ["hosea","Osee"],["obadiah","Abdias"],["jonah","Jonas"],
  ["micah","Micheas"],["habakkuk","Habacuc"],["zephaniah","Sophonias"],
  ["haggai","Aggeus"],["zechariah","Zacharias"],["malachi","Malachias"],
  ["wisdom of solomon","Wisdom"],["sirach","Ecclesiasticus"],
  ["revelation","Apocalypse"]
]);
const canonName = n => ALIAS.get(String(n).trim().toLowerCase()) || n;

const CANON = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy",
  "Josue","Judges","Ruth",
  "1 Kings","2 Kings","3 Kings","4 Kings",
  "1 Paralipomenon","2 Paralipomenon","1 Esdras","2 Esdras","Esdras","Nehemias",
  "Tobias","Judith","Esther","Job","Psalms","Proverbs","Ecclesiastes","Canticles",
  "Wisdom","Ecclesiasticus","Isaias","Jeremias","Lamentations","Baruch","Ezechiel","Daniel",
  "Osee","Joel","Amos","Abdias","Jonas","Micheas","Nahum","Habacuc","Sophonias","Aggeus","Zacharias","Malachias",
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
  "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews",
  "James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Apocalypse"
];

function orderBooks(books){
  const order = CANON.map(n => n.toLowerCase());
  const map = new Map(books.map(b => [b.name.toLowerCase(), b]));
  const out = [];
  for (const n of order){ if (map.has(n)) { out.push(map.get(n)); map.delete(n); } }
  for (const [,b] of map) out.push(b);
  return out;
}

// ---------- normalizers (accept multiple shapes)
function normalizeFromObject(obj){
  // { Book: { "1":[ "v1", ... ], ... } }
  const books = [];
  for (const bookName of Object.keys(obj)){
    const chObj = obj[bookName] || {};
    const chapters = Object.keys(chObj).map(n => ({
      n: Number(n),
      verses: (chObj[n]||[]).map((t,i)=>({ n:i+1, text:String(t) }))
    })).sort((a,b)=>a.n-b.n);
    const name = canonName(bookName);
    books.push({ name, slug: slug(name), chapters });
  }
  return orderBooks(books);
}
function normalizeFromBooksArray(arr){
  // { books:[ {name, chapters:[{chapter,verses:[{verse,text}]}]} ] }
  const books = arr.map(b=>{
    const name = canonName(b.name || b.book || "");
    const chapters = (b.chapters||[]).map(c=>({
      n: Number(c.chapter || c.n || c.number || 0),
      verses: (c.verses||[]).map(v=>({ n:Number(v.verse||v.n||0), text:String(v.text||v.t||"") }))
    })).sort((a,b)=>a.n-b.n);
    return { name, slug: slug(name), chapters };
  });
  return orderBooks(books);
}
function normalizeFromWholeBibleArray(obj){
  // { "Genesis":[ {chapter,verses:[{verse,text}]} ], ... }
  const books = [];
  for (const bookName of Object.keys(obj)){
    const name = canonName(bookName);
    const chapters = (obj[bookName]||[]).map(c=>({
      n: Number(c.chapter||c.n||0),
      verses: (c.verses||[]).map(v=>({ n:Number(v.verse||v.n||0), text:String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    books.push({ name, slug: slug(name), chapters });
  }
  return orderBooks(books);
}

function tryLoadWholeJson(p){
  try {
    const raw = JSON.parse(fs.readFileSync(p,"utf8"));
    if (raw && raw.Genesis) return normalizeFromObject(raw);
    const keys = Object.keys(raw||{});
    if (keys.length===1 && raw[keys[0]] && raw[keys[0]].Genesis) return normalizeFromObject(raw[keys[0]]);
    if (raw && Array.isArray(raw.books)) return normalizeFromBooksArray(raw.books);
    if (keys.length && Array.isArray(raw[keys[0]])) return normalizeFromWholeBibleArray(raw);
  } catch {}
  return null;
}

function tryLoadChaptersFromFolder(dir){
  if (!fs.existsSync(dir)) return null;
  const books = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const bookDir = path.join(dir, entry.name);
    const name = canonName(entry.name);
    const chs = [];
    for (const file of fs.readdirSync(bookDir)) {
      const full = path.join(bookDir, file);
      if (!fs.statSync(full).isFile()) continue;
      const m = file.match(/(\d+)/);
      if (!m) continue;
      const chNum = Number(m[1]);
      const raw = fs.readFileSync(full, "utf8");
      let verses = [];
      if (/\.json$/i.test(file)) {
        try {
          const js = JSON.parse(raw);
          if (Array.isArray(js)) verses = js.map((t,i)=>({ n:i+1, text:String(t) }));
          else if (js.verses && Array.isArray(js.verses)) verses = js.verses.map(v=>({ n:Number(v.verse||v.n||0), text:String(v.text||"") }));
        } catch {}
      } else {
        verses = raw.split(/\r?\n/).filter(Boolean).map(line=>{
          const mm = line.match(/^(\d+)\s*[:. -]?\s*(.+)$/);
          return mm ? { n:Number(mm[1]), text:mm[2] } : null;
        }).filter(Boolean);
      }
      if (verses.length) chs.push({ n: chNum, verses });
    }
    if (chs.length){ chs.sort((a,b)=>a.n-b.n); books.push({ name, slug: slug(name), chapters: chs }); }
  }
  return books.length ? orderBooks(books) : null;
}

// ---------- data detection (in your new order)
async function detectData() {
  // 1) Root JSON
  if (fs.existsSync(CONFIG.ROOT_JSON)) {
    const b = tryLoadWholeJson(CONFIG.ROOT_JSON);
    if (b) { console.log("[DATA] Using ROOT JSON:", path.basename(CONFIG.ROOT_JSON)); return b; }
  }
  // 2) data/drb_bible.json
  if (fs.existsSync(CONFIG.ALT_JSON)) {
    const b = tryLoadWholeJson(CONFIG.ALT_JSON);
    if (b) { console.log("[DATA] Using ALT JSON:", "data/drb_bible.json"); return b; }
  }
  // 3) Scan new Douay-Rheims folder (and legacy)
  for (const dir of CONFIG.FOLDERS) {
    if (!fs.existsSync(dir)) continue;
    // Prefer a whole-Bible JSON sitting inside, if any
    for (const f of fs.readdirSync(dir)) {
      if (!/\.json$/i.test(f)) continue;
      const p = path.join(dir, f);
      const b = tryLoadWholeJson(p);
      if (b) { console.log("[DATA] Using folder JSON:", path.join(path.basename(dir), f)); return b; }
    }
    // Else, treat as per-chapter repo
    const c = tryLoadChaptersFromFolder(dir);
    if (c) { console.log("[DATA] Using chapters under:", path.basename(dir)); return c; }
  }
  // 4) Optional remote
  if (CONFIG.REMOTE_DATA_URL && typeof fetch === "function") {
    try {
      const r = await fetch(CONFIG.REMOTE_DATA_URL); if (r.ok) {
        const raw = await r.json();
        const b = tryLoadWholeJsonFromRaw(raw);
        if (b) { console.log("[DATA] Using REMOTE_DATA_URL"); return b; }
      }
    } catch {}
  }
  throw new Error("No usable DRB data found (looked at root JSON, data/, Douay-Rheims/, Bible-DouayRheims-main/).");
}
function tryLoadWholeJsonFromRaw(raw){
  if (raw && raw.Genesis) return normalizeFromObject(raw);
  const keys = Object.keys(raw||{});
  if (keys.length===1 && raw[keys[0]] && raw[keys[0]].Genesis) return normalizeFromObject(raw[keys[0]]);
  if (raw && Array.isArray(raw.books)) return normalizeFromBooksArray(raw.books);
  if (keys.length && Array.isArray(raw[keys[0]])) return normalizeFromWholeBibleArray(raw);
  return null;
}

// ---------- inline site (no external template)
const CSS = `
:root { --fg:#222; --bg:#fff; --mut:#666; --edge:#eee; }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font-family:"EB Garamond",ui-serif,Georgia,serif}
.wrap{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--edge);border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)}
.head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--edge);background:#faf9f7;position:sticky;top:0;z-index:5}
.head img{height:36px;display:block}
.super{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}
.name{font-size:18px;margin:2px 0 0}
.body{padding:16px}
.nav{display:flex;justify-content:space-between;gap:8px;margin:12px 0 10px}
.btn{background:#f2f0ec;border:1px solid #e6e3de;border-radius:999px;padding:8px 12px;text-decoration:none;color:#222}
.btn.disabled{opacity:.5;pointer-events:none}
.ref{font-variant:small-caps;letter-spacing:.02em;opacity:.7;margin:0 0 6px}
.text{font-size:20px;line-height:1.6;background:#fff;border:1px solid var(--edge);border-radius:14px;padding:18px}
.share{margin:14px 2px 6px}
.share .label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-bottom:6px}
.share-row{display:flex;flex-wrap:wrap;gap:8px}
.share-row a{background:#f2f0ec;border:1px solid #e6e3de;border-radius:999px;padding:8px 12px;font-size:14px;text-decoration:none;color:#222}
.foot{text-align:center;padding:10px 14px;color:var(--mut);font-size:12px;border-top:1px solid var(--edge);background:#faf9f7}
.foot a{color:inherit;text-decoration:underline}
@media (max-width:520px){.text{font-size:18px}}
`;

// page + index renderers
function pageHtml(e, prev, next){
  const ref = `${e.book} ${e.chapter}:${e.verse}`;
  const url = CONFIG.BASE_URL + `/${CONFIG.TXN_ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/`;
  const share = `Douay-Rheims — ${ref}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(CONFIG.TXN_NAME)} — ${esc(ref)}</title>
<link rel="canonical" href="${esc(url)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(CONFIG.ADSENSE_CLIENT)}" crossorigin="anonymous"></script>
<style>${CSS}</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <a href="${esc(CONFIG.LOGO_DEST)}" aria-label="Back to Living Word Bibles"><img src="${esc(CONFIG.LOGO_URL)}" alt="Living Word Bibles"></a>
      <div><div class="super">The Holy Bible</div><div class="name">${esc(CONFIG.TXN_NAME)}</div></div>
    </div>
    <div class="body">
      <div class="nav">
        <a class="btn ${prev ? "" : "disabled"}" href="${prev? esc(prev): "#"}">◀ Prev</a>
        <a class="btn ${next ? "" : "disabled"}" href="${next? esc(next): "#"}">Next ▶</a>
      </div>
      <div class="ref">${esc(ref)}</div>
      <div class="text">${esc(e.text)}</div>
      <div class="share">
        <div class="label">Share</div>
        <div class="share-row">
          <a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a>
          <a target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(share)}">X</a>
          <a target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}">LinkedIn</a>
          <a href="mailto:?subject=${encodeURIComponent(share)}&body=${encodeURIComponent(url)}">Email</a>
        </div>
      </div>
      <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(CONFIG.ADSENSE_CLIENT)}" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
      <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
    </div>
    <div class="foot">Copyright © 2025 | Living Word Bibles | All Rights Reserved | <a href="https://www.livingwordbibles.com">www.livingwordbibles.com</a></div>
  </div>
</body>
</html>`;
}
function indexHtml(books){
  const items = books.map(b=>{
    const c1 = b.chapters[0]?.n ?? 1;
    const v1 = b.chapters[0]?.verses?.[0]?.n ?? 1;
    const href = `/${CONFIG.TXN_ABBR}/${b.slug}/${c1}/${v1}/`;
    return `<li><a href="${href}">${esc(b.name)}</a></li>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Holy Bible: Douay-Rheims — Table of Contents</title>
<link rel="canonical" href="${esc(CONFIG.BASE_URL)}/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<style>${CSS}.toc{columns:2;gap:18px}@media(max-width:640px){.toc{columns:1}}</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <a href="${esc(CONFIG.LOGO_DEST)}"><img src="${esc(CONFIG.LOGO_URL)}" alt="Living Word Bibles"></a>
      <div><div class="super">The Holy Bible</div><div class="name">${esc(CONFIG.TXN_NAME)}</div></div>
    </div>
    <div class="body">
      <h1 style="margin:.25rem 0 1rem">Table of Contents</h1>
      <ul class="toc">${items}</ul>
    </div>
    <div class="foot">Copyright © 2025 | Living Word Bibles | All Rights Reserved | <a href="https://www.livingwordbibles.com">www.livingwordbibles.com</a></div>
  </div>
</body>
</html>`;
}

// ---------- linearize + routes + sitemaps/robots/CNAME
function linearize(books){
  const flat = [];
  for (const b of books){
    for (const ch of b.chapters){
      for (const v of ch.verses){
        flat.push({ book:b.name, bookSlug:b.slug, chapter:ch.n, verse:v.n, text:v.text });
      }
    }
  }
  return flat;
}
const urlOf = (e) => `/${CONFIG.TXN_ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/`;

function writeSitemaps(all){
  const chunk = 45000;
  const files = [];
  for (let i=0;i<all.length;i+=chunk){
    const slice = all.slice(i,i+chunk);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...slice.map(e=>`<url><loc>${CONFIG.BASE_URL}${urlOf(e)}</loc></url>`),
      '</urlset>'
    ].join("\n");
    const name = i===0 ? "sitemap.xml" : `sitemap-${(i/chunk)+1|0}.xml`;
    write(path.join(CONFIG.DIST, name), xml);
    files.push(name);
  }
  const robots = ["User-agent: *","Allow: /", ...files.map(f=>`Sitemap: ${CONFIG.BASE_URL}/${f}`)].join("\n");
  write(path.join(CONFIG.DIST, "robots.txt"), robots);
}
function writeCNAME(){
  if (!CONFIG.CUSTOM_DOMAIN) return;
  write(path.join(CONFIG.DIST, "CNAME"), CONFIG.CUSTOM_DOMAIN + "\n");
}

// ---------- main
async function main(){
  fs.rmSync(CONFIG.DIST, { recursive:true, force:true });
  ensureDir(CONFIG.DIST);

  // discover data in the new structure
  const books = await detectData();
  console.log(`[DATA] Books detected: ${books.length}`);

  // build
  const flat  = linearize(books);
  write(path.join(CONFIG.DIST, "index.html"), indexHtml(books));
  for (let i=0;i<flat.length;i++){
    const e = flat[i], prev = i>0 ? urlOf(flat[i-1]) : null, next = i+1<flat.length ? urlOf(flat[i+1]) : null;
    write(path.join(CONFIG.DIST, urlOf(e), "index.html"), pageHtml(e, prev, next));
  }
  writeSitemaps(flat);
  writeCNAME();

  console.log(`[DRB] Built ${flat.length} verse pages across ${books.length} books → dist/`);
}

main().catch(err => { console.error("[DRB] Build failed:", err.message); process.exit(1); });
