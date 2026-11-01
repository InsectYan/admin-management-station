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

const ZIMAGE_TEMPLATES = [
  {
    name: 'z-image-turbo-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: zImageGraph(),
  },
];

module.exports = {
  ZIMAGE_TEMPLATES,
  CKPT,
};
