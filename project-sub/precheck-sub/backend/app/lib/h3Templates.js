'use strict';

const CLIP_NVFP4 = 'minimax\\qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors';
const CLIP_BF16 = 'minimax\\qwen3vl_32b_minimax_h3_bf16.safetensors';
const VAE_VIDEO = 'minimax\\minimax_h3_video_vae_fp16.safetensors';
const VAE_AUDIO = 'minimax\\minimax_h3_audio_vae_fp32.safetensors';
const UNET_LIGHT = 'minimax\\minimax_h3_fl2va_pruned_int8_convrot.safetensors';
const UNET_FULL = 'minimax\\minimax_h3_fl2va_bf16.safetensors';
const UNET_REF = 'minimax\\minimax_h3_ref2va_pruned_int8_convrot.safetensors';
const LORA = 'minimax\\h3-realism-people-t2v-i2v-r2v.safetensors';
const LORA_DETAIL = 'minimax\\detailed_penis_H3_v1_阴茎.safetensors';
const LORA_M3 = 'minimax\\M3_Unlocked_V3.1_BBB.safetensors';
const UNET_REMIX = 'minimax\\FeiHou_MiniMax-H3_Remix_HSA_turbo_v0.8_int8_convrotHQ.safetensors';
const CLIP_REMIX = 'minimax\\qwen3vl_32b_minimax_h3_int8_convrot_uncensored_FeiHou.safetensors';
const PDD_FL2VA = 'minimax_h3_fl2va_pdd_acc_8step_comfyui.safetensors';
const UNET_IMAGE = 'minimax\\minimax_h3_image_pruned_bf16.safetensors';
const VAE_IMAGE = 'minimax\\minimax_h3_image_vae_fp16.safetensors';
// 生图提示词扩展器。扩散模型读的是上面的 32B CLIP，不是这个 9B。
const CLIP_IMAGE_PE = 'minimax\\qwen3.5_9b_bf16.safetensors';

const PROMPT_T2V = '一只橘猫从窗台走过，阳光落在木地板上，镜头缓慢跟随，环境音是远处的鸟叫。';
const PROMPT_FLF = '人物从门口走到窗边，动作连贯，光线从暖色变成傍晚的冷色，脚步声清晰。';
const PROMPT_REF = '让 <Picture 1> 里的角色保持同一张脸和同一套衣服，走到窗边停下，光线柔和，有轻微的衣料声。';
const PROMPT_REFMOD = '让 <Picture 1> 保持同一张脸和同一套衣服，从门口走到窗边停下，光线柔和，有轻微的衣料声。';
const PROMPT_REF_FLF = '让 <Picture 1> 保持同一张脸和同一套衣服，从首帧开始往下演，动作连贯，光线自然。没有尾帧时按首帧继续，不要自己补一个结尾定格。';
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
  const loras = [];
  if (options.lora) loras.push(options.lora);
  loras.push(LORA_DETAIL);
  loras.push(LORA_M3);
  const loraIds = [ '2', '17', '18' ];
  loras.forEach((name, index) => {
    const id = loraIds[index];
    nodes[id] = {
      class_type: 'LoraLoaderModelOnly',
      inputs: { model, lora_name: name, strength_model: 1 },
    };
    model = [ id, 0 ];
  });
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
    if (!options.refmod) {
      condition.inputs['ref_images.ref_image_0'] = [ '20', 0 ];
      nodes['20'] = { class_type: 'LoadImage', inputs: { image: 'reference.png' } };
    }
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
  let positiveOut = [ '7', 0 ];
  if (options.guides) {
    nodes['21'] = { class_type: 'LoadImage', inputs: { image: 'first.png' } };
    nodes['23'] = {
      class_type: 'MiniMaxH3AddGuide',
      inputs: {
        positive: [ '7', 0 ],
        latent: [ '7', 1 ],
        vae: [ '4', 0 ],
        image: [ '21', 0 ],
        frame_idx: 0,
      },
    };
    nodes['22'] = { class_type: 'LoadImage', inputs: { image: 'last.png' } };
    nodes['24'] = {
      class_type: 'MiniMaxH3AddGuide',
      inputs: {
        positive: [ '23', 0 ],
        latent: [ '7', 1 ],
        vae: [ '4', 0 ],
        image: [ '22', 0 ],
        frame_idx: -1,
      },
    };
    positiveOut = [ '24', 0 ];
  }
  nodes['8'] = { class_type: 'RandomNoise', inputs: { noise_seed: 1 } };
  let sampleModel = [ '6', 0 ];
  let sigmaNode = [ '10', 0 ];
  if (options.pdd) {
    nodes['19'] = {
      class_type: 'MiniMaxH3PDDAccApply',
      inputs: {
        model: [ '6', 0 ],
        pdd_file: options.pdd,
        nfe: '8',
        lora_strength: 1,
        head_strength: 1,
        on_off_grid: 'error',
      },
    };
    sampleModel = [ '19', 0 ];
    sigmaNode = [ '19', 1 ];
    nodes['9'] = { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } };
  } else {
    nodes['9'] = { class_type: 'KSamplerSelect', inputs: { sampler_name: 'res_multistep' } };
    nodes['10'] = {
      class_type: 'BasicScheduler',
      inputs: { model: [ '6', 0 ], scheduler: 'simple', steps: options.steps, denoise: 1 },
    };
  }
  nodes['11'] = {
    class_type: 'BasicGuider',
    inputs: { model: sampleModel, conditioning: positiveOut },
  };
  nodes['12'] = {
    class_type: 'SamplerCustomAdvanced',
    inputs: {
      noise: [ '8', 0 ],
      guider: [ '11', 0 ],
      sampler: [ '9', 0 ],
      sigmas: sigmaNode,
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

const PROMPT_IMAGE = '一位年轻女性站在木窗边，暖色侧光落在头发上，背景是虚化的绿植，皮肤和衣服纹理清楚，真实照片。';
const PROMPT_IMAGE_EDIT = '保持 <Picture 1> 里人物的脸、发型、服装和身体不变，改成站在木窗边，暖色侧光，背景是虚化的绿植。';

function h3ImageGraph(options) {
  const nodes = {
    1: {
      class_type: 'UNETLoader',
      inputs: { unet_name: UNET_IMAGE, weight_dtype: 'default' },
    },
    2: {
      class_type: 'CLIPLoader',
      inputs: { clip_name: CLIP_BF16, type: 'minimax', device: 'default' },
    },
    3: {
      class_type: 'VAELoader',
      inputs: { vae_name: VAE_IMAGE },
    },
  };
  let condId = '4';
  if (options.edit) {
    nodes['4'] = { class_type: 'LoadImage', inputs: { image: 'reference.png' } };
    condId = '5';
  }
  nodes[condId] = {
    class_type: 'MiniMaxH3ImageConditioning',
    inputs: {
      clip: [ '2', 0 ],
      vae: [ '3', 0 ],
      prompt: options.prompt,
      width: options.width,
      height: options.height,
    },
  };
  if (options.edit) nodes[condId].inputs['images.image_1'] = [ '4', 0 ];
  const zeroId = String(Number(condId) + 1);
  const sampleId = String(Number(condId) + 2);
  const decodeId = String(Number(condId) + 3);
  const saveId = String(Number(condId) + 4);
  nodes[zeroId] = { class_type: 'ConditioningZeroOut', inputs: { conditioning: [ condId, 0 ] } };
  nodes[sampleId] = {
    class_type: 'KSampler',
    inputs: {
      model: [ '1', 0 ],
      positive: [ condId, 0 ],
      negative: [ zeroId, 0 ],
      latent_image: [ condId, 1 ],
      seed: 1,
      steps: 6,
      cfg: 1,
      sampler_name: 'euler',
      scheduler: 'simple',
      denoise: 1,
    },
  };
  nodes[decodeId] = { class_type: 'VAEDecode', inputs: { samples: [ sampleId, 0 ], vae: [ '3', 0 ] } };
  nodes[saveId] = { class_type: 'SaveImage', inputs: { images: [ decodeId, 0 ], filename_prefix: options.prefix } };
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
  {
    name: 'h3-remix-文生视频',
    category: 'text_to_video',
    suggested_vram_gb: 48,
    api_json: h3Graph({
      unet: UNET_REMIX,
      clip: CLIP_REMIX,
      prompt: PROMPT_T2V,
      steps: 8,
      prefix: 'video/h3-remix-t2v',
    }),
  },
  {
    name: '满血-h3-文生视频[RefMod]',
    category: 'text_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      prompt: PROMPT_REFMOD,
      steps: 20,
      reference: true,
      refmod: true,
      prefix: 'video/h3-full-t2v-refmod',
    }),
  },
  {
    name: '轻量-h3-文生视频[RefMod]',
    category: 'text_to_video',
    suggested_vram_gb: 24,
    api_json: h3Graph({
      // fl2va 的 int8 权重带上参考图会把 Comfy 卡死，轻量参考必须用 ref2va。
      unet: UNET_REF,
      prompt: PROMPT_REFMOD,
      steps: 20,
      reference: true,
      refmod: true,
      prefix: 'video/h3-light-t2v-refmod',
    }),
  },
  {
    name: '轻量-h3-首尾帧[RefMod]',
    category: 'image_to_video',
    suggested_vram_gb: 24,
    api_json: h3Graph({
      // fl2va 的 int8 权重带上参考图会把 Comfy 卡死，轻量参考必须用 ref2va。
      // 首尾帧不走 ImageToVideo，用 AddGuide 钉在第 0 帧；没上传尾帧时绑定会拆掉末尾那个 AddGuide。
      unet: UNET_REF,
      prompt: PROMPT_REF_FLF,
      steps: 20,
      reference: true,
      refmod: true,
      guides: true,
      prefix: 'video/h3-light-flf-refmod',
    }),
  },
  {
    name: '满血-h3-首尾帧[RefMod]',
    category: 'image_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      prompt: PROMPT_REF_FLF,
      steps: 20,
      reference: true,
      refmod: true,
      guides: true,
      prefix: 'video/h3-full-flf-refmod',
    }),
  },
  {
    name: '满血-h3-8步-文生视频[RefMod]',
    category: 'text_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      prompt: PROMPT_REFMOD,
      pdd: PDD_FL2VA,
      reference: true,
      refmod: true,
      prefix: 'video/h3-full-t2v-refmod-pdd8',
    }),
  },
  {
    name: '满血-h3-8步-首尾帧[RefMod]',
    category: 'image_to_video',
    suggested_vram_gb: 64,
    api_json: h3Graph({
      unet: UNET_FULL,
      clip: CLIP_BF16,
      prompt: PROMPT_REF_FLF,
      pdd: PDD_FL2VA,
      reference: true,
      refmod: true,
      guides: true,
      prefix: 'video/h3-full-flf-refmod-pdd8',
    }),
  },
  {
    name: 'minimax-h3-文生图',
    category: 'text_to_image',
    suggested_vram_gb: 64,
    api_json: h3ImageGraph({
      prompt: PROMPT_IMAGE,
      width: 2048,
      height: 2048,
      prefix: 'image/h3-image-t2i',
    }),
  },
  {
    name: 'minimax-h3-图生图',
    category: 'image_edit',
    suggested_vram_gb: 64,
    api_json: h3ImageGraph({
      edit: true,
      prompt: PROMPT_IMAGE_EDIT,
      width: 0,
      height: 0,
      prefix: 'image/h3-image-i2i',
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
  UNET_REMIX,
  CLIP_REMIX,
  LORA,
  LORA_DETAIL,
  LORA_M3,
  UNET_IMAGE,
  VAE_IMAGE,
  CLIP_IMAGE_PE,
};
