// DRB Online (Alpha 1.0) — Living Word Bibles
// Static verse-per-page generator for drb.livingwordbibles.com


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ===== Config — adjust as needed
const CONFIG = {
VERSION_LABEL: 'DRB Online (Alpha 1.0)',
TRANSLATION_ABBR: 'drb',
TRANSLATION_NAME: 'Douay‑Rheims Bible',
SITE_TITLE: 'The Holy Bible: Douay‑Rheims',
BASE_URL: 'https://drb.livingwordbibles.com',
LOGO_URL: 'https://static1.squarespace.com/static/68d6b7d6d21f02432fd7397b/t/690209b3567af44aabfbdaca/1761741235124/LivingWordBibles01.png',
LOGO_DEST: 'https://www.livingwordbibles.com/read-the-bible-online/drb', // change if you want another landing page
SHARE_ORDER: ['facebook','instagram','x','linkedin','email','copy'],
FONT_FAMILY: 'EB Garamond',
// Paths
DATA_JSON: path.join(__dirname, 'data', 'drb_bible.json'),
DATA_BOOKS_DIR: path.join(__dirname, 'data', 'books'),
TEMPLATE_HTML: path.join(__dirname, 'src', 'template.html'),
STYLES_CSS: path.join(__dirname, 'src', 'styles.css'),
PUBLIC_DIR: path.join(__dirname, 'public'),
DIST_DIR: path.join(__dirname, 'dist'),
};


// ===== Helpers
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const readIfExists = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const htmlEscape = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));


function loadTemplate() {
const html = fs.readFileSync(CONFIG.TEMPLATE_HTML, 'utf8');
const css = fs.readFileSync(CONFIG.STYLES_CSS, 'utf8');
return { html, css };
}


function detectData() {
// Preferred: single JSON { Book: { "1": ["Verse1","Verse2",...], ... }, ... }
if (fs.existsSync(CONFIG.DATA_JSON)) {
const raw = JSON.parse(fs.readFileSync(CONFIG.DATA_JSON, 'utf8'));
return normalizeFromJson(raw);
}
// Fallback: data/books/<Book>/<chapter>.txt with lines like `1 In the beginning...`
if (fs.existsSync(CONFIG.DATA_BOOKS_DIR)) {
main();
