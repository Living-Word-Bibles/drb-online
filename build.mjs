// DRB Online — Locked-to-root JSON build
// Expects: ./EntireBible-DR.json at repo root
// Output:  static verse-per-page site in /dist

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CFG = {
  NAME: "Douay-Rheims Bible (DRB)",
  ABBR: "drb",
  BASE_URL: "https://drb.livingwordbibles.com",
  LOGO_URL: "https://static1.squarespace.com/static/68d6b7d6d21f02432fd7397b/t/690209b3567af44aabfbdaca/1761741235124/LivingWordBibles01.png",
  LOGO_DEST: "https://www.livingwordbibles.com/read-the-bible-online/drb",
  ADSENSE: "ca-pub-5303063222439969",
  DIST: path.join(__dirname, "dist"),
  ROOT_JSON: path.join(__dirname, "EntireBible-DR.json"),
  CNAME: "drb.livingwordbibles.com"
};

// --- utils
const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
function write(p, s){ fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p, s); }

const CSS = `
:root { --fg:#222; --bg:#fff; --mut:#666; --edge:#eee; }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font-family:"EB Garamond",ui-serif,Georgia,serif}
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
@media (max-width:520px){.text{font-size:18px}}
`;

// --- JSON normalization (accepts a few common shapes)
function normalize(raw){
  const k = Object.keys(raw||{});
  if (raw && raw.Genesis) return fromObject(raw);
  if (k.length===1 && raw[k[0]] && raw[k[0]].Genesis) return fromObject(raw[k[0]]);
  if (raw && Array.isArray(raw.books)) return fromBooksArray(raw.books);
  if (k.length && Array.isArray(raw[k[0]])) return fromWholeArray(raw);
  throw new Error("Unrecognized JSON structure in EntireBible-DR.json");
}
function fromObject(obj){
  return Object.keys(obj).map(book=>{
    const chs = Object.keys(obj[book]||{}).map(n=>({
      n: Number(n),
      verses: (obj[book][n]||[]).map((t,i)=>({ n:i+1, text:String(t) }))
    })).sort((a,b)=>a.n-b.n);
    return { name: book, slug: slug(book), chapters: chs };
  });
}
function fromBooksArray(arr){
  return arr.map(b=>{
    const chs = (b.chapters||[]).map(c=>({
      n: Number(c.chapter||c.n||0),
      verses: (c.verses||[]).map(v=>({ n: Number(v.verse||v.n||0), text: String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    return { name: b.name || b.book || "", slug: slug(b.name||b.book||""), chapters: chs };
  });
}
function fromWholeArray(obj){
  return Object.keys(obj).map(book=>{
    const chs = (obj[book]||[]).map(c=>({
      n: Number(c.chapter||c.n||0),
      verses: (c.verses||[]).map(v=>({ n: Number(v.verse||v.n||0), text: String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    return { name: book, slug: slug(book), chapters: chs };
  });
}

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
    <a href="${esc(CFG.LOGO_DEST)}"><img src="${esc(CFG.LOGO_URL)}" alt="Living Word Bibles"></a>
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
  }).join("");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Holy Bible: Douay-Rheims — Table of Contents</title>
<link rel="canonical" href="${esc(CFG.BASE_URL)}/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<style>${CSS}.toc{columns:2;gap:18px}@media(max-width:640px){.toc{columns:1}}</style></head><body>
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

function linearize(books){
  const out=[];
  for (const b of books) for (const c of b.chapters) for (const v of c.verses)
    out.push({ book:b.name, bookSlug:b.slug, chapter:c.n, verse:v.n, text:v.text });
  return out;
}

(async function(){
  try {
    if (!fs.existsSync(CFG.ROOT_JSON)) {
      console.error("❌ Missing EntireBible-DR.json at repo root.");
      process.exit(1);
    }
    // read & strip BOM if any
    let rawText = fs.readFileSync(CFG.ROOT_JSON,"utf8").replace(/^\uFEFF/, "");
    let raw;
    try { raw = JSON.parse(rawText); }
    catch(e){ console.error("❌ JSON parse error:", e.message); process.exit(1); }

    let books;
    try { books = normalize(raw); }
    catch(e){ console.error("❌ JSON shape error:", e.message); process.exit(1); }

    fs.rmSync(CFG.DIST,{recursive:true,force:true});
    fs.mkdirSync(CFG.DIST,{recursive:true});

    const flat = linearize(books);
    write(path.join(CFG.DIST,"index.html"), indexHtml(books));
    for (let i=0;i<flat.length;i++){
      const e=flat[i];
      const prev = i>0 ? `/${CFG.ABBR}/${flat[i-1].bookSlug}/${flat[i-1].chapter}/${flat[i-1].verse}/` : null;
      const next = i+1<flat.length ? `/${CFG.ABBR}/${flat[i+1].bookSlug}/${flat[i+1].chapter}/${flat[i+1].verse}/` : null;
      write(path.join(CFG.DIST,`/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/index.html`), page(e, prev, next));
    }

    // SEO
    const chunk=45000, files=[];
    for (let i=0;i<flat.length;i+=chunk){
      const slice=flat.slice(i,i+chunk);
      const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...slice.map(e=>`<url><loc>${CFG.BASE_URL}/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/</loc></url>`), '</urlset>'].join("\n");
      const name=i===0?"sitemap.xml":`sitemap-${(i/chunk)+1|0}.xml`;
      write(path.join(CFG.DIST,name), xml); files.push(name);
    }
    write(path.join(CFG.DIST,"robots.txt"), ["User-agent: *","Allow: /",...files.map(f=>`Sitemap: ${CFG.BASE_URL}/${f}`)].join("\n"));

    // Pages domain + Jekyll guard
    write(path.join(CFG.DIST,"CNAME"), CFG.CNAME+"\n");
    write(path.join(CFG.DIST,".nojekyll"), "");

    console.log(`[DRB] Built ${flat.length} verse pages across ${books.length} books → dist/`);
  } catch (e){
    console.error("Build failed:", e.stack || e.message);
    process.exit(1);
  }
})();
