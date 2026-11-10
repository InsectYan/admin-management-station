const PLAIN = {
  image: '文生图',
  video: '首尾帧',
  i2v: '图生视频',
  edit: '改图',
  t2v: '文生视频',
};

export function taskKindLabel(task) {
  if (!task) return '成片';
  const name = String(task.generation?.workflow_name || '');
  const refmod = task.kind === 'refmod' || /\[refmod\]/i.test(name);
  if (refmod) {
    if (name.includes('首尾帧')) return '首尾帧[RefMod]';
    if (name.includes('文生视频')) return '文生视频[RefMod]';
    if (name.includes('参考')) return '参考生视频[RefMod]';
    return '[RefMod]';
  }
  return PLAIN[task.kind] || task.kind || '任务';
}
