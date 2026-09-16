// 라이브 검증 — 백엔드 /ws 에 cloudstream 을 구독해 바이너리 프레임이 오는지 본다(라이다 노드가 떠 있는 보드 필요).
//   실행: node test/cloudstream_probe.mjs [ws://localhost:8090/ws] [/livox/lidar]
import WebSocket from 'ws';

const url = process.argv[2] || 'ws://localhost:8090/ws';
const topic = process.argv[3] || '/livox/lidar';
const ws = new WebSocket(url);
let frames = 0, pts = 0, mode = -1, sample = null;
ws.on('open', () => ws.send(JSON.stringify({ op: 'sub', id: 7, stream: 'cloudstream', params: { topic } })));
ws.on('message', (d, isBinary) => {
  if (!isBinary) { console.log('text:', d.toString().slice(0, 200)); return; }
  const id = d.readUInt32LE(0);
  if (id !== 7) return;
  frames += 1;
  mode = d.readUInt32LE(4);
  const n = (d.length - 8) / 16;
  pts += n;
  if (!sample) sample = [d.readFloatLE(8), d.readFloatLE(12), d.readFloatLE(16), d.readFloatLE(20)];
});
setTimeout(() => {
  ws.close();
  console.log(JSON.stringify({ topic, frames, avgPts: frames ? Math.round(pts / frames) : 0, mode, sample }));
  process.exit(frames > 0 ? 0 : 1);
}, 6000);
