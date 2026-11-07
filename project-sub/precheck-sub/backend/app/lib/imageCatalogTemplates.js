'use strict';

const T5 = 't5xxl_fp8_e4m3fn.safetensors';
const CLIP_L = 'clip_l.safetensors';
const FLUX_VAE = 'Flux\\ae.sft';
const QWEN_CLIP = 'Qwen\\qwen_2.5_vl_7b_fp8_scaled.safetensors';
const QWEN_VAE = 'Qwen\\qwen_image_vae.safetensors';
const KLEIN_CLIP = 'Qwen\\qwen_3_8b_fp8mixed.safetensors';
const KLEIN_VAE = 'Flux\\flux2-vae.safetensors';

const PROMPT = '一位年轻女性站在木窗边，暖色侧光落在头发上，背景是虚化的绿植，画面干净。';
const EDIT_PROMPT = '保持人物的脸、发型和服装不变，改成白底全身侧面站立，人物完整入画。';

function checkpointGraph({ ckpt, width, height, steps, cfg, scheduler, prefix }) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    2: { class_type: 'CLIPTextEncode', inputs: { text: PROMPT, clip: [ '1', 1 ] } },
    3: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: [ '1', 1 ] } },
    4: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    5: {
      class_type: 'KSampler',
      inputs: {
        model: [ '1', 0 ],
        positive: [ '2', 0 ],
        negative: [ '3', 0 ],
        latent_image: [ '4', 0 ],
        seed: 1,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler,
        denoise: 1,
      },
    },
    6: { class_type: 'VAEDecode', inputs: { samples: [ '5', 0 ], vae: [ '1', 2 ] } },
    7: { class_type: 'SaveImage', inputs: { images: [ '6', 0 ], filename_prefix: prefix } },
  };
}

function fluxGraph({ unet, steps, prefix }) {
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: unet, weight_dtype: 'default' } },
    2: {
      class_type: 'DualCLIPLoader',
      inputs: { clip_name1: T5, clip_name2: CLIP_L, type: 'flux' },
    },
    3: { class_type: 'VAELoader', inputs: { vae_name: FLUX_VAE } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: PROMPT, clip: [ '2', 0 ] } },
    5: { class_type: 'FluxGuidance', inputs: { conditioning: [ '4', 0 ], guidance: 3.5 } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: [ '2', 0 ] } },
    7: { class_type: 'EmptySD3LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    8: {
      class_type: 'KSampler',
      inputs: {
        model: [ '1', 0 ],
        positive: [ '5', 0 ],
        negative: [ '6', 0 ],
        latent_image: [ '7', 0 ],
        seed: 1,
        steps,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    9: { class_type: 'VAEDecode', inputs: { samples: [ '8', 0 ], vae: [ '3', 0 ] } },
    10: { class_type: 'SaveImage', inputs: { images: [ '9', 0 ], filename_prefix: prefix } },
  };
}

function fluxKontextGraph() {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'flux\\Flux.1-Kontext-dev.safetensors', weight_dtype: 'default' },
    },
    2: {
      class_type: 'DualCLIPLoader',
      inputs: { clip_name1: T5, clip_name2: CLIP_L, type: 'flux' },
    },
    3: { class_type: 'VAELoader', inputs: { vae_name: FLUX_VAE } },
    4: { class_type: 'LoadImage', inputs: { image: 'reference.png' } },
    5: { class_type: 'FluxKontextImageScale', inputs: { image: [ '4', 0 ] } },
    6: { class_type: 'VAEEncode', inputs: { pixels: [ '5', 0 ], vae: [ '3', 0 ] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: EDIT_PROMPT, clip: [ '2', 0 ] } },
    8: { class_type: 'FluxGuidance', inputs: { conditioning: [ '7', 0 ], guidance: 2.5 } },
    9: { class_type: 'ReferenceLatent', inputs: { conditioning: [ '8', 0 ], latent: [ '6', 0 ] } },
    10: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: [ '2', 0 ] } },
    11: {
      class_type: 'KSampler',
      inputs: {
        model: [ '1', 0 ],
        positive: [ '9', 0 ],
        negative: [ '10', 0 ],
        latent_image: [ '6', 0 ],
        seed: 1,
        steps: 20,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    12: { class_type: 'VAEDecode', inputs: { samples: [ '11', 0 ], vae: [ '3', 0 ] } },
    13: { class_type: 'SaveImage', inputs: { images: [ '12', 0 ], filename_prefix: 'image/flux-kontext' } },
  };
}

function kleinGraph() {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'Flux\\Klein\\flux2Klein9BTrue_v10Fp8.safetensors', weight_dtype: 'default' },
    },
    2: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: KLEIN_CLIP, type: 'flux2', device: 'default' },
    },
    3: { class_type: 'VAELoader', inputs: { vae_name: KLEIN_VAE } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: PROMPT, clip: [ '2', 0 ] } },
    5: { class_type: 'CLIPTextEncode', inputs: { text: '', clip: [ '2', 0 ] } },
    6: { class_type: 'EmptyFlux2LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    7: {
      class_type: 'KSampler',
      inputs: {
        model: [ '1', 0 ],
        positive: [ '4', 0 ],
        negative: [ '5', 0 ],
        latent_image: [ '6', 0 ],
        seed: 1,
        steps: 4,
        cfg: 1,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    8: { class_type: 'VAEDecode', inputs: { samples: [ '7', 0 ], vae: [ '3', 0 ] } },
    9: { class_type: 'SaveImage', inputs: { images: [ '8', 0 ], filename_prefix: 'image/flux2-klein-9b' } },
  };
}

function qwen2512Graph() {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: 'Qwen-Image\\qwen_image_2512_bf16.safetensors', weight_dtype: 'default' },
    },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: QWEN_CLIP, type: 'qwen_image', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: QWEN_VAE } },
    4: { class_type: 'ModelSamplingAuraFlow', inputs: { model: [ '1', 0 ], shift: 3.1 } },
    5: { class_type: 'CFGNorm', inputs: { model: [ '4', 0 ], strength: 1 } },
    6: {
      class_type: 'TextEncodeQwenImageEdit',
      inputs: { clip: [ '2', 0 ], prompt: PROMPT, vae: [ '3', 0 ] },
    },
    7: {
      class_type: 'TextEncodeQwenImageEdit',
      inputs: { clip: [ '2', 0 ], prompt: '', vae: [ '3', 0 ] },
    },
    8: { class_type: 'EmptySD3LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
    9: {
      class_type: 'KSampler',
      inputs: {
        model: [ '5', 0 ],
        positive: [ '6', 0 ],
        negative: [ '7', 0 ],
        latent_image: [ '8', 0 ],
        seed: 1,
        steps: 20,
        cfg: 2.5,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    10: { class_type: 'VAEDecode', inputs: { samples: [ '9', 0 ], vae: [ '3', 0 ] } },
    11: { class_type: 'SaveImage', inputs: { images: [ '10', 0 ], filename_prefix: 'image/qwen-image-2512' } },
  };
}

function qwenBf16EditGraph(unet, prefix) {
  return {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: unet, weight_dtype: 'fp8_e4m3fn_fast' },
    },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: QWEN_CLIP, type: 'qwen_image', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: QWEN_VAE } },
    4: { class_type: 'ModelSamplingAuraFlow', inputs: { model: [ '1', 0 ], shift: 3.1 } },
    5: { class_type: 'CFGNorm', inputs: { model: [ '4', 0 ], strength: 1 } },
    6: { class_type: 'LoadImage', inputs: { image: 'reference.png' } },
    7: {
      class_type: 'ImageScaleToTotalPixels',
      inputs: { image: [ '6', 0 ], upscale_method: 'lanczos', megapixels: 1, resolution_steps: 1 },
    },
    8: {
      class_type: 'TextEncodeQwenImageEditPlus',
      inputs: { clip: [ '2', 0 ], prompt: EDIT_PROMPT, vae: [ '3', 0 ], image1: [ '7', 0 ] },
    },
    9: {
      class_type: 'TextEncodeQwenImageEditPlus',
      inputs: { clip: [ '2', 0 ], prompt: '', vae: [ '3', 0 ], image1: [ '7', 0 ] },
    },
    10: { class_type: 'VAEEncode', inputs: { pixels: [ '7', 0 ], vae: [ '3', 0 ] } },
    11: {
      class_type: 'KSampler',
      inputs: {
        model: [ '5', 0 ],
        positive: [ '8', 0 ],
        negative: [ '9', 0 ],
        latent_image: [ '10', 0 ],
        seed: 1,
        steps: 20,
        cfg: 2.5,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1,
      },
    },
    12: { class_type: 'VAEDecode', inputs: { samples: [ '11', 0 ], vae: [ '3', 0 ] } },
    13: { class_type: 'SaveImage', inputs: { images: [ '12', 0 ], filename_prefix: prefix } },
  };
}

const IMAGE_CATALOG_TEMPLATES = [
  {
    name: 'sdxl-awpainting-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 10,
    api_json: checkpointGraph({
      ckpt: 'AWPainting XL_1.0.safetensors',
      width: 1024,
      height: 1024,
      steps: 28,
      cfg: 7,
      scheduler: 'normal',
      prefix: 'image/sdxl-awpainting',
    }),
  },
  {
    name: 'sdxl-荣华-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 10,
    api_json: checkpointGraph({
      ckpt: 'SDXL\\SDXL_RongHua荣华.safetensors',
      width: 1024,
      height: 1024,
      steps: 28,
      cfg: 7,
      scheduler: 'normal',
      prefix: 'image/sdxl-ronghua',
    }),
  },
  {
    name: 'sdxl-turbo-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 10,
    api_json: checkpointGraph({
      ckpt: 'SDXL\\sd_xl_turbo_1.0_fp16.safetensors',
      width: 512,
      height: 512,
      steps: 4,
      cfg: 1,
      scheduler: 'normal',
      prefix: 'image/sdxl-turbo',
    }),
  },
  {
    name: 'sd15-awpainting-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 6,
    api_json: checkpointGraph({
      ckpt: 'AWPainting_v1.5.safetensors',
      width: 512,
      height: 512,
      steps: 20,
      cfg: 7,
      scheduler: 'normal',
      prefix: 'image/sd15-awpainting',
    }),
  },
  {
    name: 'sd15-xxmix-写实-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 6,
    api_json: checkpointGraph({
      ckpt: 'SDXL\\xxmix9realistic_v40.safetensors',
      width: 512,
      height: 512,
      steps: 20,
      cfg: 7,
      scheduler: 'normal',
      prefix: 'image/sd15-xxmix',
    }),
  },
  {
    name: 'sd15-realcartoon3d-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 6,
    api_json: checkpointGraph({
      ckpt: 'SDXL\\2.5D_realcartoon3d_v6.safetensors',
      width: 512,
      height: 512,
      steps: 20,
      cfg: 7,
      scheduler: 'normal',
      prefix: 'image/sd15-realcartoon3d',
    }),
  },
  {
    name: 'qwen-image-2512-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 48,
    api_json: qwen2512Graph(),
  },
  {
    name: 'flux-awportrait-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 16,
    api_json: fluxGraph({
      unet: 'flux\\AWPortrait-FL-fp8.safetensors',
      steps: 20,
      prefix: 'image/flux-awportrait',
    }),
  },
  {
    name: 'flux-reality-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 24,
    api_json: fluxGraph({
      unet: 'getphatFLUXReality_v11Softcore.safetensors',
      steps: 20,
      prefix: 'image/flux-reality',
    }),
  },
  {
    name: 'flux-niji-二次元-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 16,
    api_json: fluxGraph({
      unet: 'niji-动漫二次元加强版_f.1d.safetensors',
      steps: 20,
      prefix: 'image/flux-niji',
    }),
  },
  {
    name: 'flux2-klein-9b-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 16,
    api_json: kleinGraph(),
  },
  {
    name: 'qwen-image-edit-2511-改图',
    category: 'image_edit',
    suggested_vram_gb: 20,
    api_json: qwenBf16EditGraph('Qwen-Image\\qwen_image_edit_2511_bf16.safetensors', 'image/qwen-image-edit-2511'),
  },
  {
    name: 'qwen-image-edit-2509-改图',
    category: 'image_edit',
    suggested_vram_gb: 20,
    api_json: qwenBf16EditGraph('Qwen-Image\\Qwen-Image-Edit-2509_bf16.safetensors', 'image/qwen-image-edit-2509'),
  },
  {
    name: 'flux-kontext-改图',
    category: 'image_edit',
    suggested_vram_gb: 16,
    api_json: fluxKontextGraph(),
  },
];

module.exports = { IMAGE_CATALOG_TEMPLATES };
