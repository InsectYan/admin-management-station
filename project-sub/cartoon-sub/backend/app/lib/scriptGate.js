'use strict';

const PURPOSES = new Set([ '推进剧情', '揭示人物', '制造冲突', '埋设伏笔', '释放信息' ]);
const TITLE_RE = /^(内|外)(?:景)?·[^·/／、,，]{1,24}·(晨|日|昏|夜)$/;
const CAMERA_RE = /特写|近景|中景|全景|远景|大特写|极远景|内景|外景|运镜|推镜|拉镜|摇镜|跟镜|镜头/;
const MARK_RE = /【\s*场景\s*[0-9０-９一二三四五六七八九十百千]+\s*[：:][^】]{0,30}】/g;
const QUOTE_RES = [
  /「([^」]{2,80})」/g,
  /“([^”]{2,80})”/g,
  /"([^"\n]{2,80})"/g,
];

function textOf(value) {
  return String(value || '').trim();
}

function extractQuotes(text) {
  const found = [];
  const source = String(text || '');
  QUOTE_RES.forEach(re => {
    const flags = new RegExp(re.source, 'g');
    let matched = flags.exec(source);
    while (matched) {
      const line = String(matched[1] || '').trim();
      if (line) found.push(line);
      matched = flags.exec(source);
    }
  });
  return found;
}

function lookReady(look) {
  const text = textOf(look);
  const age = /岁|少年|青年|中年|老年|幼|婴儿|孩|少女|少妇|老者|年纪/;
  const hair = /发|头发|发型|光头|秃|胎发/;
  const clothes = /衣|袍|衫|裙|甲|裤|靴|装|襟|袖|冠|襁褓|巾/;
  return age.test(text) && hair.test(text) && clothes.test(text);
}

/** 一场正文里标了多个「场景N」时拆开，避免十个节点只落成一条记录。与剧本技能里的同名检查保持一致。 */
function splitEmbeddedScenes(scenes) {
  const list = Array.isArray(scenes) ? scenes : [];
  const out = [];
  list.forEach(scene => {
    const summary = textOf(scene?.summary);
    const marks = [ ...summary.matchAll(MARK_RE) ];
    if (marks.length < 2) {
      out.push(scene);
      return;
    }
    marks.forEach((mark, index) => {
      const start = mark.index;
      const end = index + 1 < marks.length ? marks[index + 1].index : summary.length;
      const chunk = summary.slice(start, end).replace(/^【\s*场景\s*[^】]*】/, '').trim();
      if (!chunk) return;
      out.push({ ...scene, summary: chunk });
    });
  });
  return out;
}

function collectIssues(script, body, minScenes) {
  const issues = [];
  const data = script && typeof script === 'object' ? script : {};
  const scenes = Array.isArray(data.scenes) ? data.scenes : [];
  const characters = Array.isArray(data.characters) ? data.characters : [];
  const omissions = Array.isArray(data.omissions) ? data.omissions : [];
  if (!textOf(data.logline)) {
    issues.push('章首要有一句话故事：谁想要什么、被什么挡住、要付什么代价');
  }
  if (!scenes.length) {
    issues.push('没有可拍场次');
    return issues;
  }
  scenes.forEach((scene, index) => {
    const nth = index + 1;
    const title = textOf(scene?.title);
    const summary = textOf(scene?.summary);
    if (!TITLE_RE.test(title)) {
      issues.push(`第${nth}场标题要写成「内·地点·日」或「外·地点·夜」，只保留一个地点`);
    }
    if (!summary) {
      issues.push(`第${nth}场没有可拍正文`);
    } else if (CAMERA_RE.test(summary)) {
      issues.push(`第${nth}场写成了景别或运镜，剧本只写能看见的动作，不替分镜调度镜头`);
    }
    if (!PURPOSES.has(textOf(scene?.purpose))) {
      issues.push(`第${nth}场要标明功能：推进剧情、揭示人物、制造冲突、埋设伏笔、释放信息`);
    }
  });
  if (!characters.length) {
    issues.push('要列出本章实际出场的人物，并写明年纪、发型和服装');
  }
  characters.forEach(item => {
    const name = textOf(item?.name) || '未命名人物';
    if (!lookReady(item?.look)) {
      issues.push(`${name}的外形要同时写明年纪、发型和服装`);
    }
  });
  const quotes = extractQuotes(body);
  if (quotes.length) {
    const joined = scenes.map(scene => textOf(scene?.summary)).join('\n');
    const missing = quotes.filter(line => !joined.includes(line));
    if (missing.length) {
      issues.push(`原文有 ${quotes.length} 句引语，其中 ${missing.length} 句没有留在场次里`);
    }
  }
  const floor = Number(minScenes) > 0 ? Math.round(Number(minScenes)) : 1;
  const gap = floor - scenes.length;
  if (gap > 0) {
    const covered = omissions.filter(item => textOf(item?.target) && textOf(item?.reason).length >= 8).length;
    if (covered < gap) {
      issues.push(`场次 ${scenes.length} 低于下限 ${floor}，合并掉的情节要拆开；确属删掉的，按少掉的场数逐条写入 omissions`);
    }
  }
  return issues;
}

function settleScript(script, body, minScenes) {
  const data = script && typeof script === 'object' ? script : {};
  const scenes = splitEmbeddedScenes(data.scenes);
  const next = { ...data, scenes };
  return {
    script: next,
    issues: collectIssues(next, body, minScenes),
  };
}

module.exports = {
  extractQuotes,
  lookReady,
  splitEmbeddedScenes,
  settleScript,
};
