'use strict';

const MODEL_FOLDERS = [
  'checkpoints', 'loras', 'vae', 'diffusion_models', 'unet',
  'text_encoders', 'clip', 'clip_vision', 'controlnet',
  'embeddings', 'upscale_models', 'hypernetworks', 'style_models',
  'gligen', 'configs', 'vae_approx', 'audio_encoders', 'model_patches',
];

function allowedFolder(folder) {
  return MODEL_FOLDERS.includes(String(folder || ''));
}

function sortNodes(nodes) {
  nodes.sort((a, b) => {
    const folderOrder = (a.children ? 0 : 1) - (b.children ? 0 : 1);
    if (folderOrder) return folderOrder;
    return a.label.localeCompare(b.label, 'en');
  });
  nodes.forEach(node => {
    if (node.children) sortNodes(node.children);
  });
}

function modelTree(names) {
  const root = [];
  const index = new Map();
  (names || []).forEach(raw => {
    const name = String(raw || '');
    const parts = name.split(/[/\\]/).filter(Boolean);
    if (!parts.length) return;
    let nodes = root;
    const acc = [];
    parts.forEach((part, indexInPath) => {
      acc.push(part);
      const key = acc.join('/');
      const leaf = indexInPath === parts.length - 1;
      let node = index.get(key);
      if (!node) {
        node = { label: part, value: leaf ? name : key };
        if (!leaf) node.children = [];
        index.set(key, node);
        nodes.push(node);
      } else if (!leaf && !node.children) {
        node.children = [];
      }
      if (!leaf) nodes = node.children;
    });
  });
  sortNodes(root);
  return root;
}

module.exports = {
  MODEL_FOLDERS,
  allowedFolder,
  modelTree,
};
