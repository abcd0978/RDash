// /rosout 로그 스트림 → [{level, name, msg}] 링버퍼. 로그뷰가 열렸을 때만 구독(active=true).
// 이제 백엔드의 rosout 스트림을 구독한다. 페이로드는 JSON 문자열이라 파싱하면 로그 블록 텍스트가 나온다.
import { useState, useEffect, useRef } from '../react.js';
import { openStream } from '../lib/api.js';

const ROS1_LOG_LEVEL = { 1: 10, 2: 20, 4: 30, 8: 40, 16: 50 };

export function useRosout(active, ver) {
  const [lines, setLines] = useState([]);
  const bufRef = useRef([]);
  useEffect(() => {
    if (!active) return undefined;
    let alive = true, pending = false;
    const flush = () => { pending = false; if (alive) setLines(bufRef.current.slice(-800)); };
    const unsub = openStream('rosout', {}, (d) => {
      let block; try { block = JSON.parse(d); } catch { return; }
      const lvl = /(?:^|\n)\s*level:\s*(\d+)/.exec(block);
      const nm = /(?:^|\n)\s*name:\s*["']?([^\n"']+)/.exec(block);
      const ms = /(?:^|\n)\s*msg:\s*["']?(.*)/.exec(block);
      const n = lvl ? +lvl[1] : 0;
      let level = ROS1_LOG_LEVEL[n] || 0;   // ROS1 Log 레벨(1/2/4/8/16) → ROS2 단위
      const is_ros2 = (ver === '2');
      if (is_ros2) {
        level = n;
      }
      bufRef.current.push({ level, name: nm ? nm[1].trim() : '?', msg: ms ? ms[1].replace(/["']\s*$/, '').trim() : '' });
      if (bufRef.current.length > 1200) bufRef.current.shift();
      if (!pending) { pending = true; setTimeout(flush, 120); }   // 리렌더 폭주 방지
    });
    return () => { alive = false; unsub(); };
  }, [active, ver]);
  return lines;
}