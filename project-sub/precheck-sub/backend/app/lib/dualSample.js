'use strict';

const SCALES = new Set([ 1.5, 2, 2.5, 3 ]);

function applyDualSample(graph, options) {
  if (!options?.enabled || !graph || typeof graph !== 'object' || Array.isArray(graph)) return graph;
  const scale = Number(options.scale);
  if (!SCALES.has(scale)) return graph;
  const next = JSON.parse(JSON.stringify(graph));
  const resampled = new Set();
  Object.entries(next).forEach(([ id, node ]) => {
    if (node?.class_type !== 'VAEDecode' || !Array.isArray(node.inputs?.samples)) return;
    const source = next[String(node.inputs.samples[0])];
    if (source?.class_type !== 'KSampler' || !source.inputs) return;
    const upId = `dual-up-${id}`;
    const passId = `dual-pass-${id}`;
    next[upId] = {
      class_type: 'LatentUpscaleBy',
      inputs: {
        samples: node.inputs.samples,
        upscale_method: 'bislerp',
        scale_by: scale,
      },
    };
    next[passId] = {
      class_type: 'KSampler',
      inputs: {
        model: source.inputs.model,
        positive: source.inputs.positive,
        negative: source.inputs.negative,
        latent_image: [ upId, 0 ],
        seed: (Number(source.inputs.seed) || 0) + 1,
        steps: source.inputs.steps,
        cfg: source.inputs.cfg,
        sampler_name: source.inputs.sampler_name,
        scheduler: source.inputs.scheduler,
        denoise: 0.35,
      },
    };
    node.inputs.samples = [ passId, 0 ];
    resampled.add(id);
  });
  Object.entries(next).forEach(([ id, node ]) => {
    if (node?.class_type !== 'CreateVideo' && node?.class_type !== 'SaveImage') return;
    const link = node.inputs?.images;
    if (!Array.isArray(link)) return;
    const sourceId = String(link[0]);
    if (next[sourceId]?.class_type !== 'VAEDecode' || resampled.has(sourceId)) return;
    const scaleId = `dual-scale-${id}`;
    next[scaleId] = {
      class_type: 'ImageScaleBy',
      inputs: {
        image: link,
        upscale_method: 'lanczos',
        scale_by: scale,
      },
    };
    node.inputs.images = [ scaleId, 0 ];
  });
  return next;
}

module.exports = { applyDualSample, SCALES };
