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
