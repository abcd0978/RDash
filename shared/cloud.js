// 클라우드 프레임 빌더 — rosbridge JSON 메시지(PointCloud2 · livox_ros_driver2/CustomMsg)를 WS 바이너리 페이로드로.
// 페이로드: [uint32 LE mode][float32 x,y,z,c ...]  mode 0=xyz · 1=intensity · 2=rgb (프런트 lib/stream.js decodeCloud 가 읽는 규격).
// 타입 문자열은 안 받는다 — 이 환경엔 /rosapi/topic_type 이 없어 늘 '' 라, 메시지 모양(points[] vs fields[])으로 가린다.
const MAXN = Number(process.env.RDASH_CLOUD_MAXN) || 30000;
// PointCloud2 datatype 코드 → LE 리더
const RD = {
  1: (b, o) => b.readInt8(o), 2: (b, o) => b.readUInt8(o), 3: (b, o) => b.readInt16LE(o), 4: (b, o) => b.readUInt16LE(o),
  5: (b, o) => b.readInt32LE(o), 6: (b, o) => b.readUInt32LE(o), 7: (b, o) => b.readFloatLE(o), 8: (b, o) => b.readDoubleLE(o),
};

// CustomMsg: points[{x,y,z,reflectivity,…}] → c = reflectivity
function fromCustom(msg) {
  const out = [];
  for (const p of msg.points) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) out.push(p.x, p.y, p.z, p.reflectivity || 0);
  }
  return { mode: 1, out };
}

// PointCloud2: fields 오프셋으로 x,y,z 읽기. c 는 rgb 우선(packed r*65536+g*256+b), 없으면 intensity, 없으면 0.
function fromPointCloud2(msg) {
  const f = {};
  for (const x of msg.fields) f[x.name] = x;
  if (!f.x || !f.y || !f.z) return null;
  const rx = RD[f.x.datatype], ry = RD[f.y.datatype], rz = RD[f.z.datatype];
  if (!rx || !ry || !rz) return null;
  const n = (msg.width || 0) * (msg.height || 0), ps = msg.point_step;
  const buf = typeof msg.data === 'string' ? Buffer.from(msg.data, 'base64') : Buffer.from(msg.data || []);   // rosbridge 는 uint8[] 을 base64 로
  if (!ps || buf.length < n * ps) return null;
  const rgb = f.rgb || f.rgba, rc = f.intensity && RD[f.intensity.datatype];
  const mode = rgb ? 2 : rc ? 1 : 0;
  const out = [];
  for (let i = 0; i < n; i++) {
    const b = i * ps;
    const x = rx(buf, b + f.x.offset), y = ry(buf, b + f.y.offset), z = rz(buf, b + f.z.offset);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    let c = 0;
    if (mode === 2) { const u = buf.readUInt32LE(b + rgb.offset); c = ((u >>> 16) & 255) * 65536 + ((u >>> 8) & 255) * 256 + (u & 255); }
    else if (mode === 1) c = rc(buf, b + f.intensity.offset);
    out.push(x, y, z, c);
  }
  return { mode, out };
}

export function cloudFrame(msg, maxN = MAXN) {
  if (!msg) return null;
  const r = Array.isArray(msg.points) ? fromCustom(msg) : Array.isArray(msg.fields) ? fromPointCloud2(msg) : null;
  if (!r) return null;
  let { out } = r;
  let n = out.length / 4;
  if (n > maxN) {   // 균등 솎기
    const o2 = new Array(maxN * 4);
    for (let k = 0; k < maxN; k++) {
      const i = Math.round(k * (n - 1) / (maxN - 1)) * 4;
      o2[k * 4] = out[i]; o2[k * 4 + 1] = out[i + 1]; o2[k * 4 + 2] = out[i + 2]; o2[k * 4 + 3] = out[i + 3];
    }
    out = o2; n = maxN;
  }
  const buf = Buffer.allocUnsafe(4 + n * 16);
  buf.writeUInt32LE(r.mode, 0);
  for (let i = 0; i < out.length; i++) buf.writeFloatLE(out[i], 4 + i * 4);
  return buf;
}
