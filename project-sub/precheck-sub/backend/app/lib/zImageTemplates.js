'use strict';

const CKPT = 'z-image\\zImageTurboNSFW_30BF16AIO.safetensors';
const PROMPT = '一位年轻女性的半身肖像，深棕色长卷发，米棕色短款上衣，电影胶片质感，垂直构图，背景是虚化的绿植和深色木结构，柔和自然光。';

function zImageGraph() {
  return {
    1: {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: CKPT },
    },
    2: {
      class_type: 'ModelSamplingAuraFlow',
      inputs: { model: [ '1', 0 ], shift: 3.1 },
    },
    3: {
      class_type: 'CLIPTextEncode',
      inputs: { text: PROMPT, clip: [ '1', 1 ] },
    },
    4: {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: [ '1', 1 ] },
    },
    5: {
      class_type: 'EmptySD3LatentImage',
      inputs: { width: 768, height: 1360, batch_size: 1 },
    },
    6: {
      class_type: 'KSampler',
      inputs: {
        model: [ '2', 0 ],
        positive: [ '3', 0 ],
        negative: [ '4', 0 ],
        latent_image: [ '5', 0 ],
        seed: 1,
        steps: 8,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    7: {
      class_type: 'VAEDecode',
      inputs: { samples: [ '6', 0 ], vae: [ '1', 2 ] },
    },
    8: {
      class_type: 'SaveImage',
      inputs: { images: [ '7', 0 ], filename_prefix: 'image/z-image-turbo' },
    },
  };
}

function zImageSplitGraph() {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'z-image\\zImageTurboNSFW_30BF16Diffusion.safetensors', weight_dtype: 'default' },
    },
    2: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: 'z-image\\qwen_3_4b.safetensors', type: 'lumina2', device: 'default' },
    },
    3: {
      class_type: 'VAELoader',
      inputs: { vae_name: 'z-image\\diffusion_pytorch_model.safetensors' },
    },
    4: {
      class_type: 'ModelSamplingAuraFlow',
      inputs: { model: [ '1', 0 ], shift: 3.1 },
    },
    5: {
      class_type: 'CLIPTextEncode',
      inputs: { text: PROMPT, clip: [ '2', 0 ] },
    },
    6: {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: [ '2', 0 ] },
    },
    7: {
      class_type: 'EmptySD3LatentImage',
      inputs: { width: 768, height: 1360, batch_size: 1 },
    },
    8: {
      class_type: 'KSampler',
      inputs: {
        model: [ '4', 0 ],
        positive: [ '5', 0 ],
        negative: [ '6', 0 ],
        latent_image: [ '7', 0 ],
        seed: 1,
        steps: 8,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    9: {
      class_type: 'VAEDecode',
      inputs: { samples: [ '8', 0 ], vae: [ '3', 0 ] },
    },
    10: {
      class_type: 'SaveImage',
      inputs: { images: [ '9', 0 ], filename_prefix: 'image/z-image-turbo-split' },
    },
  };
}

const ZIMAGE_TEMPLATES = [
  {
    name: 'z-image-turbo-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: zImageGraph(),
  },
  {
    name: 'z-image-turbo-拆分-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 20,
    api_json: zImageSplitGraph(),
  },
];

module.exports = {
  ZIMAGE_TEMPLATES,
  CKPT,
};
