'use strict';

function applyRefmod(apiJson, filenames) {
  const graph = JSON.parse(JSON.stringify(apiJson || {}));
  const found = Object.entries(graph).find(([, node]) => node?.class_type === 'MiniMaxH3ReferenceToVideo');
  if (!found) {
    const error = new Error('这份工作流不能挂 RefMod 包');
    error.status = 400;
    throw error;
  }
  const files = (filenames || []).filter(Boolean).slice(0, 9);
  if (!files.length) {
    const error = new Error('请选择至少一个包');
    error.status = 400;
    throw error;
  }
  const [ , node ] = found;
  let nextId = Object.keys(graph).reduce((max, id) => {
    const value = Number(id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  files.forEach((filename, index) => {
    nextId += 1;
    const loaderId = String(nextId);
    graph[loaderId] = { class_type: 'LoadImage', inputs: { image: filename } };
    node.inputs[`ref_images.ref_image_${index}`] = [ loaderId, 0 ];
  });
  return graph;
}

module.exports = { applyRefmod };
