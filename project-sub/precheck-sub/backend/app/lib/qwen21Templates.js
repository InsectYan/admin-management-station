'use strict';

const UNET_BF16 = 'qwen-image-2.1\\qwen_image_2.1_bf16.safetensors';
const UNET_TURBO = 'qwen-image-2.1\\qwen_image_2.1_turbo_bf16.safetensors';
const CLIP = 'qwen-image-2.1\\qwen3vl_8b_int8_convrot.safetensors';
const VAE = 'qwen-image-2.1\\qwen_image_2.1_vae_bf16.safetensors';
const PROMPT = '一张电影感的竖幅照片，年轻女性站在木窗边，暖色侧光落在头发上，背景是虚化的绿植，肤色自然，画面干净。';

function qwen21Graph({ unet, steps, prefix }) {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: unet, weight_dtype: 'default' },
    },
    2: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: CLIP, type: 'qwen_image', device: 'default' },
    },
    3: {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE },
    },
    4: {
      class_type: 'TextEncodeQwenImage21',
      inputs: {
        clip: [ '2', 0 ],
        prompt: PROMPT,
        negative_prompt: '',
        vae: [ '3', 0 ],
        resolution: 1024,
        width: 1024,
        height: 1024,
      },
    },
    5: {
      class_type: 'KSampler',
      inputs: {
        model: [ '1', 0 ],
        positive: [ '4', 0 ],
        negative: [ '4', 1 ],
        latent_image: [ '4', 2 ],
        seed: 1,
        steps,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    6: {
      class_type: 'VAEDecode',
      inputs: { samples: [ '5', 0 ], vae: [ '3', 0 ] },
    },
    7: {
      class_type: 'SaveImage',
      inputs: { images: [ '6', 0 ], filename_prefix: prefix },
    },
  };
}

const QWEN21_TEMPLATES = [
  {
    name: 'qwen-image-2.1-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: qwen21Graph({ unet: UNET_BF16, steps: 25, prefix: 'image/qwen-image-2.1' }),
  },
  {
    name: 'qwen-image-2.1-turbo-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: qwen21Graph({ unet: UNET_TURBO, steps: 8, prefix: 'image/qwen-image-2.1-turbo' }),
  },
];

module.exports = {
  QWEN21_TEMPLATES,
  UNET_BF16,
  UNET_TURBO,
  CLIP,
  VAE,
};
