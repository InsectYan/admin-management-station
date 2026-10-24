'use strict';

const PRESETS = {
  landscape: {
    label: '横屏',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate_kbps: 4000,
    format: 'mp4',
    subtitle_mode: 'burn',
    voice_track: true,
    bgm_track: false,
  },
  portrait: {
    label: '竖屏',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate_kbps: 4000,
    format: 'mp4',
    subtitle_mode: 'burn',
    voice_track: true,
    bgm_track: false,
  },
  tablet: {
    label: '平板',
    width: 1080,
    height: 1440,
    fps: 30,
    bitrate_kbps: 3000,
    format: 'mp4',
    subtitle_mode: 'burn',
    voice_track: true,
    bgm_track: false,
  },
  short: {
    label: '短版',
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate_kbps: 2500,
    format: 'mp4',
    subtitle_mode: 'burn',
    voice_track: true,
    bgm_track: false,
  },
  long: {
    label: '长版',
    width: 1920,
    height: 1080,
    fps: 24,
    bitrate_kbps: 6000,
    format: 'mp4',
    subtitle_mode: 'burn',
    voice_track: true,
    bgm_track: true,
  },
  no_subtitle: {
    label: '无字幕',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate_kbps: 4000,
    format: 'mp4',
    subtitle_mode: 'none',
    voice_track: true,
    bgm_track: false,
  },
  multi_lang: {
    label: '多语种',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate_kbps: 4000,
    format: 'mp4',
    subtitle_mode: 'sidecar',
    voice_track: true,
    bgm_track: false,
  },
};

function presetList() {
  return Object.entries(PRESETS).map(([ id, item ]) => ({ id, label: item.label }));
}

function presetOf(id) {
  return PRESETS[id] || null;
}

module.exports = { PRESETS, presetList, presetOf };
