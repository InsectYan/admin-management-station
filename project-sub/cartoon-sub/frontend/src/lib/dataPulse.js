/** 与后端 app/lib/dataPulse.js 的种类一致。同一种连续成功合并成一次刷新。 */
export const DATA_KINDS = {
  script: 'script',
  storyboard: 'storyboard',
  profile: 'profile',
  asset: 'asset',
  prompt: 'prompt',
  workflow: 'workflow',
  video: 'video',
};

export function createPulseGate() {
  let seen = 0;
  let flying = false;
  const queue = [];
  async function drain(run) {
    if (flying) return;
    flying = true;
    try {
      while (queue.length) {
        const current = queue.shift();
        try {
          await run(current);
        } catch {
          // 页面自己提示读取失败，后面的子任务仍要刷新
        }
      }
    } finally {
      flying = false;
      if (queue.length) drain(run);
    }
  }
  return function take(seq, kind, run) {
    const next = Number(seq) || 0;
    if (!next || next <= seen || !DATA_KINDS[kind] || typeof run !== 'function') return;
    seen = next;
    if (queue[queue.length - 1] !== kind) queue.push(kind);
    drain(run);
  };
}
