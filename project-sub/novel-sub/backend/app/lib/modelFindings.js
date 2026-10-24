'use strict';

function namesOf(term) {
  const plain = term?.toJSON ? term.toJSON() : term;
  const aliases = Array.isArray(plain?.aliases) ? plain.aliases : [];
  return [ plain?.name, ...aliases ].map(item => String(item || '').trim()).filter(item => item.length >= 2);
}

function redact(message, terms) {
  let text = String(message || '').trim();
  const banned = (terms || [])
    .filter(item => (item.category || item?.toJSON?.().category) === 'banned')
    .flatMap(namesOf)
    .sort((a, b) => b.length - a.length);
  banned.forEach(word => {
    if (text.includes(word)) text = text.split(word).join('禁用词');
  });
  return text.slice(0, 2000);
}

function modelIssueRows(findings, terms) {
  return (findings || []).filter(item => item && item.message).map(item => ({
    chapter_id: item.chapter_id ? String(item.chapter_id) : '',
    rule: String(item.code || item.rule || 'model').slice(0, 64),
    level: item.severity === 'error' || item.level === 'block' ? 'block' : (item.severity === 'info' || item.level === 'info' ? 'info' : 'warning'),
    message: redact(item.message, terms),
    source: 'model',
  }));
}

module.exports = { modelIssueRows, redact };
