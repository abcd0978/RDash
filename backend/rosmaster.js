// ROS1 마스터·노드 XML-RPC 최소 클라이언트 — 백엔드 호스트에 ROS 가 없어도 rosnode kill 을 대신한다
import http from 'node:http';
import { be } from './ros.js';

const kMasterPort = 11311;
const kCallerId = '/rdash';
const kTimeoutMs = 3000;

// 마스터 주소는 rosbridge 와 같은 호스트로 본다 (ROS_MASTER_URI 로 덮어쓸 수 있다)
function masterUrl() {
  return process.env.ROS_MASTER_URI || `http://${new URL(be.url).hostname}:${kMasterPort}/`;
}

// 문자열 인자만 보내고 응답의 <string> 값들만 돌려준다
function xmlrpcCall(url, method, params) {
  const body = `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>`
    + params.map((p) => `<param><value><string>${p}</string></value></param>`).join('')
    + '</params></methodCall>';
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'text/xml', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let out = '';
      res.on('data', (d) => { out += d; });
      res.on('end', () => resolve([...out.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1])));
    });
    req.on('error', reject);
    req.setTimeout(kTimeoutMs, () => req.destroy(new Error('timeout')));
    req.end(body);
  });
}

// rosnode kill 과 같은 순서: 마스터 lookupNode → 노드의 shutdown
export async function killNodeRpc(name) {
  const strs = await xmlrpcCall(masterUrl(), 'lookupNode', [kCallerId, name]);
  const uri = strs.find((s) => s.startsWith('http'));
  if (!uri) {
    return `no such node: ${name}`;
  }
  await xmlrpcCall(uri, 'shutdown', [kCallerId, 'rdash kill']);
  return `killed ${name} (${uri})`;
}
