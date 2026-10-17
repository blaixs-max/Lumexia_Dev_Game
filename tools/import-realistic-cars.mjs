// Reproduce the local, attributed cars without changing the mirror's geometry or textures.
// node tools/import-realistic-cars.mjs [temporary-download-directory]
// Sources are downloaded to OS temporary storage before entering public/.
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectCar } from './check-realistic-cars.mjs';

const commit = '0a56de377f02f2574d781f6920fed08d6423ec2f';
const mirror = `https://raw.githubusercontent.com/pedrosoandre/carros/${commit}/assets/`;
const licenseUrl = 'https://creativecommons.org/licenses/by/4.0/';
const sources = [
  { id: 'rally', title: 'Subaru Impreza WRX STi 2004 Custom', author: 'MAC ULT ARTS', authorUrl: 'https://sketchfab.com/MACULTARTS',
    sourceUrl: 'https://sketchfab.com/3d-models/08296bc950364621b6174a3078bb19e0', sourceFile: 'subaru-impreza.glb',
    sourceSha256: 'de862ee6809ce35a1adadbf8350be239b89561e35f0f0f67b963bc5c3c236cab' },
  { id: 'street', title: '[FREE] BMW M3 E30', author: 'Martin Trafas', authorUrl: 'https://sketchfab.com/TinoD2',
    sourceUrl: 'https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422', sourceFile: 'bmw-m3-e30.glb',
    sourceSha256: '35cad98e89e6f1e54ccd238a3df049d29f20ecec3fc0aa2a85e0ad6c2663d330' },
  { id: 'formula', title: 'Nissan Z Proto', author: 'Lexyc16', authorUrl: 'https://sketchfab.com/Lexyc16',
    sourceUrl: 'https://sketchfab.com/3d-models/nissan-z-proto-db9a5f7ae9d84a0fb01cac96afe3e69c', sourceFile: 'nissan-proto.glb',
    sourceSha256: '4d93ca9750f4a50852f29628deeca691a5e7fed48dacaf7ddfa4b814642574f3' },
];
const destination = fileURLToPath(new URL('../public/models/realistic/', import.meta.url));
const temporary = process.argv[2] ? path.resolve(process.argv[2]) : await mkdtemp(path.join(tmpdir(), 'lumexia-realistic-cars-'));
await mkdir(temporary, { recursive: true });
await mkdir(destination, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pad = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)]);
const records = [];
for (const source of sources) {
  const cached = path.join(temporary, source.sourceFile);
  let input;
  try { input = await readFile(cached); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(mirror + source.sourceFile);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${source.sourceFile}`);
    input = Buffer.from(await response.arrayBuffer());
    await writeFile(cached, input);
  }
  if (hash(input) !== source.sourceSha256) throw new Error(`Source checksum mismatch: ${source.sourceFile}`);
  const originalMeasurements = await inspectCar(input);
  const length = input.readUInt32LE(12);
  const document = JSON.parse(input.subarray(20, 20 + length));
  // All three originals are Y-up and front +Z. A parent transform changes only
  // orientation; normal maps, winding, detail, original hierarchy and paint stay intact.
  for (const scene of document.scenes) {
    const children = scene.nodes || [];
    scene.nodes = [document.nodes.length];
    document.nodes.push({ name: 'Lumexia_front_minus_Z', rotation: [0, 1, 0, 0], children });
  }
  const json = pad(Buffer.from(JSON.stringify(document)), 0x20);
  const binary = pad(input.subarray(28 + length));
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([header, json, binaryHeader, binary]);
  const { meshes: _meshes, nodes: _nodes, sourceBounds: outputBounds, ...measurements } = await inspectCar(output);
  const record = { ...source, license: 'CC-BY-4.0', licenseUrl, mirrorUrl: mirror + source.sourceFile,
    mirrorCommit: commit, sourceBytes: input.length, file: `${source.id}.glb`, bytes: output.length, sha256: hash(output),
    modifications: 'The carros mirror had already simplified/compressed the Sketchfab models before download. Lumexia added only a 180-degree Y scene parent to face game front -Z; the downloaded mirror geometry, vertex normals, materials, paint, embedded images and meshopt compression are unchanged.',
    sourceBounds: originalMeasurements.sourceBounds, outputBounds, ...measurements };
  await writeFile(path.join(destination, record.file), output);
  records.push(record);
}
await writeFile(path.join(destination, 'source-record.json'), JSON.stringify({
  retrieved: '2026-10-17', license: 'CC-BY-4.0', licenseUrl,
  mirrorRepository: 'https://github.com/pedrosoandre/carros', mirrorCommit: commit,
  sourceCatalog: `https://raw.githubusercontent.com/pedrosoandre/carros/${commit}/cars.json`,
  sourceOrientation: 'Y-up, front +Z', outputOrientation: 'Y-up, front -Z',
  runtimeResources: 'All geometry, materials and image textures are embedded in local GLB files. No external resource requests are needed.',
  reproduction: 'node tools/import-realistic-cars.mjs [temporary-download-directory]; node tools/check-realistic-cars.mjs',
  models: records,
}, null, 2) + '\n');
const credits = records.map(record => `- **${record.title}** by [${record.author}](${record.authorUrl}). [Original model](${record.sourceUrl}); [fixed source mirror](${record.mirrorUrl}). Licensed under [Creative Commons Attribution 4.0 International](${licenseUrl}).\n  File: \`${record.file}\`. Changes: ${record.modifications}`).join('\n\n');
await writeFile(path.join(destination, 'CREDITS.md'), `# Vehicle model credits\n\n${credits}\n\nThese models are used under CC BY 4.0. Model titles identify the represented vehicles. The downloaded carros mirror is a simplified/compressed derivative of the linked Sketchfab originals. Its source hashes and the final Lumexia hashes are recorded in [source-record.json](source-record.json).\n`);
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const cards = records.map(record => `<article><h2>${escape(record.title)}</h2><p>Model: <a href="${record.authorUrl}">${escape(record.author)}</a></p><p><a href="${record.sourceUrl}">Orijinal model</a> · <a href="${record.mirrorUrl}">Sabit kaynak kopyası</a> · <a href="${licenseUrl}">CC BY 4.0 lisansı</a></p><p class="changes">Kaynak kopyası, carros tarafından önceden sadeleştirilip sıkıştırılmıştır. Lumexia yalnızca oyundaki yönle uyum için sahneye 180° Y dönüşü ekledi; indirilen kopyanın geometrisi, yüzey normalleri, malzemeleri, renkleri ve gömülü dokuları korunmuştur.</p></article>`).join('\n');
await writeFile(path.join(destination, 'credits.html'), `<!doctype html>
<html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Araç model kaynakları · Lumexia</title><style>
*{box-sizing:border-box}body{margin:0;background:#0c1317;color:#edf2f4;font-family:system-ui,sans-serif;line-height:1.65}main{max-width:850px;margin:auto;padding:48px 24px}h1{font-size:clamp(28px,5vw,40px);line-height:1.2}h2{font-size:21px;margin:0 0 14px}p{margin:10px 0}a{color:#ddf88b;text-underline-offset:4px}a:hover{color:#fff}.eyebrow{color:#ddf88b;font-size:12px;font-weight:700;letter-spacing:.18em}article{padding:25px;margin:22px 0;border:1px solid #324047;border-radius:14px;background:#131e23}.intro,.changes,footer{color:#b6c6cd}.changes{font-size:14px}footer{font-size:13px;margin-top:30px}
</style></head><body><main><p class="eyebrow">LUMEXIA · MODEL KAYNAKLARI</p><h1>Araçları tasarlayanlar</h1><p class="intro">Bu üç araç modeli, üreticilerinin Creative Commons Attribution 4.0 International lisansı altında kullanılmıştır. Kaynaklar, yaratıcılar ve yapılan değişiklikler aşağıda yer alır.</p>${cards}<footer><p><a href="source-record.json">Kaynak ve dosya doğrulama kaydı</a> · <a href="CREDITS.md">Atıflar</a> · <a href="/">Oyuna dön</a></p></footer></main></body></html>\n`);
console.log(JSON.stringify(records.map(({ id, title, bytes, triangles, materialPrimitives, sha256 }) => ({ id, title, bytes, triangles, materialPrimitives, sha256 })), null, 2));
