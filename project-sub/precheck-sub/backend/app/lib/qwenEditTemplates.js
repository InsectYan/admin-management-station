'use strict';

const UNET = 'Qwen-Image\\qwen_image_edit_fp8_e4m3fn.safetensors';
const CLIP = 'Qwen\\qwen_2.5_vl_7b_fp8_scaled.safetensors';
const VAE = 'Qwen\\qwen_image_vae.safetensors';
const PROMPT = '保持人物的脸、发型、服装和身体比例不变，改成白底全身侧面站立，人物完整入画。';

function qwenEditGraph({ megapixels, prefix, prompt }) {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: UNET, weight_dtype: 'default' },
    },
    2: {
      class_type: 'ModelSamplingAuraFlow',
      inputs: { model: [ '1', 0 ], shift: 3 },
    },
    3: {
      class_type: 'CFGNorm',
      inputs: { model: [ '2', 0 ], strength: 1 },
    },
    4: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: CLIP, type: 'qwen_image', device: 'default' },
    },
    5: {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE },
    },
    6: {
      class_type: 'LoadImage',
      inputs: { image: 'reference.png' },
    },
    7: {
      class_type: 'ImageScaleToTotalPixels',
      inputs: {
        image: [ '6', 0 ],
        upscale_method: 'lanczos',
        megapixels,
        resolution_steps: 1,
      },
    },
    8: {
      class_type: 'TextEncodeQwenImageEdit',
      inputs: {
        clip: [ '4', 0 ],
        prompt,
        vae: [ '5', 0 ],
        image: [ '7', 0 ],
      },
    },
    9: {
      class_type: 'TextEncodeQwenImageEdit',
      inputs: {
        clip: [ '4', 0 ],
        prompt: '',
        vae: [ '5', 0 ],
        image: [ '7', 0 ],
      },
    },
    10: {
      class_type: 'VAEEncode',
      inputs: { pixels: [ '7', 0 ], vae: [ '5', 0 ] },
    },
    11: {
      class_type: 'KSampler',
      inputs: {
        seed: 1,
        steps: 20,
        cfg: 2.5,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
        model: [ '3', 0 ],
        positive: [ '8', 0 ],
        negative: [ '9', 0 ],
        latent_image: [ '10', 0 ],
      },
    },
    12: {
      class_type: 'VAEDecode',
      inputs: { samples: [ '11', 0 ], vae: [ '5', 0 ] },
    },
    13: {
      class_type: 'SaveImage',
      inputs: { images: [ '12', 0 ], filename_prefix: prefix },
    },
  };
}

const QWEN_EDIT_TEMPLATES = [
  {
    name: 'qwen-image-edit-改图',
    category: 'image_edit',
    suggested_vram_gb: 16,
    api_json: qwenEditGraph({
      megapixels: 1,
      prefix: 'image/qwen-image-edit',
      prompt: PROMPT,
    }),
  },
  {
    name: '千问改图',
    category: 'image_edit',
    suggested_vram_gb: 16,
    api_json: qwenEditGraph({
      megapixels: 0.25,
      prefix: 'qwen-edit-cartoon-v1',
      prompt: 'keep the same character, change the coat color to dark blue',
    }),
  },
];

module.exports = {
  QWEN_EDIT_TEMPLATES,
  UNET,
  CLIP,
  VAE,
};
