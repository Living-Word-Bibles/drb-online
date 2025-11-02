// DRB Online — auto-detect build for repo layout:
//   Root: /Bible-DouayRheims-main/(...nested data...)
// Produces: /dist with verse-per-page site for drb.livingwordbibles.com

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// —— Configuration
const CFG = {
  NAME: "Douay-Rheims Bible (DRB)",
  ABBR: "drb",
  BASE_URL: "https://drb.livingwordbibles.com",
  LOGO_URL: "https://static1.squarespace.com/static/68d6b7d6d21f02432fd7397b/t/690209b3567af44aabfbdaca/1761741235124/LivingWordBibles01.png",
  LOGO_DEST: "https://www.livingwordbibles.com/read-the-bible-online/drb",
  ADSENSE: "ca-pub-5303063222439969",
  DATA_ROOT: path.join(__dirname, "Bible-DouayRheims-main"),
  DIST: path.join(__dirname, "dist"),
  CUSTOM_DOMAIN: "drb.livingwordbibles.com",
};

const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const ensureDir = p => fs.mkdirSync(p, { recursive: true });
const write = (p, s) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, s); };

// ——— Styling (EB Garamond)
const CSS = `
:root{--fg:#222;--bg:#fff;--mut:#666;--edge:#eee}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:"EB Garamond",ui-serif,Georgia,serif}
.wrap{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--edge);border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)}
.head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--edge);background:#faf9f7;position:sticky;top:0;z-index:5}
.head img{height:36px}
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
@media(max-width:520px){.text{font-size:18px}}
`;

// ——— Canon aliases for DRB naming
const ALIAS = new Map([
  ["joshua","Josue"],["1 samuel","1 Kings"],["2 samuel","2 Kings"],
  ["1 kings","3 Kings"],["2 kings","4 Kings"],
  ["1 chronicles","1 Paralipomenon"],["2 chronicles","2 Paralipomenon"],
  ["ezra","1 Esdras"],["nehemiah","2 Esdras"],["song of songs","Canticles"],
  ["song of solomon","Canticles"],["isaiah","Isaias"],["jeremiah","Jeremias"],
  ["ezekiel","Ezechiel"],["hosea","Osee"],["obadiah","Abdias"],["jonah","Jonas"],
  ["micah","Micheas"],["habakkuk","Habacuc"],["zephaniah","Sophonias"],
  ["haggai","Aggeus"],["zechariah","Zacharias"],["malachi","Malachias"],
  ["wisdom of solomon","Wisdom"],["sirach","Ecclesiasticus"],["revelation","Apocalypse"]
]);
const canonName = n => ALIAS.get(String(n).trim().toLowerCase()) || n;

// ——— File discovery
function* walk(dir){
  if (!fs.existsSync(dir)) return;
  const SKIP = new Set([".git","dist",".github","node_modules"]);
  const stack=[dir];
  while (stack.length){
    const d=stack.pop();
    for (const ent of fs.readdirSync(d,{withFileTypes:true})){
      if (SKIP.has(ent.name)) continue;
      const p=path.join(d,ent.name);
      if (ent.isDirectory()) stack.push(p);
      else yield p;
    }
  }
}

// ——— Normalizers (accepts whole-Bible JSON or per-chapter JSON)
function normalizeFromObject(obj){
  const out=[];
  for (const book of Object.keys(obj)){
    const chs = Object.keys(obj[book]||{}).map(n=>({
      n:Number(n),
      verses:(obj[book][n]||[]).map((t,i)=>({ n:i+1, text:String(t) }))
    })).sort((a,b)=>a.n-b.n);
    const name = canonName(book);
    out.push({ name, slug: slug(name), chapters: chs });
  }
  return out;
}
function normalizeFromBooksArray(arr){
  return arr.map(b=>{
    const name = canonName(b.name||b.book||"");
    const chs = (b.chapters||[]).map(c=>({
      n:Number(c.chapter||c.n||0),
      verses:(c.verses||[]).map(v=>({ n:Number(v.verse||v.n||0), text:String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    return { name, slug: slug(name), chapters: chs };
  });
}
function normalizeFromWholeArray(obj){
  const out=[];
  for (const book of Object.keys(obj)){
    const name = canonName(book);
    const chs = (obj[book]||[]).map(c=>({
      n:Number(c.chapter||c.n||0),
      verses:(c.verses||[]).map(v=>({ n:Number(v.verse||v.n||0), text:String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    out.push({ name, slug: slug(name), chapters: chs });
  }
  return out;
}

function tryParseWholeBibleJSON(p){
  try{
    const rawText = fs.readFileSync(p,"utf8").replace(/^\uFEFF/,"");
    const raw = JSON.parse(rawText);
    if (raw && raw.Genesis) return normalizeFromObject(raw);
    const k = Object.keys(raw||{});
    if (k.length===1 && raw[k[0]] && raw[k[0]].Genesis) return normalizeFromObject(raw[k[0]]);
    if (Array.isArray(raw?.books)) return normalizeFromBooksArray(raw.books);
    if (k.length && Array.isArray(raw[k[0]])) return normalizeFromWholeArray(raw);
  } catch {}
  return null;
}

function tryLoadChaptersFromFolder(dir){
  if (!fs.existsSync(dir)) return null;
  const books=[];
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if (!ent.isDirectory()) continue;
    const bookDir = path.join(dir, ent.name);
    const name = canonName(ent.name);
    const chapters=[];
    for (const file of fs.readdirSync(bookDir)){
      const full = path.join(bookDir, file);
      if (!fs.statSync(full).isFile()) continue;
      const m = file.match(/(\d+)/); if (!m) continue;
      const chNum = Number(m[1]);
      let verses=[];
      const txt = fs.readFileSync(full,"utf8");
      if (/\.json$/i.test(file)){
        try{
          const js = JSON.parse(txt);
          if (Array.isArray(js)) verses = js.map((t,i)=>({ n:i+1, text:String(t) }));
          else if (Array.isArray(js?.verses)) verses = js.verses.map(v=>({ n:Number(v.verse||v.n||0), text:String(v.text||"") }));
        }catch{}
      }else{
        verses = txt.split(/\r?\n/).filter(Boolean).map(line=>{
          const mm = line.match(/^(\d+)\s*[:.\-]?\s*(.+)$/);
          return mm ? { n:Number(mm[1]), text:mm[2] } : null;
        }).filter(Boolean);
      }
      if (verses.length) chapters.push({ n: chNum, verses });
    }
    if (chapters.length){
      chapters.sort((a,b)=>a.n-b.n);
      books.push({ name, slug: slug(name), chapters });
    }
  }
  return books.length ? books : null;
}

function detectData(){
  if (!fs.existsSync(CFG.DATA_ROOT)) throw new Error(`Data folder not found: ${CFG.DATA_ROOT}`);

  // 1) Look for a whole-Bible JSON anywhere under DATA_ROOT
  const candidates = [];
  for (const p of walk(CFG.DATA_ROOT)){
    if (!/\.json$/i.test(p)) continue;
    if (/(Entire|Complete|All).*?(Bible|DR)/i.test(path.basename(p)) || /douay|dr/i.test(path.basename(p))){
      candidates.push(p);
    }
  }
  // Try strong candidates first, then any JSON
  const sorted = [...candidates, ...[...walk(CFG.DATA_ROOT)].filter(p=>/\.json$/i.test(p) && !candidates.includes(p))];
  for (const p of sorted){
    const books = tryParseWholeBibleJSON(p);
    if (books){
      console.log(`[DATA] Using whole-Bible JSON → ${path.relative(__dirname,p)}`);
      return books;
    }
  }

  // 2) Else, treat DATA_ROOT as per-book/per-chapter folders
  const folderBooks = tryLoadChaptersFromFolder(CFG.DATA_ROOT);
  if (folderBooks){
    console.log(`[DATA] Using per-chapter folders under → ${path.relative(__dirname, CFG.DATA_ROOT)}`);
    return folderBooks;
  }

  throw new Error("No usable DRB data found under Bible-DouayRheims-main/");
}

// ——— Renderers
const urlOf = e => `/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/`;

function page(e, prev, next){
  const ref = `${e.book} ${e.chapter}:${e.verse}`;
  const url = CFG.BASE_URL + urlOf(e);
  const share = `Douay-Rheims — ${ref}`;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(CFG.NAME)} — ${esc(ref)}</title>
<link rel="canonical" href="${esc(url)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(CFG.ADSENSE)}" crossorigin="anonymous"></script>
<style>${CSS}</style></head><body>
<div class="wrap">
  <div class="head">
    <a href="${esc(CFG.LOGO_DEST)}" aria-label="Back to Living Word Bibles"><img src="${esc(CFG.LOGO_URL)}" alt="Living Word Bibles"></a>
    <div><div class="super">The Holy Bible</div><div class="name">${esc(CFG.NAME)}</div></div>
  </div>
  <div class="body">
    <div class="nav">
      <a class="btn ${prev?'':'disabled'}" href="${prev||'#'}">◀ Prev</a>
      <a class="btn ${next?'':'disabled'}" href="${next||'#'}">Next ▶</a>
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
    <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(CFG.ADSENSE)}" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>
  <div class="foot">Copyright © 2025 | Living Word Bibles | All Rights Reserved | <a href="https://www.livingwordbibles.com">www.livingwordbibles.com</a></div>
</div>
</body></html>`;
}

function indexHtml(books){
  const items = books.map(b=>{
    const c1=b.chapters[0]?.n??1, v1=b.chapters[0]?.verses?.[0]?.n??1;
    return `<li><a href="/${CFG.ABBR}/${b.slug}/${c1}/${v1}/">${esc(b.name)}</a></li>`;
  }).join("\n");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Holy Bible: Douay-Rheims — Table of Contents</title>
<link rel="canonical" href="${esc(CFG.BASE_URL)}/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<style>${CSS}.toc{columns:2;gap:18px}@media(max-width:640px){.toc{columns:1}}</style>
</head><body>
<div class="wrap">
  <div class="head">
    <a href="${esc(CFG.LOGO_DEST)}"><img src="${esc(CFG.LOGO_URL)}" alt="Living Word Bibles"></a>
    <div><div class="super">The Holy Bible</div><div class="name">${esc(CFG.NAME)}</div></div>
  </div>
  <div class="body">
    <h1 style="margin:.25rem 0 1rem">Table of Contents</h1>
    <ul class="toc">${items}</ul>
  </div>
  <div class="foot">Copyright © 2025 | Living Word Bibles | All Rights Reserved | <a href="https://www.livingwordbibles.com">www.livingwordbibles.com</a></div>
</div>
</body></html>`;
}

// ——— Build helpers
function linearize(books){
  const out=[];
  for (const b of books)
    for (const c of b.chapters)
      for (const v of c.verses)
        out.push({ book:b.name, bookSlug:b.slug, chapter:c.n, verse:v.n, text:v.text });
  return out;
}
const urlOf = e => `/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/`;

function writeSitemaps(all){
  const chunk=45000, files=[];
  for (let i=0;i<all.length;i+=chunk){
    const slice=all.slice(i,i+chunk);
    const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...slice.map(e=>`<url><loc>${CFG.BASE_URL}${urlOf(e)}</loc></url>`), '</urlset>'].join("\n");
    const name=i===0?"sitemap.xml":`sitemap-${(i/chunk)+1|0}.xml`;
    write(path.join(CFG.DIST,name), xml); files.push(name);
  }
  const robots=["User-agent: *","Allow: /",...files.map(f=>`Sitemap: ${CFG.BASE_URL}/${f}`)].join("\n");
  write(path.join(CFG.DIST,"robots.txt"), robots);
}
function writeCNAME(){ if (CFG.CUSTOM_DOMAIN) write(path.join(CFG.DIST,"CNAME"), CFG.CUSTOM_DOMAIN+"\n"); }

(async function main(){
  try{
    console.log("[SCAN] Root data:", path.relative(__dirname, CFG.DATA_ROOT));
    const books = detectData();
    console.log(`[DATA] Books detected: ${books.length}`);

    // build
    fs.rmSync(CFG.DIST, { recursive:true, force:true });
    ensureDir(CFG.DIST);

    const flat = linearize(books);
    write(path.join(CFG.DIST,"index.html"), indexHtml(books));
    for (let i=0;i<flat.length;i++){
      const e=flat[i];
      const prev = i>0 ? urlOf(flat[i-1]) : null;
      const next = i+1<flat.length ? urlOf(flat[i+1]) : null;
      write(path.join(CFG.DIST, urlOf(e), "index.html"), page(e, prev, next));
    }
    writeSitemaps(flat);
    writeCNAME();
    write(path.join(CFG.DIST,".nojekyll"), "");

    console.log(`[DRB] Built ${flat.length} verse pages across ${books.length} books → dist/`);
  }catch(err){
    console.error("[DRB] Build failed:", err.message);
    process.exit(1);
  }
})();
