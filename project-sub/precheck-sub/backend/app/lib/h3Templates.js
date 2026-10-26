'use strict';

const CLIP_NVFP4 = 'minimax\\qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors';
const CLIP_BF16 = 'minimax\\qwen3vl_32b_minimax_h3_bf16.safetensors';
const VAE_VIDEO = 'minimax\\minimax_h3_video_vae_fp16.safetensors';
const VAE_AUDIO = 'minimax\\minimax_h3_audio_vae_fp32.safetensors';
const UNET_LIGHT = 'minimax\\minimax_h3_fl2va_pruned_int8_convrot.safetensors';
const UNET_FULL = 'minimax\\minimax_h3_fl2va_bf16.safetensors';
const UNET_REF = 'minimax\\minimax_h3_ref2va_pruned_int8_convrot.safetensors';
const LORA = 'minimax\\h3-realism-people-t2v-i2v-r2v.safetensors';

const PROMPT_T2V = '一只橘猫从窗台走过，阳光落在木地板上，镜头缓慢跟随，环境音是远处的鸟叫。';
const PROMPT_FLF = '人物从门口走到窗边，动作连贯，光线从暖色变成傍晚的冷色，脚步声清晰。';
const PROMPT_REF = '让 <Picture 1> 里的角色保持同一张脸和同一套衣服，走到窗边停下，光线柔和，有轻微的衣料声。';
const PROMPT_LORA = '真实人物从门口走到窗边，皮肤和衣服细节清楚，动作自然，光线是傍晚室内光。';

function h3Graph(options) {
  const nodes = {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: options.unet, weight_dtype: 'default' },
    },
    3: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: options.clip || CLIP_NVFP4, type: 'minimax', device: 'default' },
    },
    4: {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE_VIDEO },
    },
    5: {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE_AUDIO },
    },
  };
  let model = [ '1', 0 ];
  if (options.lora) {
    nodes['2'] = {
      class_type: 'LoraLoaderModelOnly',
      inputs: { model, lora_name: options.lora, strength_model: 1 },
    };
    model = [ '2', 0 ];
  }
  nodes['6'] = {
    class_type: 'MiniMaxH3SigmaShift',
    inputs: { model, shift_video: 12, shift_audio: 3 },
  };
  const condition = {
    class_type: options.reference ? 'MiniMaxH3ReferenceToVideo' : 'MiniMaxH3ImageToVideo',
    inputs: {
      clip: [ '3', 0 ],
      vae: [ '4', 0 ],
      prompt: options.prompt,
      width: 1344,
      height: 768,
      length: 124,
    },
  };
  if (options.reference) {
    condition.inputs.audio_vae = [ '5', 0 ];
    condition.inputs.ref_image_size = 'match';
    condition.inputs['ref_images.ref_image_0'] = [ '20', 0 ];
    nodes['20'] = { class_type: 'LoadImage', inputs: { image: 'reference.png' } };
  }
  if (options.first) {
    condition.inputs.first_frame = [ '21', 0 ];
    nodes['21'] = { class_type: 'LoadImage', inputs: { image: 'first.png' } };
  }
  if (options.last) {
    condition.inputs.last_frame = [ '22', 0 ];
    nodes['22'] = { class_type: 'LoadImage', inputs: { image: 'last.png' } };
  }
  nodes['7'] = condition;
  nodes['8'] = { class_type: 'RandomNoise', inputs: { noise_seed: 1 } };
  nodes['9'] = { class_type: 'KSamplerSelect', inputs: { sampler_name: 'res_multistep' } };
  nodes['10'] = {
    class_type: 'BasicScheduler',
    inputs: { model: [ '6', 0 ], scheduler: 'simple', steps: options.steps, denoise: 1 },
  };
  nodes['11'] = {
    class_type: 'BasicGuider',
    inputs: { model: [ '6', 0 ], conditioning: [ '7', 0 ] },
  };
  nodes['12'] = {
    class_type: 'SamplerCustomAdvanced',
    inputs: {
      noise: [ '8', 0 ],
      guider: [ '11', 0 ],
      sampler: [ '9', 0 ],
      sigmas: [ '10', 0 ],
      latent_image: [ '7', 1 ],
    },
  };
  nodes['13'] = { class_type: 'VAEDecode', inputs: { samples: [ '12', 0 ], vae: [ '4', 0 ] } };
  nodes['14'] = { class_type: 'VAEDecodeAudio', inputs: { samples: [ '12', 0 ], vae: [ '5', 0 ] } };
  nodes['15'] = {
    class_type: 'CreateVideo',
    inputs: { images: [ '13', 0 ], fps: 24, audio: [ '14', 0 ] },
  };
  nodes['16'] = {
    class_type: 'SaveVideo',
    inputs: { video: [ '15', 0 ], filename_prefix: options.prefix, format: 'mp4' },
  };
  return nodes;
}

const H3_TEMPLATES = [
  {
    name: '轻量-h3-文生视频',
    category: 'text_to_video',
    suggested_vram_gb: 24,
    api_json: h3Graph({
      unet: UNET_LIGHT,
      prompt: PROMPT_T2V,
      steps: 20,
      prefix: 'video/h3-light-t2v',
    }),
  },
  {
    name: '轻量-h3-首尾帧生视频',
    category: 'image_to_video',
    suggested_vram_gb: 24,
    api_json: h3Graph({
      unet: UNET_LIGHT,
      prompt: PROMPT_FLF,
      steps: 20,
      first: true,
      last: true,
      prefix: 'video/h3-light-flf',
    }),
  },
  {
    name: '轻量-h3-参考生视频',
    category: 'image_to_video',
    suggested_vram_gb: 24,
    api_json: h3Graph({
      unet: UNET_REF,
      prompt: PROMPT_REF,
      steps: 20,
      reference: true,
      prefix: 'video/h3-light-ref',
    }),
  },
  {
    name: '满血-h3-文生视频',
    category: 'text_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      prompt: PROMPT_T2V,
      steps: 20,
      prefix: 'video/h3-full-t2v',
    }),
  },
  {
    name: '满血-h3-首尾帧生视频',
    category: 'image_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      prompt: PROMPT_FLF,
      steps: 20,
      first: true,
      last: true,
      prefix: 'video/h3-full-flf',
    }),
  },
  {
    name: '满血-h3-首尾帧-lora控制',
    category: 'image_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      lora: LORA,
      prompt: PROMPT_LORA,
      steps: 20,
      first: true,
      last: true,
      prefix: 'video/h3-full-flf-lora',
    }),
  },
];

module.exports = {
  H3_TEMPLATES,
  CLIP_NVFP4,
  CLIP_BF16,
  VAE_VIDEO,
  VAE_AUDIO,
  UNET_LIGHT,
  UNET_FULL,
  UNET_REF,
  LORA,
};
