import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const packedDir = join(root, "packed");
if (!existsSync(packedDir)) process.exit(0);
const parts = [];
for (let i = 0; i < 64; i++) {
  const p = join(packedDir, `assets.b64.${String(i).padStart(2, "0")}`);
  if (!existsSync(p)) break;
  parts.push(readFileSync(p, "utf8").trim());
}
if (!parts.length) process.exit(0);
const buf = Buffer.from(parts.join(""), "base64");
const tar = gunzipSync(buf);

function readOctal(s) {
  return parseInt(s.replace(/\0/g, "").trim() || "0", 8);
}

let offset = 0;
let count = 0;
while (offset + 512 <= tar.length) {
  const header = tar.subarray(offset, offset + 512);
  const name = header.subarray(0, 100).toString("utf8").replace(/\0/g, "").trim();
  if (!name) break;
  const size = readOctal(header.subarray(124, 136).toString("utf8"));
  const type = String.fromCharCode(header[156] || 48);
  offset += 512;
  const data = tar.subarray(offset, offset + size);
  offset += Math.ceil(size / 512) * 512;
  if (type === "0" || type === "\0" || type === "") {
    const dest = join(root, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
    count += 1;
  }
}
console.log(`unpacked ${count} game assets`);
