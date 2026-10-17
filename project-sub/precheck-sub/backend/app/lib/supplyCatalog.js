'use strict';

const PACK_MODELS = 'E:\\AI Tools\\projects\\private-project\\ComfyUI.V7\\0.11.1\\ComfyUI\\models';
const PLUGIN_ROOT = 'E:\\AI Tools\\projects\\private-project\\ComfyUI.V7\\ComfyUI\\custom_nodes';

const UI_ONLY = new Set([ 'Note', 'MarkdownNote', 'Reroute', 'PrimitiveNode', 'GetNode', 'SetNode' ]);

const PLUGINS = [
  {
    id: 'wan-video-wrapper',
    label: 'Wan 视频包装节点',
    nodes: [ 'WanVideoModelLoader', 'WanVideoSampler', 'WanVideoDecode', 'WanVideoVAELoader', 'WanVideoTextEncode', 'WanVideoBlockSwap', 'WanVideoLoraSelect', 'WanVideoTorchCompileSettings', 'LoadWanVideoT5TextEncoder', 'WanVideoNAG', 'WanMoeKSampler' ],
    options: [
      pluginOption('kijai', 'ComfyUI-WanVideoWrapper', 'https://github.com/kijai/ComfyUI-WanVideoWrapper'),
    ],
  },
  {
    id: 'vhs',
    label: '视频加载与合成',
    nodes: [ 'VHS_VideoCombine', 'VHS_LoadVideo', 'VHS_SelectFilename' ],
    options: [
      pluginOption('vhs', 'ComfyUI-VideoHelperSuite', 'https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite'),
    ],
  },
  {
    id: 'kjnodes',
    label: 'KJ 图像与加速节点',
    nodes: [ 'ImageResizeKJ', 'ImageResizeKJv2', 'PathchSageAttentionKJ' ],
    options: [
      pluginOption('kjnodes', 'ComfyUI-KJNodes', 'https://github.com/kijai/ComfyUI-KJNodes'),
    ],
  },
  {
    id: 'rgthree',
    label: 'rgthree 界面节点',
    nodes: [ 'Image Comparer (rgthree)', 'Fast Groups Bypasser (rgthree)' ],
    options: [
      pluginOption('rgthree', 'rgthree-comfy', 'https://github.com/rgthree/rgthree-comfy'),
    ],
  },
  {
    id: 'gguf',
    label: 'GGUF 加载',
    nodes: [ 'UnetLoaderGGUF', 'LoaderGGUF' ],
    options: [
      pluginOption('gguf', 'ComfyUI-GGUF', 'https://github.com/city96/ComfyUI-GGUF'),
    ],
  },
  {
    id: 'layerstyle',
    label: '图层工具',
    prefix: 'LayerUtility:',
    options: [
      pluginOption('layerstyle', 'ComfyUI_LayerStyle', 'https://github.com/chflame163/ComfyUI_LayerStyle'),
    ],
  },
  {
    id: 'easy',
    label: 'Easy Use',
    prefix: 'easy ',
    options: [
      pluginOption('easy', 'ComfyUI-Easy-Use', 'https://github.com/yolain/ComfyUI-Easy-Use'),
    ],
  },
  {
    id: 'frame',
    label: '补帧',
    nodes: [ 'RIFE VFI' ],
    options: [
      pluginOption('frame', 'ComfyUI-Frame-Interpolation', 'https://github.com/Fannovel16/ComfyUI-Frame-Interpolation'),
    ],
  },
  {
    id: 'crystools',
    label: 'Crystools',
    nodes: [ 'Primitive integer [Crystools]' ],
    options: [
      pluginOption('crystools', 'ComfyUI-Crystools', 'https://github.com/crystian/ComfyUI-Crystools'),
    ],
  },
  {
    id: 'pysssss',
    label: 'Custom Scripts',
    suffix: '|pysssss',
    options: [
      pluginOption('pysssss', 'ComfyUI-Custom-Scripts', 'https://github.com/pythongosssss/ComfyUI-Custom-Scripts'),
    ],
  },
];

const HF_WAN22 = 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/blob/main/split_files';
const MS_WAN22 = 'https://www.modelscope.cn/models/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/files';
const HF_WAN21 = 'https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/blob/main/split_files';
const MS_WAN21 = 'https://www.modelscope.cn/models/Comfy-Org/Wan_2.1_ComfyUI_repackaged/files';
const HF_QWEN = 'https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/blob/main/split_files';
const MS_QWEN = 'https://www.modelscope.cn/models/Comfy-Org/Qwen-Image_ComfyUI/files';
const HF_LIGHT = 'https://huggingface.co/lightx2v/Qwen-Image-Lightning';

function umt5Slot() {
  return {
    id: 'clip',
    label: '文本编码器',
    folder: 'text_encoders',
    match: /umt5_xxl/i,
    options: [
      modelOption('fp8', 'Hugging Face', 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', 'text_encoders', `${HF_WAN21}/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`),
      modelOption('fp8', 'ModelScope', 'umt5_xxl_fp8_e4m3fn_scaled.safetensors', 'text_encoders', MS_WAN21),
      modelOption('fp16', 'Hugging Face', 'umt5_xxl_fp16.safetensors', 'text_encoders', `${HF_WAN21}/text_encoders/umt5_xxl_fp16.safetensors`),
      modelOption('fp16', 'ModelScope', 'umt5_xxl_fp16.safetensors', 'text_encoders', MS_WAN21),
    ],
  };
}

function wan21VaeSlot() {
  return {
    id: 'vae',
    label: 'VAE',
    folder: 'vae',
    match: /wan_2\.?1_vae/i,
    options: [
      modelOption('', 'Hugging Face', 'wan_2.1_vae.safetensors', 'vae', `${HF_WAN22}/vae/wan_2.1_vae.safetensors`),
      modelOption('', 'ModelScope', 'wan_2.1_vae.safetensors', 'vae', MS_WAN22),
    ],
  };
}

const FAMILIES = [
  {
    id: 'wan22-i2v',
    label: 'Wan 2.2 图生视频',
    slots: [
      diffusionPair('unet_high', '高噪扩散模型', /wan2\.2_i2v_.*high_noise/i, 'wan2.2_i2v_high_noise_14B', true),
      diffusionPair('unet_low', '低噪扩散模型', /wan2\.2_i2v_.*low_noise/i, 'wan2.2_i2v_low_noise_14B', true),
      umt5Slot(),
      wan21VaeSlot(),
    ],
  },
  {
    id: 'wan22-t2v',
    label: 'Wan 2.2 文生视频',
    slots: [
      diffusionPair('unet_high', '高噪扩散模型', /wan2\.2_t2v_.*high_noise/i, 'wan2.2_t2v_high_noise_14B', true),
      diffusionPair('unet_low', '低噪扩散模型', /wan2\.2_t2v_.*low_noise/i, 'wan2.2_t2v_low_noise_14B', true),
      umt5Slot(),
      wan21VaeSlot(),
    ],
  },
  {
    id: 'wan22-5b',
    label: 'Wan 2.2 5B 图文生视频',
    slots: [
      {
        id: 'unet',
        label: '扩散模型',
        folder: 'diffusion_models',
        anchor: true,
        match: /wan2\.2_ti2v_5B/i,
        options: [
          modelOption('fp16', 'Hugging Face', 'wan2.2_ti2v_5B_fp16.safetensors', 'diffusion_models', `${HF_WAN22}/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors`),
          modelOption('fp16', 'ModelScope', 'wan2.2_ti2v_5B_fp16.safetensors', 'diffusion_models', MS_WAN22),
        ],
      },
      umt5Slot(),
      {
        id: 'vae',
        label: 'VAE',
        folder: 'vae',
        match: /wan2\.2_vae/i,
        options: [
          modelOption('', 'Hugging Face', 'wan2.2_vae.safetensors', 'vae', `${HF_WAN22}/vae/wan2.2_vae.safetensors`),
          modelOption('', 'ModelScope', 'wan2.2_vae.safetensors', 'vae', MS_WAN22),
        ],
      },
    ],
  },
  {
    id: 'wan21-flf2v',
    label: 'Wan 2.1 首尾帧',
    slots: [
      {
        id: 'unet',
        label: '首尾帧扩散模型',
        folder: 'diffusion_models',
        anchor: true,
        match: /flf2v/i,
        options: [
          modelOption('fp8', 'Hugging Face', 'Wan2_1-FLF2V-14B-720P_fp8_e4m3fn.safetensors', 'diffusion_models', `${HF_WAN21}/diffusion_models/wan2.1_flf2v_720p_14B_fp8_e4m3fn.safetensors`),
          modelOption('fp8', 'ModelScope', 'Wan2_1-FLF2V-14B-720P_fp8_e4m3fn.safetensors', 'diffusion_models', MS_WAN21),
          modelOption('fp16', 'Hugging Face', 'Wan2_1-FLF2V-14B-720P_fp16.safetensors', 'diffusion_models', `${HF_WAN21}/diffusion_models/wan2.1_flf2v_720p_14B_fp16.safetensors`),
          modelOption('fp16', 'ModelScope', 'Wan2_1-FLF2V-14B-720P_fp16.safetensors', 'diffusion_models', MS_WAN21),
        ],
      },
      umt5Slot(),
      wan21VaeSlot(),
    ],
  },
  {
    id: 'qwen-edit',
    label: '千问图像编辑',
    slots: [
      {
        id: 'unet',
        label: '编辑模型',
        folder: 'diffusion_models',
        anchor: true,
        match: /qwen_image_edit/i,
        options: [
          modelOption('fp8', 'Hugging Face', 'qwen_image_edit_fp8_e4m3fn.safetensors', 'diffusion_models', `${HF_QWEN}/diffusion_models/qwen_image_edit_fp8_e4m3fn.safetensors`),
          modelOption('fp8', 'ModelScope', 'qwen_image_edit_fp8_e4m3fn.safetensors', 'diffusion_models', MS_QWEN),
        ],
      },
      qwenClipSlot(),
      qwenVaeSlot(),
      {
        id: 'lora',
        label: '加速 LoRA',
        folder: 'loras',
        optional: true,
        match: /qwen-image-lightning/i,
        options: [
          modelOption('4steps', 'Hugging Face', 'Qwen-Image-Lightning-4steps-V1.0.safetensors', 'loras', HF_LIGHT),
          modelOption('8steps', 'Hugging Face', 'Qwen-Image-Lightning-8steps-V1.0.safetensors', 'loras', HF_LIGHT),
        ],
      },
    ],
  },
  {
    id: 'qwen-t2i',
    label: '千问文生图',
    slots: [
      {
        id: 'unet',
        label: '文生图模型',
        folder: 'diffusion_models',
        anchor: true,
        match: /qwen_image_(?!edit|vae)/i,
        options: [
          modelOption('fp8', 'Hugging Face', 'qwen_image_fp8_e4m3fn.safetensors', 'diffusion_models', `${HF_QWEN}/diffusion_models/qwen_image_fp8_e4m3fn.safetensors`),
          modelOption('fp8', 'ModelScope', 'qwen_image_fp8_e4m3fn.safetensors', 'diffusion_models', MS_QWEN),
          modelOption('2512', 'Hugging Face', 'qwen_image_2512_fp8_e4m3fn.safetensors', 'diffusion_models', `${HF_QWEN}/diffusion_models`),
          modelOption('2512', 'ModelScope', 'qwen_image_2512_fp8_e4m3fn.safetensors', 'diffusion_models', MS_QWEN),
        ],
      },
      qwenClipSlot(),
      qwenVaeSlot(),
    ],
  },
];

function pluginOption(id, name, url) {
  return {
    id,
    name,
    label: name,
    url,
    place: `${PLUGIN_ROOT}\\${name}`,
  };
}

function modelOption(variant, site, name, folder, url) {
  return {
    id: `${variant || 'file'}-${site}-${name}`,
    variant,
    site,
    label: variant ? `${variant} · ${site}` : site,
    name,
    directory: `models/${folder}`,
    place: `${PACK_MODELS}\\${folder}`,
    url,
  };
}

function diffusionPair(id, label, match, stem, anchor) {
  const fp8 = `${stem}_fp8_scaled.safetensors`;
  const fp16 = `${stem}_fp16.safetensors`;
  return {
    id,
    label,
    folder: 'diffusion_models',
    anchor: Boolean(anchor),
    match,
    options: [
      modelOption('fp8', 'Hugging Face', fp8, 'diffusion_models', `${HF_WAN22}/diffusion_models/${fp8}`),
      modelOption('fp8', 'ModelScope', fp8, 'diffusion_models', MS_WAN22),
      modelOption('fp16', 'Hugging Face', fp16, 'diffusion_models', `${HF_WAN22}/diffusion_models/${fp16}`),
      modelOption('fp16', 'ModelScope', fp16, 'diffusion_models', MS_WAN22),
    ],
  };
}

function qwenClipSlot() {
  return {
    id: 'clip',
    label: '文本编码器',
    folder: 'text_encoders',
    match: /qwen_2\.5_vl/i,
    options: [
      modelOption('fp8', 'Hugging Face', 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'text_encoders', `${HF_QWEN}/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors`),
      modelOption('fp8', 'ModelScope', 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'text_encoders', MS_QWEN),
      modelOption('bf16', 'Hugging Face', 'qwen_2.5_vl_7b.safetensors', 'text_encoders', `${HF_QWEN}/text_encoders/qwen_2.5_vl_7b.safetensors`),
      modelOption('bf16', 'ModelScope', 'qwen_2.5_vl_7b.safetensors', 'text_encoders', MS_QWEN),
    ],
  };
}

function qwenVaeSlot() {
  return {
    id: 'vae',
    label: 'VAE',
    folder: 'vae',
    match: /qwen_image_vae/i,
    options: [
      modelOption('', 'Hugging Face', 'qwen_image_vae.safetensors', 'vae', `${HF_QWEN}/vae/qwen_image_vae.safetensors`),
      modelOption('', 'ModelScope', 'qwen_image_vae.safetensors', 'vae', MS_QWEN),
    ],
  };
}

function basename(file) {
  return String(file || '').split(/[/\\]/).pop();
}

function installedName(installed, file) {
  const base = basename(file).toLowerCase();
  const hit = (installed || []).find(item => {
    const name = String(item.name || item);
    return name === file || basename(name).toLowerCase() === base;
  });
  return hit ? String(hit.name || hit) : '';
}

function guessFolder(name) {
  const text = name.toLowerCase();
  if (/lora/.test(text)) return 'loras';
  if (/vae/.test(text)) return 'vae';
  if (/clip_vision|clip-vision/.test(text)) return 'clip_vision';
  if (/controlnet|control_/.test(text)) return 'controlnet';
  if (/umt5|t5xxl|clip_l|clip_g|qwen_2\.5_vl/.test(text)) return 'text_encoders';
  if (/\.gguf$/.test(text)) return 'unet';
  if (/ckpt|xl_|sdxl|sd15|v1-5/.test(text)) return 'checkpoints';
  return 'diffusion_models';
}

function pluginMatches(plugin, node) {
  if ((plugin.nodes || []).includes(node)) return true;
  if (plugin.prefix && node.startsWith(plugin.prefix)) return true;
  if (plugin.suffix && node.endsWith(plugin.suffix)) return true;
  return false;
}

function filterOptions(options, variant) {
  if (!variant) return options;
  return options.filter(option => !option.variant || option.variant === variant);
}

function buildSupplies({ missingNodes, requiredModels, installedModels }) {
  const missingNodeList = (missingNodes || []).filter(name => !UI_ONLY.has(name));
  const plugins = [];
  const claimedNodes = new Set();
  PLUGINS.forEach(plugin => {
    const nodes = missingNodeList.filter(name => pluginMatches(plugin, name));
    if (!nodes.length) return;
    nodes.forEach(name => claimedNodes.add(name));
    plugins.push({
      id: plugin.id,
      label: plugin.label,
      missing_nodes: nodes,
      options: plugin.options,
    });
  });
  missingNodeList.filter(name => !claimedNodes.has(name)).forEach(name => {
    const query = encodeURIComponent(`${name} comfyui`);
    plugins.push({
      id: `node:${name}`,
      label: name,
      missing_nodes: [ name ],
      options: [
        {
          id: `gh-${name}`,
          name,
          label: 'GitHub 仓库搜索',
          url: `https://github.com/search?q=${query}&type=repositories`,
          place: PLUGIN_ROOT,
        },
        {
          id: `ms-${name}`,
          name,
          label: 'ModelScope 搜索',
          url: `https://www.modelscope.cn/search?q=${query}`,
          place: PLUGIN_ROOT,
        },
      ],
    });
  });

  const required = requiredModels || [];
  const modelGap = required.some(file => !installedName(installedModels, file));
  if (!modelGap) {
    return { note: plugins.length ? '自定义节点放到源码版 custom_nodes 后，当前启动参数仍不会加载它们。' : '', plugins, families: [], loose: [] };
  }
  const active = FAMILIES.filter(family => required.some(file => family.slots.some(slot => slot.anchor && slot.match.test(basename(file)))));
  const claimedFiles = new Set();
  const families = active.map(family => {
    const slots = family.slots.filter(slot => {
      if (slot.optional) return required.some(file => slot.match.test(basename(file)));
      return true;
    }).map(slot => {
      const asked = required.find(file => !claimedFiles.has(file) && slot.match.test(basename(file))) || '';
      if (asked) claimedFiles.add(asked);
      const present = installedName(installedModels, asked)
        || (slot.options.map(option => installedName(installedModels, option.name)).find(Boolean) || '');
      const missing = asked
        ? !installedName(installedModels, asked)
        : !present;
      return {
        id: slot.id,
        label: slot.label,
        asked: asked ? basename(asked) : '',
        in_workflow: Boolean(asked),
        present_name: present,
        missing,
        options: slot.options,
      };
    });
    return { id: family.id, label: family.label, slots };
  });

  const loose = required.filter(file => !claimedFiles.has(file) && !installedName(installedModels, file)).map(file => {
    const name = basename(file);
    const folder = guessFolder(name);
    const query = encodeURIComponent(name);
    return {
      id: `loose:${name}`,
      label: '未收录模型',
      asked: name,
      missing: true,
      options: [
        modelOption('', 'Hugging Face', name, folder, `https://huggingface.co/models?search=${query}`),
        modelOption('', 'ModelScope', name, folder, `https://www.modelscope.cn/search?q=${query}`),
      ],
    };
  });

  return {
    note: '模型放到 0.11.1 的 models 子目录后，源码版会通过 extra_model_paths.yaml 读到。自定义节点目录当前启动参数不会加载。',
    plugins,
    families,
    loose,
  };
}

module.exports = { buildSupplies, filterOptions, basename };
