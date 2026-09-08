import { createWriteStream, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const srcDir = join(root, "public", "game");
const packedDir = join(root, "packed");
const CHUNK = 380_000;

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile()) out.push(p);
  }
  return out;
}

function tarHeader(name, size) {
  const buf = Buffer.alloc(512);
  const path = name.replaceAll("\\", "/");
  buf.write(path.slice(0, 99), 0, "utf8");
  buf.write("0000644\0", 100, "utf8");
  buf.write("0000000\0", 108, "utf8");
  buf.write("0000000\0", 116, "utf8");
  buf.write(size.toString(8).padStart(11, "0") + "\0", 124, "utf8");
  buf.write("00000000000\0", 136, "utf8");
  buf.write("0", 156, "utf8");
  buf.write("ustar\0", 257, "utf8");
  buf.write("00", 263, "utf8");
  buf.fill(0x20, 148, 156);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += buf[i];
  buf.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "utf8");
  return buf;
}

const files = walk(srcDir);
if (!files.length) {
  console.error("no files in public/game");
  process.exit(1);
}

const parts = [];
for (const file of files) {
  const data = readFileSync(file);
  const name = relative(root, file).split(sep).join("/");
  parts.push(tarHeader(name, data.length));
  parts.push(data);
  const pad = (512 - (data.length % 512)) % 512;
  if (pad) parts.push(Buffer.alloc(pad));
}
parts.push(Buffer.alloc(1024));
const tar = Buffer.concat(parts);
const gz = gzipSync(tar, { level: 9 });
const b64 = gz.toString("base64");

mkdirSync(packedDir, { recursive: true });
let n = 0;
for (let i = 0; i < b64.length; i += CHUNK) {
  const chunk = b64.slice(i, i + CHUNK);
  const dest = join(packedDir, `assets.b64.${String(n).padStart(2, "0")}`);
  writeFileSync(dest, chunk + "\n");
  n += 1;
}

const manifest = {
  files: files.length,
  tarBytes: tar.length,
  gzipBytes: gz.length,
  parts: n,
  generatedAt: new Date().toISOString(),
};
writeFileSync(join(packedDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`packed ${files.length} files into ${n} part(s) (${gz.length} gzip bytes)`);
