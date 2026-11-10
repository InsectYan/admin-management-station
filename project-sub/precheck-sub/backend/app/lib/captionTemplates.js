'use strict';

function loadImage() {
  return { class_type: 'LoadImage', inputs: { image: 'reference.png' } };
}

function previewText(source) {
  return { class_type: 'PreviewAny', inputs: { source } };
}

function qwenCaption(modelName, quantization = 'None (FP16)') {
  return {
    1: loadImage(),
    2: {
      class_type: 'AILab_QwenVL',
      inputs: {
        model_name: modelName,
        quantization,
        attention_mode: 'auto',
        preset_prompt: '🖼️ Detailed Description',
        custom_prompt: '',
        max_tokens: 512,
        keep_model_loaded: false,
        seed: 1,
        image: [ '1', 0 ],
      },
    },
    3: previewText([ '2', 0 ]),
  };
}

function qwenVideoCaption(modelName, quantization = 'None (FP16)') {
  return {
    1: { class_type: 'LoadVideo', inputs: { file: 'reference.mp4' } },
    2: { class_type: 'GetVideoComponents', inputs: { video: [ '1', 0 ] } },
    3: {
      class_type: 'AILab_QwenVL',
      inputs: {
        model_name: modelName,
        quantization,
        attention_mode: 'auto',
        preset_prompt: '📹 Video Summary',
        custom_prompt: '',
        max_tokens: 512,
        keep_model_loaded: false,
        seed: 1,
        video: [ '2', 0 ],
      },
    },
    4: previewText([ '3', 0 ]),
  };
}

const QWEN_CAPTIONS = [
  [ '反推-qwen3-vl-2b', 8, 'Qwen3-VL-2B-Instruct', 'None (FP16)' ],
  [ '反推-qwen3-vl-4b', 12, 'Qwen3-VL-4B-Instruct', 'None (FP16)' ],
  [ '反推-qwen3-vl-8b', 20, 'Qwen3-VL-8B-Instruct', 'None (FP16)' ],
  [ '反推-qwen3-vl-32b', 20, 'Qwen3-VL-32B-Instruct', '4-bit (VRAM-friendly)' ],
];

const CAPTION_TEMPLATES = [
  {
    name: '反推-joycaption-图片',
    category: 'image_to_prompt',
    suggested_vram_gb: 16,
    api_json: {
      1: loadImage(),
      2: {
        class_type: 'JC',
        inputs: {
          image: [ '1', 0 ],
          model: 'joycaption-beta-one',
          quantization: 'Balanced (8-bit)',
          prompt_style: 'Descriptive',
          caption_length: 'any',
          memory_management: 'Clear After Run',
        },
      },
      3: previewText([ '2', 0 ]),
    },
  },
  ...QWEN_CAPTIONS.flatMap(([ name, vram, model, quantization ]) => [
    {
      name: `${name}-图片`,
      category: 'image_to_prompt',
      suggested_vram_gb: vram,
      api_json: qwenCaption(model, quantization),
    },
    {
      name: `${name}-视频`,
      category: 'image_to_prompt',
      suggested_vram_gb: vram,
      api_json: qwenVideoCaption(model, quantization),
    },
  ]),
  {
    name: '反推-florence2-promptgen-图片',
    category: 'image_to_prompt',
    suggested_vram_gb: 12,
    api_json: {
      1: {
        class_type: 'Florence2ModelLoader',
        inputs: {
          model: 'Florence-2-large-PromptGen-v2.0',
          precision: 'fp16',
          convert_to_safetensors: false,
        },
      },
      2: loadImage(),
      3: {
        class_type: 'Florence2Run',
        inputs: {
          image: [ '2', 0 ],
          florence2_model: [ '1', 0 ],
          text_input: '',
          task: 'prompt_gen_mixed_caption',
          fill_mask: false,
          keep_model_loaded: false,
          max_new_tokens: 1024,
          num_beams: 3,
          do_sample: false,
          output_mask_select: '',
          seed: 1,
        },
      },
      4: previewText([ '3', 2 ]),
    },
  },
  {
    name: '反推-wd14-eva02-图片',
    category: 'image_to_prompt',
    suggested_vram_gb: 4,
    api_json: {
      1: loadImage(),
      2: {
        class_type: 'WD14Tagger|pysssss',
        inputs: {
          image: [ '1', 0 ],
          model: 'wd-eva02-large-tagger-v3.onnx',
          threshold: 0.35,
          character_threshold: 0.85,
          replace_underscore: false,
          trailing_comma: false,
          exclude_tags: '',
        },
      },
    },
  },
];

const CAPTION_RENAMES = {
  '反推-joycaption': '反推-joycaption-图片',
  '反推-florence2-promptgen': '反推-florence2-promptgen-图片',
  '反推-wd14-eva02': '反推-wd14-eva02-图片',
};
QWEN_CAPTIONS.forEach(([ name ]) => {
  CAPTION_RENAMES[name] = `${name}-图片`;
});

module.exports = { CAPTION_TEMPLATES, CAPTION_RENAMES };
