import { defineStore } from 'pinia';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function reflow(edit) {
  const video = edit?.tracks?.find(track => track.kind === 'video');
  if (!video) return;
  video.clips.sort((a, b) => a.sort_order - b.sort_order);
  let cursor = 0;
  video.clips.forEach((clip, index) => {
    clip.sort_order = index;
    clip.start_ms = cursor;
    cursor += Number(clip.duration_ms) || 0;
  });
  edit.duration_ms = cursor;
}

export const useEditTimelineStore = defineStore('editTimeline', {
  state: () => ({
    project: null,
    edit: null,
    videos: [],
    exports: [],
    tools: { ffmpeg: false, ffprobe: false, ffmpeg_version: '' },
    playheadMs: 0,
    playing: false,
    selectedClipId: null,
    seekSerial: 0,
    past: [],
    future: [],
    dirty: false,
    gesture: false,
    snapshot: null,
  }),
  getters: {
    videoTrack(state) {
      return state.edit?.tracks?.find(track => track.kind === 'video') || null;
    },
    clips() {
      return (this.videoTrack?.clips || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    },
  },
  actions: {
    useLatestPerShot() {
      const track = this.videoTrack;
      if (!track || !this.edit) return false;
      const playable = (this.videos || []).filter(item => item.shot_id && !item.missing && item.duration_ms);
      const latest = new Map();
      playable.forEach(item => {
        const prev = latest.get(item.shot_id);
        if (!prev || item.id > prev.id) latest.set(item.shot_id, item);
      });
      const videoById = new Map((this.videos || []).map(item => [ item.id, item ]));
      const usedShots = new Set();
      let changed = false;
      track.clips.forEach(clip => {
        const shotId = videoById.get(clip.source_output_id)?.shot_id;
        if (!shotId) return;
        usedShots.add(shotId);
        const next = latest.get(shotId);
        if (!next || next.id === clip.source_output_id) return;
        clip.source_output_id = next.id;
        clip.trim_in_ms = 0;
        clip.duration_ms = next.duration_ms;
        clip.missing = false;
        clip.source_duration_ms = next.duration_ms;
        clip.shot_description = next.description || '';
        changed = true;
      });
      const extras = [ ...latest.values() ]
        .filter(item => !usedShots.has(item.shot_id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.shot_id - b.shot_id);
      extras.forEach((item, index) => {
        track.clips.push({
          id: -1 - index,
          sort_order: track.clips.length,
          source_output_id: item.id,
          start_ms: 0,
          duration_ms: item.duration_ms,
          trim_in_ms: 0,
          text: '',
          missing: false,
          source_duration_ms: item.duration_ms,
          shot_description: item.description || '',
        });
        changed = true;
      });
      if (!changed) return false;
      reflow(this.edit);
      this.dirty = true;
      this.selectedClipId = this.clips[0]?.id || null;
      return true;
    },
    applyPayload(payload) {
      this.project = payload.project;
      this.edit = payload.edit;
      this.videos = payload.videos || [];
      this.exports = payload.exports || [];
      this.tools = payload.tools || this.tools;
      this.past = [];
      this.future = [];
      this.dirty = false;
      this.gesture = false;
      this.snapshot = null;
      this.playing = false;
      this.playheadMs = 0;
      this.seekSerial += 1;
      this.selectedClipId = this.clips[0]?.id || null;
    },
    begin() {
      if (!this.edit || this.gesture) return;
      this.snapshot = clone(this.edit);
      this.gesture = true;
      this.dirty = true;
    },
    end() {
      if (!this.gesture) return;
      this.gesture = false;
      const changed = this.snapshot && JSON.stringify(this.snapshot) !== JSON.stringify(this.edit);
      if (changed) {
        this.past.push(this.snapshot);
        if (this.past.length > 50) this.past.shift();
        this.future = [];
        this.dirty = true;
      } else if (!this.past.length) {
        this.dirty = false;
      }
      this.snapshot = null;
    },
    touch() {
      if (this.edit) reflow(this.edit);
    },
    undo() {
      if (!this.past.length || !this.edit || this.gesture) return;
      this.future.push(clone(this.edit));
      this.edit = this.past.pop();
      this.dirty = true;
      this.playing = false;
    },
    redo() {
      if (!this.future.length || this.gesture) return;
      this.past.push(clone(this.edit));
      this.edit = this.future.pop();
      this.dirty = true;
      this.playing = false;
    },
    seek(ms) {
      const max = this.edit?.duration_ms || 0;
      const next = Math.max(0, Math.min(Math.round(ms), Math.max(0, max - 1)));
      this.playheadMs = next;
      this.seekSerial += 1;
    },
    selectClip(id) {
      this.selectedClipId = id;
    },
    reorder(from, to) {
      const clips = this.videoTrack?.clips;
      if (!clips || from === to || from < 0 || to < 0 || from >= clips.length || to >= clips.length) return;
      const [item] = clips.splice(from, 1);
      clips.splice(to, 0, item);
      this.touch();
    },
    updateClip(id, patch) {
      const clip = this.videoTrack?.clips?.find(item => item.id === id);
      if (!clip) return;
      Object.assign(clip, patch);
      this.touch();
    },
    setCanvas(width, height) {
      if (!this.edit) return;
      if (this.edit.width === width && this.edit.height === height) return;
      this.begin();
      this.edit.width = width;
      this.edit.height = height;
      this.end();
    },
  },
});
