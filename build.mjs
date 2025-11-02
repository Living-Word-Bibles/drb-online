// DRB Online — auto-detect build (root JSON or Douay-Rheims/ per-chapter)
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
  CNAME: "drb.livingwordbibles.com",
};

const esc = s => String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const ensure = p => fs.mkdirSync(p,{recursive:true});
const write = (p,s)=>{ ensure(path.dirname(p)); fs.writeFileSync(p,s); };

function* walk(dir){
  if (!fs.existsSync(dir)) return;
  const SKIP=new Set([".git",".github","node_modules","dist"]);
  const st=[dir]; while(st.length){ const d=st.pop();
    for (const e of fs.readdirSync(d,{withFileTypes:true})) {
      if (SKIP.has(e.name)) continue;
      const p=path.join(d,e.name);
      if (e.isDirectory()) st.push(p); else yield p;
    }
  }
}

// --- normalizers (accept whole-JSON or per-chapter)
function fromObject(obj){
  return Object.keys(obj).map(book=>{
    const chapters = Object.keys(obj[book]||{}).map(n=>({
      n:+n, verses:(obj[book][n]||[]).map((t,i)=>({ n:i+1, text:String(t) }))
    })).sort((a,b)=>a.n-b.n);
    return { name:book, slug:slug(book), chapters };
  });
}
function fromBooksArray(arr){
  return arr.map(b=>{
    const chapters=(b.chapters||[]).map(c=>({
      n:+(c.chapter||c.n||0),
      verses:(c.verses||[]).map(v=>({ n:+(v.verse||v.n||0), text:String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    return { name:b.name||b.book||"", slug:slug(b.name||b.book||""), chapters };
  });
}
function fromWholeArray(obj){
  return Object.keys(obj).map(book=>{
    const chapters=(obj[book]||[]).map(c=>({
      n:+(c.chapter||c.n||0),
      verses:(c.verses||[]).map(v=>({ n:+(v.verse||v.n||0), text:String(v.text||"") }))
    })).sort((a,b)=>a.n-b.n);
    return { name:book, slug:slug(book), chapters };
  });
}
function parseWholeJSON(p){
  try{
    const raw = JSON.parse(fs.readFileSync(p,"utf8").replace(/^\uFEFF/,""));
    const k=Object.keys(raw||{});
    if (raw.Genesis) return fromObject(raw);
    if (k.length===1 && raw[k[0]]?.Genesis) return fromObject(raw[k[0]]);
    if (Array.isArray(raw.books)) return fromBooksArray(raw.books);
    if (k.length && Array.isArray(raw[k[0]])) return fromWholeArray(raw);
  }catch{}
  return null;
}
function loadPerChapter(dir){
  if (!fs.existsSync(dir)) return null;
  const books=[];
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    if (!ent.isDirectory()) continue;
    const bookDir=path.join(dir,ent.name);
    const chapters=[];
    for (const f of fs.readdirSync(bookDir)) {
      const full=path.join(bookDir,f);
      if (!fs.statSync(full).isFile()) continue;
      const m=f.match(/(\d+)/); if (!m) continue;
      const ch=+m[1]; let verses=[];
      const raw=fs.readFileSync(full,"utf8");
      if (/\.json$/i.test(f)) {
        try{
          const js=JSON.parse(raw);
          if (Array.isArray(js)) verses=js.map((t,i)=>({n:i+1,text:String(t)}));
          else if (Array.isArray(js?.verses)) verses=js.verses.map(v=>({n:+(v.verse||v.n||0),text:String(v.text||"")}));
        }catch{}
      } else {
        verses = raw.split(/\r?\n/).filter(Boolean).map(line=>{
          const mm=line.match(/^(\d+)\s*[:.\-]?\s*(.+)$/);
          return mm ? { n:+mm[1], text:mm[2] } : null;
        }).filter(Boolean);
      }
      if (verses.length) chapters.push({ n:ch, verses });
    }
    if (chapters.length) books.push({ name:ent.name, slug:slug(ent.name), chapters:chapters.sort((a,b)=>a.n-b.n) });
  }
  return books.length ? books : null;
}

function detectData(){
  // Prefer root JSON if present
  if (fs.existsSync(path.join(__dirname,"EntireBible-DR.json"))) {
    const b=parseWholeJSON(path.join(__dirname,"EntireBible-DR.json"));
    if (b) { console.log("[DATA] Using root JSON: EntireBible-DR.json"); return b; }
  }
  // Else per-chapter under Douay-Rheims/
  if (fs.existsSync(path.join(__dirname,"Douay-Rheims"))) {
    const b=loadPerChapter(path.join(__dirname,"Douay-Rheims"));
    if (b) { console.log("[DATA] Using per-chapter under Douay-Rheims/"); return b; }
  }
  // Else brute-force any JSON under repo
  for (const p of walk(__dirname)) {
    if (!/\.json$/i.test(p)) continue;
    const b=parseWholeJSON(p);
    if (b) { console.log("[DATA] Using detected JSON:", path.relative(__dirname,p)); return b; }
  }
  throw new Error("No usable DRB data found (looked at root JSON, Douay-Rheims/, and repo-wide).");
}

// --- renderers
const urlOf = e => `/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/`;
const CSS = `:root{--fg:#222;--bg:#fff;--mut:#666;--edge:#eee}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:"EB Garamond",ui-serif,Georgia,serif}.wrap{max-width:780px;margin:0 auto;background:#fff;border:1px solid var(--edge);border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.06)}.head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--edge);background:#faf9f7;position:sticky;top:0;z-index:5}.head img{height:36px}.super{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7}.name{font-size:18px;margin:2px 0 0}.body{padding:16px}.nav{display:flex;justify-content:space-between;gap:8px;margin:12px 0 10px}.btn{background:#f2f0ec;border:1px solid #e6e3de;border-radius:999px;padding:8px 12px;text-decoration:none;color:#222}.btn.disabled{opacity:.5;pointer-events:none}.ref{font-variant:small-caps;letter-spacing:.02em;opacity:.7;margin:0 0 6px}.text{font-size:20px;line-height:1.6;background:#fff;border:1px solid var(--edge);border-radius:14px;padding:18px}.share{margin:14px 2px 6px}.share .label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin-bottom:6px}.share-row{display:flex;flex-wrap:wrap;gap:8px}.share-row a{background:#f2f0ec;border:1px solid #e6e3de;border-radius:999px;padding:8px 12px;font-size:14px;text-decoration:none;color:#222}.foot{text-align:center;padding:10px 14px;color:var(--mut);font-size:12px;border-top:1px solid var(--edge);background:#faf9f7}.foot a{color:inherit;text-decoration:underline}@media(max-width:520px){.text{font-size:18px}}`;
function page(e, prev, next){
  const ref=`${e.book} ${e.chapter}:${e.verse}`, url=CFG.BASE_URL+urlOf(e), share=`Douay-Rheims — ${ref}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(CFG.NAME)} — ${esc(ref)}</title><link rel="canonical" href="${esc(url)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(CFG.ADSENSE)}" crossorigin="anonymous"></script>
<style>${CSS}</style></head><body>
<div class="wrap"><div class="head">
<a href="${esc(CFG.LOGO_DEST)}"><img src="${esc(CFG.LOGO_URL)}" alt="Living Word Bibles"></a>
<div><div class="super">The Holy Bible</div><div class="name">${esc(CFG.NAME)}</div></div></div>
<div class="body">
  <div class="nav"><a class="btn ${prev?'':'disabled'}" href="${prev||'#'}">◀ Prev</a><a class="btn ${next?'':'disabled'}" href="${next||'#'}">Next ▶</a></div>
  <div class="ref">${esc(ref)}</div>
  <div class="text">${esc(e.text)}</div>
  <div class="share"><div class="label">Share</div><div class="share-row">
    <a target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a>
    <a target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(share)}">X</a>
    <a target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}">LinkedIn</a>
    <a href="mailto:?subject=${encodeURIComponent(share)}&body=${encodeURIComponent(url)}">Email</a>
  </div></div>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${esc(CFG.ADSENSE)}" data-ad-slot="auto" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</div>
<div class="foot">Copyright © 2025 | Living Word Bibles | All Rights Reserved | <a href="https://www.livingwordbibles.com">www.livingwordbibles.com</a></div>
</div></body></html>`;
}
function indexHtml(books){
  const items=books.map(b=>{ const c1=b.chapters[0]?.n??1, v1=b.chapters[0]?.verses?.[0]?.n??1;
    return `<li><a href="/${CFG.ABBR}/${b.slug}/${c1}/${v1}/">${esc(b.name)}</a></li>`; }).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Holy Bible: Douay-Rheims — Table of Contents</title>
<link rel="canonical" href="${esc(CFG.BASE_URL)}/">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..800;1,400..800&display=swap" rel="stylesheet">
<style>${CSS}.toc{columns:2;gap:18px}@media(max-width:640px){.toc{columns:1}}</style></head><body>
<div class="wrap"><div class="head"><a href="${esc(CFG.LOGO_DEST)}"><img src="${esc(CFG.LOGO_URL)}" alt="Living Word Bibles"></a>
<div><div class="super">The Holy Bible</div><div class="name">${esc(CFG.NAME)}</div></div></div>
<div class="body"><h1 style="margin:.25rem 0 1rem">Table of Contents</h1><ul class="toc">${items}</ul></div>
<div class="foot">Copyright © 2025 | Living Word Bibles | All Rights Reserved | <a href="https://www.livingwordbibles.com">www.livingwordbibles.com</a></div>
</div></body></html>`;
}

function linearize(books){ const out=[]; for(const b of books) for(const c of b.chapters) for(const v of c.verses)
  out.push({ book:b.name, bookSlug:b.slug, chapter:c.n, verse:v.n, text:v.text }); return out; }

(function(){
  try{
    // detect data
    let books=null;
    if (fs.existsSync(path.join(__dirname,"EntireBible-DR.json"))) {
      books = parseWholeJSON(path.join(__dirname,"EntireBible-DR.json"));
      if (books) console.log("[DATA] Using root JSON");
    }
    if (!books && fs.existsSync(path.join(__dirname,"Douay-Rheims"))) {
      books = loadPerChapter(path.join(__dirname,"Douay-Rheims"));
      if (books) console.log("[DATA] Using per-chapter under Douay-Rheims/");
    }
    if (!books){
      for (const p of walk(__dirname)) { const b=parseWholeJSON(p); if (b){ books=b; console.log("[DATA] Using detected:", path.relative(__dirname,p)); break; } }
    }
    if (!books) throw new Error("No usable DRB data found.");

    // build
    fs.rmSync(CFG.DIST,{recursive:true,force:true}); ensure(CFG.DIST);
    const flat=linearize(books);
    write(path.join(CFG.DIST,"index.html"), indexHtml(books));
    for (let i=0;i<flat.length;i++){
      const e=flat[i], prev=i>0?`/${CFG.ABBR}/${flat[i-1].bookSlug}/${flat[i-1].chapter}/${flat[i-1].verse}/`:null, next=i+1<flat.length?`/${CFG.ABBR}/${flat[i+1].bookSlug}/${flat[i+1].chapter}/${flat[i+1].verse}/`:null;
      write(path.join(CFG.DIST,`/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/index.html`), page(e,prev,next));
    }
    // SEO + Pages
    const chunk=45000, files=[];
    for (let i=0;i<flat.length;i+=chunk){
      const slice=flat.slice(i,i+chunk);
      const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...slice.map(e=>`<url><loc>${CFG.BASE_URL}/${CFG.ABBR}/${e.bookSlug}/${e.chapter}/${e.verse}/</loc></url>`), '</urlset>'].join("\n");
      const name=i===0?"sitemap.xml":`sitemap-${(i/chunk)+1|0}.xml`; write(path.join(CFG.DIST,name), xml); files.push(name);
    }
    write(path.join(CFG.DIST,"robots.txt"), ["User-agent: *","Allow: /",...files.map(f=>`Sitemap: ${CFG.BASE_URL}/${f}`)].join("\n"));
    write(path.join(CFG.DIST,"CNAME"), CFG.CNAME+"\n");
    write(path.join(CFG.DIST,".nojekyll"), "");
    console.log(`[DRB] Built ${flat.length} verse pages across ${books.length} books → dist/`);
  }catch(e){ console.error("[DRB] Build failed:", e.message); process.exit(1); }
})();
