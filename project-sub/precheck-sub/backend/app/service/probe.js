'use strict';

const MODEL_FOLDERS = [
  'checkpoints', 'loras', 'vae', 'diffusion_models', 'unet',
  'text_encoders', 'clip', 'clip_vision', 'controlnet',
];

async function readJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    const error = new Error(`${url} -> ${response.status}`);
    error.status = 502;
    throw error;
  }
  return response.json();
}

function basename(file) {
  return String(file).split(/[/\\]/).pop();
}

class ProbeService extends require('egg').Service {
  async inspect(baseUrl, expectedVersion) {
    const base = String(baseUrl || '').replace(/\/$/, '');
    let online = false;
    let version = '';
    let devices = [];
    let ram = null;
    let nodeNames = [];
    let models = [];
    let error = '';
    try {
      const stats = await readJson(`${base}/system_stats`);
      online = true;
      version = stats?.system?.comfyui_version || '';
      devices = Array.isArray(stats?.devices) ? stats.devices : [];
      ram = stats?.system ? {
        ram_total: stats.system.ram_total,
        ram_free: stats.system.ram_free,
      } : null;
      const info = await readJson(`${base}/object_info`);
      nodeNames = Object.keys(info || {}).sort();
      const found = [];
      for (const folder of MODEL_FOLDERS) {
        try {
          const list = await readJson(`${base}/models/${folder}`);
          const names = Array.isArray(list) ? list : [];
          names.forEach(name => found.push({ folder, name: String(name) }));
        } catch {
          /* 该目录在这台 ComfyUI 上不存在 */
        }
      }
      models = found;
    } catch (err) {
      error = err.message || '无法连接 ComfyUI';
    }
    const versionOk = online && String(version).startsWith(String(expectedVersion || ''));
    return {
      online,
      version,
      version_ok: versionOk,
      expected_version: expectedVersion,
      devices,
      ram,
      node_count: nodeNames.length,
      node_names: nodeNames,
      models,
      error,
    };
  }

  diff(snapshot, requiredNodes, requiredModels, suggestedVramGb) {
    const installed = new Set(snapshot.node_names || []);
    const modelNames = snapshot.models || [];
    const missingNodes = (requiredNodes || []).filter(name => !installed.has(name));
    const missingModels = (requiredModels || []).filter(required => {
      const base = basename(required);
      return !modelNames.some(item => item.name === required || basename(item.name) === base);
    });
    const vramFree = snapshot.devices?.[0]?.vram_free;
    const vramTotal = snapshot.devices?.[0]?.vram_total;
    const freeGb = Number.isFinite(vramFree) ? vramFree / (1024 ** 3) : null;
    const lowVram = suggestedVramGb && freeGb != null && freeGb < suggestedVramGb;
    return {
      ok: snapshot.online && snapshot.version_ok && missingNodes.length === 0 && missingModels.length === 0 && !lowVram,
      missing_nodes: missingNodes,
      missing_models: missingModels.map(name => ({
        name,
        advice: '文件应在整合包模型目录中，并由源码版 extra_model_paths.yaml 挂入。不要把 custom_nodes 拷过来。',
      })),
      low_vram: Boolean(lowVram),
      vram_free_gb: freeGb == null ? null : Math.round(freeGb * 10) / 10,
      vram_total_gb: Number.isFinite(vramTotal) ? Math.round((vramTotal / (1024 ** 3)) * 10) / 10 : null,
      suggested_vram_gb: suggestedVramGb || null,
    };
  }
}

module.exports = ProbeService;
