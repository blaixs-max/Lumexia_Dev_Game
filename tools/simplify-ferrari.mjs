/**
 * Reproduce the approved Ferrari runtime simplification.
 * Dependencies stay in an external tool directory, outside game dependencies.
 *
 * node tools/simplify-ferrari.mjs <tool-directory> <decoded-input.glb> <output.glb>
 * See public/models/RUNTIME_MODELS.md for pinned installation and compression.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [toolDirectory, input, output] = process.argv.slice(2);
if (!toolDirectory || !input || !output) {
  throw new Error('Usage: node tools/simplify-ferrari.mjs <tool-directory> <decoded-input.glb> <output.glb>');
}
if (resolve(input) === resolve(output)) {
  throw new Error('Input and output must differ so the source asset is preserved.');
}

const toolRequire = createRequire(resolve(toolDirectory, 'package.json'));
const { NodeIO } = toolRequire('@gltf-transform/core');
const { weld, compactPrimitive } = toolRequire('@gltf-transform/functions');
const { MeshoptSimplifier } = await import(pathToFileURL(toolRequire.resolve('meshoptimizer')).href);

const io = new NodeIO();
const document = await io.read(input);
const root = document.getRoot();
// This recipe is specific to the untextured, static Ferrari source. UV streams
// remain intact, but the error metric weights normals rather than unused UVs.
if (root.listTextures().length || root.listAnimations().length || root.listSkins().length) {
  throw new Error('This recipe expects the static, untextured Ferrari source.');
}
await MeshoptSimplifier.ready;
await document.transform(weld());

const ratio = 0.15;
const error = 0.005;
let beforeTriangles = 0;
let afterTriangles = 0;
let maximumReportedError = 0;
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')?.getArray();
    const normal = primitive.getAttribute('NORMAL')?.getArray();
    const oldIndices = primitive.getIndices();
    if (!(position instanceof Float32Array) || !(normal instanceof Float32Array) || !oldIndices) {
      throw new Error('Expected indexed Float32 POSITION/NORMAL attributes; decode the input with the CLI first.');
    }
    const indices = new Uint32Array(oldIndices.getArray());
    const target = Math.max(3, Math.floor(indices.length * ratio / 3) * 3);
    const [result, measuredError] = MeshoptSimplifier.simplifyWithAttributes(
      indices, position, 3, normal, 3, [1, 1, 1], null,
      target, error, ['Permissive'],
    );
    // The simplifier returns only indices. Every retained POSITION, NORMAL
    // and UV value comes from the original vertex streams.
    primitive.setIndices(document.createAccessor()
      .setType('SCALAR')
      .setBuffer(oldIndices.getBuffer())
      .setArray(result));
    if (oldIndices.listParents().length === 1) oldIndices.dispose();
    compactPrimitive(primitive);
    beforeTriangles += indices.length / 3;
    afterTriangles += result.length / 3;
    maximumReportedError = Math.max(maximumReportedError, measuredError);
  }
}
await io.write(output, document);
console.log(JSON.stringify({
  file: output,
  bytes: fs.statSync(output).size,
  beforeTriangles,
  afterTriangles,
  ratio,
  error,
  normalWeights: [1, 1, 1],
  flags: ['Permissive'],
  maximumReportedError,
}));

