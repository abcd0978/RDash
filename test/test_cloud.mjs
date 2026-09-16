// cloudFrame — rosbridge JSON(PointCloud2 · livox CustomMsg) → [mode][xyzc float32] 프레임. 깨지면 3D 패널이 빈 화면.
//   실행: node test/test_cloud.mjs
import assert from 'assert';
import { cloudFrame } from '../shared/cloud.js';

const parse = (b) => ({ mode: b.readUInt32LE(0), v: Array.from({ length: (b.length - 4) / 4 }, (_, i) => b.readFloatLE(4 + i * 4)) });

// CustomMsg: reflectivity 가 c 채널, 비유한 점은 버림.
let r = parse(cloudFrame({ point_num: 3, points: [
  { offset_time: 0, x: 1, y: 2, z: 3, reflectivity: 40, tag: 0, line: 0 },
  { offset_time: 1, x: NaN, y: 0, z: 0, reflectivity: 1, tag: 0, line: 0 },
  { offset_time: 2, x: -1.5, y: 0.5, z: 0, reflectivity: 0, tag: 0, line: 0 },
] }));
assert.strictEqual(r.mode, 1);
assert.deepStrictEqual(r.v, [1, 2, 3, 40, -1.5, 0.5, 0, 0]);

// PointCloud2(x,y,z,intensity float32, base64 data): 2점.
const pc = (pts, fields, ps) => {
  const buf = Buffer.alloc(pts.length * ps);
  pts.forEach((p, i) => p.forEach(([off, val, kind], _) => (kind === 'u32' ? buf.writeUInt32LE(val, i * ps + off) : buf.writeFloatLE(val, i * ps + off))));
  return { height: 1, width: pts.length, fields, point_step: ps, data: buf.toString('base64') };
};
const F = (name, offset, datatype = 7) => ({ name, offset, datatype, count: 1 });
r = parse(cloudFrame(pc([[[0, 1], [4, 2], [8, 3], [12, 9]], [[0, 4], [4, 5], [8, 6], [12, 10]]], [F('x', 0), F('y', 4), F('z', 8), F('intensity', 12)], 16)));
assert.strictEqual(r.mode, 1);
assert.deepStrictEqual(r.v, [1, 2, 3, 9, 4, 5, 6, 10]);

// PointCloud2 rgb(packed) → mode 2, c = r*65536+g*256+b.
r = parse(cloudFrame(pc([[[0, 1], [4, 1], [8, 1], [16, 0x00102030, 'u32']]], [F('x', 0), F('y', 4), F('z', 8), F('rgb', 16)], 32)));
assert.strictEqual(r.mode, 2);
assert.deepStrictEqual(r.v, [1, 1, 1, 0x10 * 65536 + 0x20 * 256 + 0x30]);

// x,y,z 없는 PointCloud2 · 모양이 둘 다 아닌 메시지 → null.
assert.strictEqual(cloudFrame({ fields: [F('a', 0)], width: 0, height: 0, point_step: 4, data: '' }), null);
assert.strictEqual(cloudFrame({ header: {} }), null);

// maxN 초과 → 균등 솎기(첫 점·끝 점 보존).
const many = { points: Array.from({ length: 11 }, (_, i) => ({ x: i, y: 0, z: 0, reflectivity: 0 })) };
r = parse(cloudFrame(many, 3));
assert.deepStrictEqual(r.v.filter((_, i) => i % 4 === 0), [0, 5, 10]);

console.log('test_cloud OK');
