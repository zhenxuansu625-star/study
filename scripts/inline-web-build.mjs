// Turns the Expo web export (dist/) into one self-contained HTML file: dist/timetable.html.
// Handy for opening the prototype in any phone browser without a server.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const scriptTag = /<script src="\/?(_expo\/static\/js\/web\/[^"]+\.js)" defer><\/script>/;
const m = scriptTag.exec(html);
if (!m) throw new Error('Could not find the bundle <script> tag in dist/index.html');

const js = readFileSync(join(dist, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
html = html.replace(m[0], () => `<script>${js}</script>`);
html = html.replace(/<link rel="icon"[^>]*>/, '');
html = html.replace(
  '</head>',
  `<style>
  :root { color-scheme: light dark; }
  body { background: #F5F6F8; }
  @media (prefers-color-scheme: dark) { body { background: #0F1115; } }
</style>
</head>`,
);

writeFileSync(join(dist, 'timetable.html'), html);
console.log(`Wrote dist/timetable.html (${Math.round(html.length / 1024)} KB)`);
