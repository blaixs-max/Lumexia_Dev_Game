# Runtime vehicle models

Updated 7 September 2026. The race uses the two `*_runtime.glb` files below. The garage keeps `sport_car_compact.glb`. Original sources are preserved.

| Model | Triangles | Material primitives¹ | Bytes |
|---|---:|---:|---:|
| `ferrari.glb` — original | 358,788 | 51 | 1,681,572 |
| `ferrari_runtime.glb` — race | 188,982 | 16 | 3,531,264 |
| `sport_car.glb` — original | 237,482 | 11 | 18,320,948 |
| `sport_car_compact.glb` — previous race / current garage | 237,482 | 11 | 12,753,108 |
| `sport_car_runtime.glb` — race | 120,057 | 9 | 10,810,320 |

¹ Primitive counts describe the base model; shadow and other rendering passes can add draw calls. Ferrari triangles fall **47.33%**, player triangles **49.45%**. Ferrari's new file is larger than its original because its final compression retains full normal precision. These are model measurements, not measured FPS gains.

## Source identity and validation

The player runtime model derives from the same `C42` node / `Bits_Dup_2.001_Mesh.022` mesh as the current compact model. Its nine embedded images, material properties and material-to-image assignments match the current compact source. The decoder-independent intermediate was used to avoid accumulating position quantization. Ferrari keeps its original material groups; no interior parts were manually removed.

Both final GLBs were decoded locally. Attributes are finite, indices are within bounds, and world-space bounds remain close to their sources. Ferrari width/height/length: **2.25709 / 1.23591 / 4.53359** model units; player: **16.61362 / 9.11223 / 46.31494** model units. Runtime scene code normalizes these models to vehicle dimensions.

Simplification and position/UV encoding are lossy. Normal components are retained exactly during final Draco encoding; player image bytes are unchanged from the compact version. Existing source-normal issues remain. Full geometric checks found 26 tiny player faces becoming zero-area during 16-bit position encoding, and none for Ferrari. Visual acceptance, including silhouette and specular highlights, remains necessary.

## Reproduce

Use Node 24, the version used for this recipe. Install tools in a sibling working directory; this does not add game dependencies. Run the following from the repository root:

```bash
npm install --prefix ../model-tools --save-exact @gltf-transform/cli@4.5.0 @gltf-transform/core@4.5.0 @gltf-transform/functions@4.5.0 meshoptimizer@1.2.0
```

Ferrari uses the [reproducible script](../../tools/simplify-ferrari.mjs): exact-attribute welding, Meshopt `simplifyWithAttributes`, target ratio **0.15**, error **0.005**, normal weights **[1,1,1]**, and `Permissive`. It selects existing indices and compacts the original attribute streams; it does not recalculate normals, remove UVs or simplify across separate material groups. Its requested ratio is limited by geometry and appearance error.

```bash
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js copy public/models/ferrari.glb ../model-tools/ferrari_source_decoded.glb
node tools/simplify-ferrari.mjs ../model-tools ../model-tools/ferrari_source_decoded.glb ../model-tools/ferrari_attribute_005.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js join ../model-tools/ferrari_attribute_005.glb ../model-tools/ferrari_joined.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js draco ../model-tools/ferrari_joined.glb public/models/ferrari_runtime.glb --method sequential --encode-speed 5 --decode-speed 5 --quantize-position 16 --quantize-normal 0 --quantize-texcoord 14 --quantize-color 10 --quantize-generic 16
```

The player uses 1024² maximum textures, target ratio **0.25**, positional error **0.0005**, and locked topological borders. Joining compatible material primitives reduces draw calls.

```bash
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js resize public/models/sport_car.glb ../model-tools/sport_car_resized.glb --width 1024 --height 1024 --filter lanczos3
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js dedup ../model-tools/sport_car_resized.glb ../model-tools/sport_car_dedup.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js prune ../model-tools/sport_car_dedup.glb ../model-tools/sport_car_optimized.glb --keep-attributes true --keep-indices true --keep-leaves true --keep-solid-textures true
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js simplify ../model-tools/sport_car_optimized.glb ../model-tools/sport_car_simplified.glb --ratio 0.25 --error 0.0005 --lock-border true
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js join ../model-tools/sport_car_simplified.glb ../model-tools/sport_car_joined.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js dedup ../model-tools/sport_car_joined.glb ../model-tools/sport_car_final.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js draco ../model-tools/sport_car_final.glb public/models/sport_car_runtime.glb --method sequential --encode-speed 5 --decode-speed 5 --quantize-position 16 --quantize-normal 0 --quantize-texcoord 14 --quantize-color 10 --quantize-generic 16
```

Both files use the bundled decoder in `public/draco/`; its [Apache 2.0 license](../draco/LICENSE) is included. Existing source assets and their attribution remain unchanged. Intermediate GLBs belong in the tool directory and are not shipped.

