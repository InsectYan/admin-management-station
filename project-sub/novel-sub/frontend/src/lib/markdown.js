'use strict';

import MarkdownItModule from 'markdown-it';
import DOMPurify from 'dompurify';

const MarkdownIt = MarkdownItModule.default || MarkdownItModule;

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
});

const defaultLinkOpen = md.renderer.rules.link_open || function linkOpen(tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = function linkOpen(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const href = token.attrGet('href') || '';
  if (/^(javascript|data|vbscript):/i.test(href)) {
    token.attrSet('href', '#');
  } else {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

const PURIFY_OPTIONS = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'rel'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
};

export function renderMarkdown(source) {
  const text = String(source ?? '').trim();
  if (!text) return '';
  return DOMPurify.sanitize(md.render(text), PURIFY_OPTIONS);
}
