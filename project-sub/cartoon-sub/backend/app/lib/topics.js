'use strict';

const TOPIC_OPTIONS = [
  { value: 'av', label: 'AV' },
  { value: 'fitness', label: '健身' },
];

const TOPIC_VALUES = new Set(TOPIC_OPTIONS.map(item => item.value));

function topicAllowed(contentTypeId) {
  return contentTypeId === 'ai_comic' || contentTypeId === 'ai_short';
}

function topicList(value) {
  let raw = value;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    try {
      raw = JSON.parse(text);
    } catch (err) {
      raw = text.split(/[,，]/);
    }
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const list = [];
  raw.forEach(item => {
    const key = String(item || '').trim();
    if (!TOPIC_VALUES.has(key) || seen.has(key)) return;
    seen.add(key);
    list.push(key);
  });
  return list;
}

function topicsOf(project) {
  const stored = topicList(project?.topics);
  if (stored.length) return stored;
  if (project?.av_mode) return [ 'av' ];
  return [];
}

function topicPatch(contentTypeId, payload, existing) {
  if (!topicAllowed(contentTypeId)) {
    return { topics: '[]', av_mode: false };
  }
  let list;
  if (payload && payload.topics !== undefined) list = topicList(payload.topics);
  else if (payload && payload.av_mode !== undefined) list = payload.av_mode ? [ 'av' ] : topicsOf(existing).filter(item => item !== 'av');
  else list = topicsOf(existing);
  return {
    topics: JSON.stringify(list),
    av_mode: list.includes('av'),
  };
}

module.exports = {
  TOPIC_OPTIONS,
  topicList,
  topicsOf,
  topicPatch,
  topicAllowed,
};
