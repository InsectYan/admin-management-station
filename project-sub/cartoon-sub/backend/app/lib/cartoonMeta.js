'use strict';

function style(value, name, note, group, prompt) {
  const label = `${name}【${note}】`;
  return {
    value,
    name,
    note,
    label,
    group,
    prompt: prompt || `${name}风格：${note}`,
  };
}

const VISUAL_STYLES = [
  // 3D 类（漫剧）
  style('3d-guofeng-xuanhuan', '3D 古风玄幻国漫', '如《斗罗大陆》《完美世界》等国漫 3D 风格，角色建模精致，光影柔和，色彩饱和', '3D 类（漫剧）'),
  style('3d-neo-guofeng', '3D 新三维国风', '融合传统国风美学与现代三维技术，典雅细腻，温润色彩（如《凡人修仙传》《眷思量》）', '3D 类（漫剧）'),
  style('3d-modern', '3D 现代风格', '现代都市题材，贴近真实人物但略带美化，服装时尚，场景写实', '3D 类（漫剧）'),
  style('3d-cyberpunk', '3D 赛博朋克', '高对比霓虹色调，机械义体，未来都市，科技感与颓废感并存', '3D 类（漫剧）'),
  style('3d-scifi-real', '3D 科幻写实', '近未来科幻风格，硬表面建模，真实光影，强调科技感', '3D 类（漫剧）'),
  style('3d-beauty-cg', '3D 渲染美型', '偏向精美 CG，如暴雪 CG、最终幻想风格，角色俊美，光影华丽', '3D 类（漫剧）'),
  style('3d-game-engine', '3D 游戏引擎级', '如《最后生还者》《战神》级别，次世代游戏角色，极致细节', '3D 类（漫剧）'),
  style('3d-unreal', '3D 虚幻引擎', '最新的 Lumen 全局光照，极致真实感，动态光影，光线追踪', '3D 类（漫剧）'),
  style('3d-toon', '3D 卡通渲染', '如《原神》《塞尔达传说》，3D 建模但渲染成卡通效果，色彩鲜艳', '3D 类（漫剧）'),
  style('3d-handpaint', '3D 手绘风', '3D 模型叠加手绘纹理，如《无主之地》系列，有手绘笔触感', '3D 类（漫剧）'),
  style('3d-clay', '3D 黏土动画风', '如《小羊肖恩》，黏土质感，定格动画效果', '3D 类（漫剧）'),

  // CG/插画类（漫剧）
  style('impasto-real', '厚涂写实', '插画师厚涂技法，有笔触感但非常写实，常用于概念设计', 'CG/插画类（漫剧）'),
  style('thin-wash', '薄涂清新', '水彩或淡彩风格，颜色清透，线条柔和，适合治愈系', 'CG/插画类（漫剧）'),
  style('western-commercial', '欧美商业插画', '如《英雄联盟》卡池图，色彩饱和度高，角色动态感强', 'CG/插画类（漫剧）'),
  style('jp-real-illust', '日系写实插画', '如新海诚、吉卜力写实向，背景细腻', 'CG/插画类（漫剧）'),
  style('guofeng-illust', '古风插画', '中国传统工笔或水墨风格，线条流畅，色彩淡雅', 'CG/插画类（漫剧）'),
  style('fantasy-illust', '奇幻插画', '如《万智牌》插画，奇幻题材，细节丰富，光影强烈', 'CG/插画类（漫剧）'),
  style('scifi-illust', '科幻插画', '未来主义，机械设计，硬表面，常与赛博朋克结合', 'CG/插画类（漫剧）'),
  style('fairy-illust', '童话插画', '色彩柔和，线条圆润，充满想象力', 'CG/插画类（漫剧）'),
  style('vector-illust', '矢量插画', '扁平化风格，色块清晰，线条简洁', 'CG/插画类（漫剧）'),
  style('ink-wash-color', '钢笔淡彩', '钢笔线条勾勒，水彩填色，清新自然', 'CG/插画类（漫剧）'),

  // 二次元类（漫剧）
  style('anime-jp-std', '日系动漫', '标准日式动画风格，赛璐珞上色，线条清晰', '二次元类（漫剧）'),
  style('anime-cn-guoman', '国漫风', '如《哪吒》《白蛇》，融合中国元素', '二次元类（漫剧）'),
  style('light-novel', '轻小说插画', '柔和明亮，适合青春、日常，角色美型', '二次元类（漫剧）'),
  style('moe-anime', '萌系动漫', '如《K-ON!》，大眼睛，软萌，色彩粉嫩', '二次元类（漫剧）'),
  style('shonen-hotblood', '热血少年漫', '如《海贼王》《火影忍者》，线条粗犷，动感强', '二次元类（漫剧）'),
  style('shoujo-manga', '少女漫', '如《NANA》，细腻，睫毛精，花朵背景', '二次元类（漫剧）'),
  style('mecha-anime', '机甲动漫', '如《高达》系列，机械设定，硬朗线条', '二次元类（漫剧）'),
  style('isekai-fantasy', '异世界奇幻', '如《Re:0》，奇幻元素，角色精致', '二次元类（漫剧）'),
  style('kyoani', '京都动画风', '细腻的人物作画，柔和的色彩，真实系', '二次元类（漫剧）'),
  style('ufotable', 'ufotable 风', '如《鬼灭之刃》，摄影处理华丽，特效丰富', '二次元类（漫剧）'),

  // 概念设计类（漫剧）
  style('char-concept', '角色概念原画', '强调角色设计，线稿+色块，突出服装、道具、姿态', '概念设计类（漫剧）'),
  style('scene-concept', '场景概念原画', '强调环境氛围，构图宏大，光影强烈，细节丰富', '概念设计类（漫剧）'),
  style('prop-concept', '道具概念设计', '专注武器、载具、关键物品的设计图', '概念设计类（漫剧）'),
  style('dark-concept', '暗黑风格概念', '高对比，阴郁氛围，适合反派或末世题材', '概念设计类（漫剧）'),
  style('scifi-concept', '科幻概念', '未来科技，硬表面，冷色调，蓝图风格', '概念设计类（漫剧）'),
  style('fantasy-concept', '奇幻概念', '魔法世界，自然元素，温暖色调，神秘感', '概念设计类（漫剧）'),
  style('ink-concept', '水墨概念', '中国传统水墨渲染，留白，意境，适合武侠仙侠', '概念设计类（漫剧）'),
  style('industrial-concept', '工业设计概念', '如汽车、机械设计，线稿+渲染，强调功能性', '概念设计类（漫剧）'),

  // 写实类（真人剧）
  style('commercial-photo', '商业摄影写实', '如时尚杂志封面，光影精致，皮肤质感细腻，略带美化', '写实类（真人剧）'),
  style('documentary-photo', '纪实摄影写实', '如新闻摄影，真实自然，不刻意美化，保留皮肤纹理', '写实类（真人剧）'),
  style('cinematic-real', '电影质感写实', '好莱坞大片级别，光影氛围浓厚，略带艺术处理', '写实类（真人剧）'),
  style('portrait-retouch', '人像精修写实', '如专业人像摄影后期，皮肤光滑，眼神光清晰', '写实类（真人剧）'),
  style('raw-photo', 'RAW 风格写实', '如相机原始格式，细节丰富，色调中性，可后期调色', '写实类（真人剧）'),
  style('bw-film', '黑白胶片写实', '黑白摄影风格，颗粒感，高对比，复古质感', '写实类（真人剧）'),
  style('macro-photo', '微距摄影写实', '极致细节，如昆虫、花卉的微距摄影', '写实类（真人剧）'),

  // 经典艺术类（真人剧）
  style('classic-oil', '古典油画', '伦勃朗光线，油画质感，厚重笔触', '经典艺术类（真人剧）'),
  style('impressionist-oil', '印象派油画', '光影斑驳，色彩鲜艳，笔触松散', '经典艺术类（真人剧）'),
  style('watercolor-art', '水彩风', '柔和通透，适合唯美、古风角色，纸张纹理', '经典艺术类（真人剧）'),
  style('sketch-draw', '素描/速写', '单色线条感，适合概念草图，炭笔或铅笔质感', '经典艺术类（真人剧）'),
  style('printmaking', '版画', '木刻或铜版画风格，线条硬朗，黑白对比强', '经典艺术类（真人剧）'),
  style('mural-dunhuang', '壁画', '如敦煌壁画风格，earthy 色调，斑驳质感', '经典艺术类（真人剧）'),
  style('tempera', '蛋彩画', '文艺复兴前技法，色彩温润，细节细腻', '经典艺术类（真人剧）'),
  style('pastel', '色粉画', '柔和朦胧，适合肖像，粉质感', '经典艺术类（真人剧）', '色粉画风格：柔和朦胧，适合肖像，粉质颗粒触感，边缘柔化，粉质肌理明显'),

  // 影视风格
  style('film-80s-us', '80 年代美剧风', '颗粒感 + 怀旧音乐 + 大字体标题', '影视风格'),
  style('film-90s-idol', '90 年代偶像剧风格', '柔焦 + 梦幻滤镜 + 夸张表情', '影视风格'),
  style('film-crime-chase', '警匪片风格', '紧张节奏 + 追逐镜头 + 低光场景', '影视风格'),
  style('film-campus', '校园青春风格', '明亮色彩 + 对称构图 + 轻音乐', '影视风格'),
  style('film-disaster', '灾难电影风格', '剧烈晃动 + 闪回叠化 + 广角特写', '影视风格'),
  style('film-scifi-exp', '科幻实验片风格', '霓虹光 + 深色调 + 镜面反射', '影视风格'),
  style('film-stage', '舞台剧改编影像风', '高对比黑白 + 台词为主', '影视风格'),
  style('film-religious', '宗教主题风格', '庄严色调 + 静态构图', '影视风格'),
  style('film-realism', '现实主义电影风格', '自然光 + 非演员 + 长镜头', '影视风格'),
  style('film-psycho', '心理惊悚片风格', '镜头错位 + 昏暗光影 + 变焦特写', '影视风格'),
  style('film-urban-crime', '城市犯罪片风', '夜景霓虹 + 快节奏剪辑', '影视风格'),
  style('film-folk', '民族文化电影风格', '传统服饰 + 地方音乐 + 自然环境', '影视风格'),
  style('film-future-scifi', '未来科幻风格', '金属感强 + HUD 叠加界面', '影视风格'),
  style('film-revenge', '复仇主题风格', '慢镜头 + 阴郁配乐 + 特写眼神', '影视风格'),
  style('film-jp-youth', '青春日剧风格', '清淡色调 + 浅景深 + 柔和光线', '影视风格'),
  style('film-british', '英伦剧情风格', '暗色复古 + 室内烛光 + 对称构图', '影视风格'),
  style('film-battlefield', '战地纪实风格', '手持抖动 + 高对比 + 爆炸环境', '影视风格'),
  style('film-cyber-east', '赛博东亚风', '汉字霓虹 + 摩天楼林立 + 杂乱城市', '影视风格'),
  style('film-indie-west', '欧美独立电影风', '低饱和 + 空镜 + 叙事碎片化', '影视风格'),
  style('film-time-travel', '短剧穿越风格', '古今混搭 + 快速变装 + 场景拼接', '影视风格'),
  style('film-survival', '荒野生存剧风', '自然光 + 环境音强 + 沉浸追随', '影视风格'),
  style('film-french-romance', '法语爱情片风格', '长镜 + 低语对白 + 街拍质感', '影视风格'),
  style('film-horror', '恐怖片风格', '压暗光线 + 突变音效 + 主观镜头', '影视风格'),
  style('film-live-fairy', '真人童话风格', '饱和梦境色 + 慢节奏', '影视风格'),
  style('film-apocalypse', '末世电影风格', '破败城市 + 灰黄色调 + 广角', '影视风格'),
  style('film-spy', '谍战片风格', '暗房 + 电话亭 + 帽子眼神特写', '影视风格'),
  style('film-cold-war', '俄式冷战风格', '蓝灰调 + 低色温 + 大量字幕叠加', '影视风格'),
  style('film-childhood', '童年回忆片风格', '黄调复古 + 慢镜头 + 自然音效', '影视风格'),
  style('film-detective', '警探剧风格', '玻璃写字板 + 白板推理 + 悬疑配乐', '影视风格'),
  style('film-xuanhuan-guofeng', '玄幻国风片', '飘带 + 云雾特效 + 红青对撞', '影视风格'),
  style('film-crime-reenact', '罪案还原剧风', '现场还原 + 旁白 + 模糊人物', '影视风格'),
  style('film-jp-late-night', '日式深夜剧风格', '微光环境 + 封闭空间 + 吃饭动作', '影视风格'),
  style('film-doomsday-traveler', '末日旅人风格', '破败 + 独行 + 极简对话', '影视风格'),
  style('film-hitchcock', '希区柯克悬疑风', '固定机位 + 交替剪辑 + 低音乐', '影视风格'),
  style('film-wong-kar-wai', '王家卫电影风格', '慢镜头 + 模糊边缘 + 饱和色彩', '影视风格'),
  style('film-nolan', '诺兰式倒叙结构', '非线性时间轴 + 暗色调', '影视风格'),
  style('film-kurosawa', '黑泽明剧场感', '高反差黑白影调 + 固定机位', '影视风格'),
  style('film-hk-neon', '港片光影风格', '霓虹反光 + 快速切换镜头', '影视风格'),
  style('film-kdrama-romance', '韩剧慢镜头浪漫', '柔光 + 背景虚化 + 配乐旋律', '影视风格'),
  style('film-miyazaki', '宫崎骏动画感', '自然色彩 + 清新构图 + 手绘质感', '影视风格'),
  style('film-marvel', '漫威大片感', '大场景 + 爆炸特效 + CG 合成', '影视风格'),
  style('film-pixar', '皮克斯动画质感', '明亮色彩 + 卡通建模 + 情感流动', '影视风格'),
  style('film-zhang-yimou', '张艺谋色彩对比风格', '红绿对撞 + 对称构图', '影视风格'),
  style('film-ang-lee', '李安东方写实风', '自然光线 + 内敛情绪', '影视风格'),
  style('film-western', '西部片风格', '荒漠远景 + 冷暖对比 + 低角度', '影视风格'),
  style('film-french-art', '法式文艺风', '碎片叙事 + 自然光影 + 低饱和', '影视风格'),
  style('film-doc', '纪录片感', '自然光 + 镜头抖动 + 真实色调', '影视风格'),
  style('film-hk-nostalgia', '港风怀旧感', '黄色滤镜 + 慢动作走位', '影视风格'),
  style('film-noir', '黑色电影风格', '强光阴影 + 硬汉独白 + 反光雨夜', '影视风格'),
  style('film-us-youth', '美式青春片风格', '明快节奏 + 活力色彩', '影视风格'),
  style('film-bollywood', '印度歌舞片风格', '高饱和 + 快速剪辑 + 群舞镜头', '影视风格'),
  style('film-euro-cold', '欧洲冷感系', '灰白色调 + 极简构图', '影视风格'),
  style('film-bbc-doc', 'BBC 纪录片感', '精致构图 + 慢推镜头 + 旁白配音', '影视风格'),
  style('film-netflix-thriller', 'Netflix 惊悚剧风格', '低光源 + 突变音效 + 细节特写', '影视风格'),
  style('film-doc-handheld', '纪录片手持风格', '真实环境光 + 轻微镜头晃动', '影视风格'),
  style('film-romanticism', '浪漫主义镜头', '柔光 + 色彩渐变 + 慢速推镜', '影视风格'),
  style('film-new-wave', '新浪潮电影风格', '突兀剪辑 + 非逻辑叙事', '影视风格'),
  style('film-absurd', '荒诞剧风格', '怪异构图 + 夸张表演 + 低饱和', '影视风格'),
  style('film-theatre', '剧场舞台风', '静态构图 + 中心打光 + 对称', '影视风格'),
  style('film-dystopia', '反乌托邦电影风格', '灰蓝色调 + 压抑空间', '影视风格'),

  // 兼容旧项目已存 value，避免更新时报枚举错误
  style('anime-jp', '日漫', '标准日式动画风格，赛璐珞上色，线条清晰', '兼容旧项'),
  style('anime-cn', '国漫', '融合中国元素的国漫画面', '兼容旧项'),
  style('cel', '赛璐璐', '赛璐珞平涂上色，线条清晰', '兼容旧项'),
  style('shinkai', '新海诚', '如新海诚写实向，背景细腻，光影通透', '兼容旧项'),
  style('ghibli', '吉卜力', '自然色彩 + 清新构图 + 手绘质感', '兼容旧项'),
  style('shoujo', '少女漫', '细腻，睫毛精，花朵背景', '兼容旧项'),
  style('manga-bw', '黑白漫画', '黑白线稿与网点，漫画分镜感', '兼容旧项'),
  style('comic-us', '美漫', '欧美漫画块面与高动态构图', '兼容旧项'),
  style('webtoon', '韩漫条漫', '竖屏条漫构图，清爽上色', '兼容旧项'),
  style('chibi', 'Q版', '头身比夸张的可爱变形风格', '兼容旧项'),
  style('motion-comic', '动态漫', '漫画分镜加有限动画与运镜', '兼容旧项'),
  style('anime-3d', '三维动画', '三维角色建模与动画渲染', '兼容旧项'),
  style('toon-shader', '三渲二', '三维建模卡通着色', '兼容旧项'),
  style('pixar', '皮克斯', '明亮色彩 + 卡通建模 + 情感流动', '兼容旧项'),
  style('realistic', '写实', '写实光影与材质', '兼容旧项'),
  style('semi-real', '半写实', '介于卡通与写实之间的半写实渲染', '兼容旧项'),
  style('cinematic', '电影感', '电影光影氛围与镜头语言', '兼容旧项'),
  style('film', '复古胶片', '胶片颗粒与复古色调', '兼容旧项'),
  style('impasto', '厚涂', '厚涂笔触与体积感', '兼容旧项'),
  style('watercolor', '水彩', '柔和通透，纸张纹理', '兼容旧项'),
  style('oil', '油画', '油画质感，厚重笔触', '兼容旧项'),
  style('ink', '水墨', '水墨渲染，留白意境', '兼容旧项'),
  style('ink-wuxia', '武侠水墨', '武侠题材水墨写意', '兼容旧项'),
  style('gongbi', '工笔', '工笔细线与淡雅设色', '兼容旧项'),
  style('guofeng', '古风国风', '中国传统美学与服饰场景', '兼容旧项'),
  style('neo-guofeng', '新国风', '传统国风与现代视觉结合', '兼容旧项'),
  style('dunhuang', '敦煌', '敦煌壁画色调与斑驳质感', '兼容旧项'),
  style('ukiyoe', '浮世绘', '浮世绘平面色块与线条', '兼容旧项'),
  style('xianxia', '仙侠', '仙侠云雾、飘带与灵气特效', '兼容旧项'),
  style('illustration', '商业插画', '商业插画饱和色彩与动态感', '兼容旧项'),
  style('concept', '概念原画', '概念设计线稿与色块', '兼容旧项'),
  style('picture-book', '绘本', '绘本柔和造型与叙事插图', '兼容旧项'),
  style('fairy', '童话', '童话柔和色彩与圆润造型', '兼容旧项'),
  style('flat', '扁平', '扁平色块与简洁线条', '兼容旧项'),
  style('sketch', '素描', '单色素描线条感', '兼容旧项'),
  style('lineart', '线稿', '干净线稿为主', '兼容旧项'),
  style('pixel', '像素', '像素块面与复古游戏感', '兼容旧项'),
  style('clay', '黏土', '黏土定格动画质感', '兼容旧项'),
  style('papercut', '剪纸', '剪纸层叠与剪影轮廓', '兼容旧项'),
  style('lowpoly', '低多边形', '低多边形几何面片', '兼容旧项'),
  style('cyber', '赛博朋克', '霓虹高对比与未来都市', '兼容旧项'),
  style('steampunk', '蒸汽朋克', '黄铜机械与维多利亚工业美学', '兼容旧项'),
  style('vaporwave', '蒸汽波', '复古电子色与错位排版感', '兼容旧项'),
  style('gothic', '哥特', '哥特建筑与暗色服饰氛围', '兼容旧项'),
  style('dark', '暗黑', '高对比阴郁暗黑氛围', '兼容旧项'),
  style('horror', '惊悚漫画', '惊悚构图与压迫光影', '兼容旧项'),
  style('campus', '校园清新', '明亮校园日常清新色调', '兼容旧项'),
];

const SHOT_SIZES = [ '极远景', '远景', '全景', '中景', '近景', '特写', '大特写' ];
const CAMERA_MOVES = [ '固定', '推', '急推', '拉', '急拉', '摇', '移', '跟', '升', '降', '甩', '震颤', '旋转' ];

const XIANXIA_STYLE_VALUES = new Set([
  '3d-guofeng-xuanhuan',
  '3d-neo-guofeng',
  'guofeng-illust',
  'ink-concept',
  'film-xuanhuan-guofeng',
  'xianxia',
  'ink-wuxia',
  'guofeng',
  'neo-guofeng',
  'gongbi',
  'ink',
  'dunhuang',
]);

const XIANXIA_TEXT_RE = /修仙|仙侠|玄幻|神魔|飞升|灵气|御剑|丹药|宗门|法宝|法器|灵根|渡劫|筑基|金丹|元婴|化神|凡人修仙|仙门|灵石|剑修|体修/;

function styleOf(value) {
  const key = String(value || '').trim();
  if (!key) return null;
  return VISUAL_STYLES.find(item => item.value === key) || null;
}

function stylePromptOf(value) {
  const hit = styleOf(value);
  if (!hit) return String(value || '').trim();
  return hit.prompt || `${hit.name}风格：${hit.note}`;
}

function styleLabelOf(value) {
  const hit = styleOf(value);
  if (!hit) return String(value || '').trim();
  return hit.label;
}

function detectXianxia(input = {}) {
  if (input.is_xianxia === true || input.is_xianxia === 1 || input.is_xianxia === '1' || input.is_xianxia === 'true') {
    return true;
  }
  if (input.is_xianxia === false || input.is_xianxia === 0 || input.is_xianxia === '0' || input.is_xianxia === 'false') {
    return false;
  }
  const styleValue = String(input.visual_style || '').trim();
  if (XIANXIA_STYLE_VALUES.has(styleValue)) return true;
  const text = [
    styleValue,
    input.visual_style_label,
    input.genre,
    input.genre_subcategory,
    input.novel_type,
    input.title,
    input.summary,
    input.story_overview,
    input.chapter_title,
    input.body,
  ].filter(Boolean).join('\n');
  return XIANXIA_TEXT_RE.test(text);
}

function assertEnum(value, options, label) {
  const text = String(value || '').trim();
  if (!text) return '';
  const allowed = options.map(item => (typeof item === 'string' ? item : item.value));
  if (!allowed.includes(text)) {
    const err = new Error(`${label}不在可选范围内`);
    err.status = 400;
    throw err;
  }
  return text;
}

function normalizeOneShotSize(value) {
  const text = String(value || '').trim();
  if (SHOT_SIZES.includes(text)) return text;
  if (/大特写|极特写/.test(text)) return '大特写';
  if (/特写|微距/.test(text)) return '特写';
  if (/近景/.test(text)) return '近景';
  if (/中景|半身/.test(text)) return '中景';
  if (/全景|全身/.test(text)) return '全景';
  if (/极远|大远/.test(text)) return '极远景';
  if (/远景/.test(text)) return '远景';
  return '';
}

/** 主景别多选：接受数组 / 逗号串 / 单值，返回去重后的合法景别列表 */
function normalizeShotSizes(value, fallback = '中景') {
  let raw = [];
  if (Array.isArray(value)) raw = value;
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.shot_sizes)) raw = value.shot_sizes;
    else if (value.shot_size != null) raw = Array.isArray(value.shot_size) ? value.shot_size : [ value.shot_size ];
  } else if (value != null && value !== '') {
    raw = String(value).split(/[,，、|/]+/);
  }
  const list = [];
  for (const item of raw) {
    const size = normalizeOneShotSize(item);
    if (size && !list.includes(size)) list.push(size);
  }
  if (!list.length) {
    const fb = normalizeOneShotSize(fallback) || '中景';
    return [ fb ];
  }
  return list;
}

function serializeShotSizes(value, fallback = '中景') {
  return normalizeShotSizes(value, fallback).join(',');
}

function assertShotSizes(value, label = '景别') {
  const list = normalizeShotSizes(value);
  for (const item of list) {
    assertEnum(item, SHOT_SIZES, label);
  }
  return serializeShotSizes(list);
}

function matchCameraMove(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (CAMERA_MOVES.includes(text)) return text;
  if (/急推|快速推/.test(text)) return '急推';
  if (/急拉|快速拉/.test(text)) return '急拉';
  if (/推/.test(text)) return '推';
  if (/拉/.test(text)) return '拉';
  if (/摇/.test(text)) return '摇';
  if (/移|横移/.test(text)) return '移';
  if (/跟/.test(text)) return '跟';
  if (/升/.test(text)) return '升';
  if (/降/.test(text)) return '降';
  if (/甩/.test(text)) return '甩';
  if (/震|抖/.test(text)) return '震颤';
  if (/旋|环绕/.test(text)) return '旋转';
  if (/固定/.test(text)) return '固定';
  return '';
}

/** 运镜多选：接受数组 / 逗号、顿号、箭头串，按出现顺序去重 */
function normalizeCameraMoves(value, fallback = '固定') {
  let raw = [];
  if (Array.isArray(value)) raw = value;
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.camera_moves)) raw = value.camera_moves;
    else if (value.camera_move != null) raw = Array.isArray(value.camera_move) ? value.camera_move : [ value.camera_move ];
  } else if (value != null && value !== '') {
    raw = String(value).split(/[,，、|/→>]+/);
  }
  const list = [];
  for (const item of raw) {
    const move = matchCameraMove(item);
    if (move && !list.includes(move)) list.push(move);
  }
  if (!list.length) return [ matchCameraMove(fallback) || '固定' ];
  return list;
}

function serializeCameraMoves(value, fallback = '固定') {
  return normalizeCameraMoves(value, fallback).join(',');
}

function assertCameraMoves(value, label = '运镜') {
  const list = normalizeCameraMoves(value);
  for (const item of list) {
    assertEnum(item, CAMERA_MOVES, label);
  }
  return serializeCameraMoves(list);
}

module.exports = {
  VISUAL_STYLES,
  SHOT_SIZES,
  CAMERA_MOVES,
  XIANXIA_STYLE_VALUES,
  styleOf,
  stylePromptOf,
  styleLabelOf,
  detectXianxia,
  assertEnum,
  normalizeOneShotSize,
  normalizeShotSizes,
  serializeShotSizes,
  assertShotSizes,
  normalizeCameraMoves,
  serializeCameraMoves,
  assertCameraMoves,
  meta() {
    return {
      visual_styles: VISUAL_STYLES.map(item => ({
        value: item.value,
        label: item.label,
        name: item.name,
        note: item.note,
        prompt: item.prompt,
        group: item.group,
      })),
      shot_sizes: SHOT_SIZES,
      camera_moves: CAMERA_MOVES,
    };
  },
};
