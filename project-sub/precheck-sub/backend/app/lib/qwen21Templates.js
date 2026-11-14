'use strict';

const UNET_BF16 = 'qwen-image-2.1\\qwen_image_2.1_bf16.safetensors';
const UNET_TURBO = 'qwen-image-2.1\\qwen_image_2.1_turbo_bf16.safetensors';
const CLIP_T2I = 'qwen-image-2.1\\qwen3vl_8b_bf16.safetensors';
const CLIP = 'qwen-image-2.1\\qwen3vl_8b_int8_convrot.safetensors';
const CLIP_HERETIC = 'qwen-image-2.1\\qwen3vl_8b_fp8_heretic.safetensors';
const VAE = 'qwen-image-2.1\\qwen_image_2.1_vae_bf16.safetensors';
const PROMPT = '一位年轻女性站在木窗边，暖色侧光落在头发上，背景是虚化的绿植，画面干净。';

function qwen21Graph({ unet, clip, steps, prefix }) {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: unet, weight_dtype: 'default' },
    },
    2: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: clip, type: 'qwen_image', device: 'default' },
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

const I2I_PROMPT = '保持 <image1> 里人物的脸、发型、服装和身体清晰不变，改成站在木窗边，暖色侧光，背景是虚化的绿植。';

function qwen21EditGraph(clip = CLIP, prefix = 'image/qwen-image-2.1-i2i') {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: UNET_BF16, weight_dtype: 'default' },
    },
    2: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: clip, type: 'qwen_image', device: 'default' },
    },
    3: {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE },
    },
    4: {
      class_type: 'LoadImage',
      inputs: { image: 'reference.png' },
    },
    5: {
      class_type: 'TextEncodeQwenImage21',
      inputs: {
        clip: [ '2', 0 ],
        prompt: I2I_PROMPT,
        negative_prompt: '',
        vae: [ '3', 0 ],
        resolution: 1024,
        width: 0,
        height: 0,
        'images.image_1': [ '4', 0 ],
      },
    },
    6: {
      class_type: 'KSampler',
      inputs: {
        model: [ '1', 0 ],
        positive: [ '5', 0 ],
        negative: [ '5', 1 ],
        latent_image: [ '5', 2 ],
        seed: 1,
        steps: 25,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    7: {
      class_type: 'VAEDecode',
      inputs: { samples: [ '6', 0 ], vae: [ '3', 0 ] },
    },
    8: {
      class_type: 'SaveImage',
      inputs: { images: [ '7', 0 ], filename_prefix: prefix },
    },
  };
}

const QWEN21_TEMPLATES = [
  {
    name: 'qwen-image-2.1-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: qwen21Graph({ unet: UNET_BF16, clip: CLIP_T2I, steps: 25, prefix: 'image/qwen-image-2.1' }),
  },
  {
    name: 'qwen-image-2.1-图生图',
    category: 'image_edit',
    suggested_vram_gb: 24,
    api_json: qwen21EditGraph(),
  },
  {
    name: 'Qwen-Image-2.1-图生图-Heretic',
    category: 'image_edit',
    suggested_vram_gb: 24,
    api_json: qwen21EditGraph(CLIP_HERETIC, 'image/qwen-image-2.1-i2i-heretic'),
  },
  {
    name: 'qwen-image-2.1-turbo-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: qwen21Graph({ unet: UNET_TURBO, clip: CLIP, steps: 8, prefix: 'image/qwen-image-2.1-turbo' }),
  },
];

module.exports = {
  QWEN21_TEMPLATES,
  UNET_BF16,
  UNET_TURBO,
  CLIP,
  CLIP_HERETIC,
  CLIP_T2I,
  VAE,
};
