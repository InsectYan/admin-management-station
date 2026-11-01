const CLASS_FOLDERS = {
  CLIPVisionLoader: { clip_name: 'clip_vision' },
  CLIPVisionEncode: { clip_name: 'clip_vision' },
  UpscaleModelLoader: { model_name: 'upscale_models' },
  ControlNetLoader: { control_net_name: 'controlnet' },
  DiffControlNetLoader: { control_net_name: 'controlnet' },
  StyleModelLoader: { style_model_name: 'style_models' },
  GLIGENLoader: { gligen_name: 'gligen' },
  CheckpointLoader: { ckpt_name: 'checkpoints' },
  CheckpointLoaderSimple: { ckpt_name: 'checkpoints' },
  unCLIPCheckpointLoader: { ckpt_name: 'checkpoints' },
  VAELoader: { vae_name: 'vae' },
  UNETLoader: { unet_name: 'diffusion_models' },
  CLIPLoader: { clip_name: 'text_encoders' },
  DualCLIPLoader: { clip_name1: 'text_encoders', clip_name2: 'text_encoders' },
  LoraLoader: { lora_name: 'loras' },
  LoraLoaderModelOnly: { lora_name: 'loras' },
};

const KEY_FOLDERS = {
  ckpt_name: 'checkpoints',
  lora_name: 'loras',
  vae_name: 'vae',
  unet_name: 'diffusion_models',
  clip_name: 'text_encoders',
  clip_name1: 'text_encoders',
  clip_name2: 'text_encoders',
  control_net_name: 'controlnet',
  style_model_name: 'style_models',
  gligen_name: 'gligen',
  model_name: 'upscale_models',
};

export const FOLDER_LABEL = {
  checkpoints: 'Checkpoint',
  loras: 'LoRA',
  vae: 'VAE',
  diffusion_models: '扩散模型',
  unet: '扩散模型',
  text_encoders: '文本编码器',
  clip: '文本编码器',
  clip_vision: 'CLIP Vision',
  controlnet: 'ControlNet',
  upscale_models: '放大模型',
  style_models: 'Style 模型',
  gligen: 'GLIGEN',
  embeddings: 'Embedding',
  hypernetworks: 'Hypernetwork',
  audio_encoders: '音频编码器',
  model_patches: '模型补丁',
};

export function folderOf(classType, key) {
  return CLASS_FOLDERS[classType]?.[key] || KEY_FOLDERS[key] || '';
}

export function modelSlots(apiJson) {
  if (!apiJson || typeof apiJson !== 'object' || Array.isArray(apiJson)) return [];
  const slots = [];
  Object.entries(apiJson).forEach(([ id, node ]) => {
    const inputs = node?.inputs;
    if (!inputs || typeof inputs !== 'object') return;
    Object.entries(inputs).forEach(([ key, value ]) => {
      if (typeof value !== 'string') return;
      const folder = folderOf(node.class_type, key);
      if (!folder) return;
      slots.push({
        id,
        key,
        folder,
        classType: node.class_type || '',
        value,
      });
    });
  });
  return slots;
}
