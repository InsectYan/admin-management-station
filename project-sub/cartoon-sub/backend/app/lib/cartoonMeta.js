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
  style('3d-guofeng-xuanhuan', '3D 古风玄幻国漫', '如《斗罗大陆》《完美世界》等国漫 3D 风格，角色建模精致，光影柔和，色彩饱和', '3D 类（漫剧）', '3D 渲染，国漫美学，精致角色建模，飘逸汉服与丝绸质感，柔和全局光照，高饱和色彩，粒子法术特效，仙侠氛围，虚幻引擎5渲染，8K 高清。'),
  style('3d-neo-guofeng', '3D 新三维国风', '融合传统国风美学与现代三维技术，典雅细腻，温润色彩（如《凡人修仙传》《眷思量》）', '3D 类（漫剧）', '现代三维技术融合传统东方美学，温润如玉的材质感，典雅含蓄配色，细腻皮肤纹理，极简构图，宁静高雅氛围，类 C4D 渲染。'),
  style('3d-modern', '3D 现代风格', '现代都市题材，贴近真实人物但略带美化，服装时尚，场景写实', '3D 类（漫剧）', '现代都市 3D 风格，半写实人物比例，时尚现代服装，真实布料解算，城市街道背景，自然日光照明，略带美颜的皮肤质感。'),
  style('3d-cyberpunk', '3D 赛博朋克', '高对比霓虹色调，机械义体，未来都市，科技感与颓废感并存', '3D 类（漫剧）', '赛博朋克美学，青与洋红霓虹灯光，机械义肢，高科技低生活，潮湿地面反射，体积光，强烈明暗对比，未来都市背景，光线追踪，高细节机械结构。'),
  style('3d-scifi-real', '3D 科幻写实', '近未来科幻风格，硬表面建模，真实光影，强调科技感', '3D 类（漫剧）', '硬表面建模，近未来科幻，真实金属与复合材料质感，冷色调照明，工业设计风格，严谨光影逻辑，太空或实验室场景，电影级渲染，8K。'),
  style('3d-beauty-cg', '3D 渲染美型', '偏向精美 CG，如暴雪 CG、最终幻想风格，角色俊美，光影华丽', '3D 类（漫剧）', '顶级 CG 渲染，暴雪／最终幻想风格，极度俊美面部，华丽服饰细节，戏剧性舞台灯光，宝石金属高光反射，史诗梦幻氛围。'),
  style('3d-game-engine', '3D 游戏引擎级', '如《最后生还者》《战神》级别，次世代游戏角色，极致细节', '3D 类（漫剧）', '次世代游戏画质，毛孔级皮肤细节，真实毛发渲染，PBR 材质，动态光影，极其逼真的环境纹理，沉浸式视觉体验。'),
  style('3d-unreal', '3D 虚幻引擎', '最新的 Lumen 全局光照，极致真实感，动态光影，光线追踪', '3D 类（漫剧）', '虚幻引擎5 Lumen 光照，纳米几何体细节，实时光线追踪，真实漫反射与反射，电影级景深，体积雾，照片级真实感，超高清画质。'),
  style('3d-toon', '3D 卡通渲染', '如《原神》《塞尔达传说》，3D 建模但渲染成卡通效果，色彩鲜艳', '3D 类（漫剧）', '三渲二风格，鲜艳色块，清晰轮廓线，动漫式上色，明亮色彩，可爱角色比例，二次元与三维结合。'),
  style('3d-handpaint', '3D 手绘风', '3D 模型叠加手绘纹理，如《无主之地》系列，有手绘笔触感', '3D 类（漫剧）', '三维模型叠加手绘纹理，明显笔触感，黑色描边，漫画网点效果，非真实感渲染，独特艺术化视觉。'),
  style('3d-clay', '3D 黏土动画风', '如《小羊肖恩》，黏土质感，定格动画效果', '3D 类（漫剧）', '定格动画风格，黏土材质，指纹痕迹，柔和漫反射光照，微缩模型场景，略带顿挫的动态感，温馨可爱，高饱和纯色背景。'),

  // CG/插画类（漫剧）
  style('impasto-real', '厚涂写实', '插画师厚涂技法，有笔触感但非常写实，常用于概念设计', 'CG/插画类（漫剧）', '数字厚涂，油画质感，丰富笔触，写实光影结构，概念艺术风格，深沉色彩，强调体积感，无描边，大师级画作。'),
  style('thin-wash', '薄涂清新', '水彩或淡彩风格，颜色清透，线条柔和，适合治愈系', 'CG/插画类（漫剧）', '水彩淡彩，清透色彩，柔和边缘，留白艺术，治愈系氛围，低饱和度，纸张纹理，轻盈线条，明亮干净。'),
  style('western-commercial', '欧美商业插画', '如《英雄联盟》卡池图，色彩饱和度高，角色动态感强', 'CG/插画类（漫剧）', '欧美游戏原画风格，高饱和色彩，强烈动态姿势，戏剧性光影，精致金属与魔法特效，史诗感，视觉冲击力强。'),
  style('jp-real-illust', '日系写实插画', '如新海诚、吉卜力写实向，背景细腻', 'CG/插画类（漫剧）', '新海诚／吉卜力风格，极度细腻背景美术，写实光影追踪，丁达尔光效，清新空气感，色彩和谐，情感充沛，高分辨率背景。'),
  style('guofeng-illust', '古风插画', '中国传统工笔或水墨风格，线条流畅，色彩淡雅', 'CG/插画类（漫剧）', '中国传统工笔或水墨风格，流畅线条，淡雅色彩，留白意境，汉服元素，云雾缭绕，古典韵味，宣纸质感，东方美学。'),
  style('fantasy-illust', '奇幻插画', '如《万智牌》插画，奇幻题材，细节丰富，光影强烈', 'CG/插画类（漫剧）', '奇幻卡牌风格，丰富奇幻生物与魔法元素，复杂细节，史诗构图，神秘光影，厚重色彩，幻想世界设定。'),
  style('scifi-illust', '科幻插画', '未来主义，机械设计，硬表面，常与赛博朋克结合', 'CG/插画类（漫剧）', '未来主义设计，硬表面机械，赛博或太空歌剧风格，冷色调，霓虹光效，复杂科技细节，概念设计图，蓝图感。'),
  style('fairy-illust', '童话插画', '色彩柔和，线条圆润，充满想象力', 'CG/插画类（漫剧）', '儿童绘本风格，圆润线条，柔和梦幻色彩，富有想象力的生物，温馨氛围，蜡笔或彩铅质感，天真烂漫，故事感强。'),
  style('vector-illust', '矢量插画', '扁平化风格，色块清晰，线条简洁', 'CG/插画类（漫剧）', '扁平化设计，矢量图形，清晰边缘，色块分明，简洁渐变，极简主义，现代 UI 风格，高对比，几何形状构成。'),
  style('ink-wash-color', '钢笔淡彩', '钢笔线条勾勒，水彩填色，清新自然', 'CG/插画类（漫剧）', '钢笔线条勾勒轮廓，水彩上色，线条灵动，色彩透明，速写感，清新自然，手绘痕迹，文艺风格，留白。'),

  // Midjourney
  style('midjourney-cinematic', 'Midjourney半写实电影感', '高保真半写实，瓷面皮肤，柔光高调，浅景深', 'Midjourney', '高保真半写实 CG 电影感。骨相真实，脸形与皮肤往美型改写：无瑕瓷面，只有极淡皮下柔光，没有毛孔和血管；手的骨点正确但收圆，指节干净；偏大的简练杏形眼，眼尾一点胭脂，唇上一层釉；八头身，下颌收窄，颈线拉长。衣料用刺绣、珠链、金属扣按装饰规律排布。画面平滑，材质反差强但表面洁净如新。光源不可追溯，多处柔光眷顾主体。高光削平，黑位抬起并带色相，中间调高饱和。三分构图，主体撑满中三分之一。高调低对比，亮部大面积发白，阴影停在浅蓝灰，没有硬阴影，没有纯黑死块。白来自轮廓光、过曝背景和白色光尘。浅景深。色彩按区域分开，不整片泛黄或泛紫，不做旧。'),

  // 二次元类（漫剧）
  style('anime-jp-std', '日系动漫', '标准日式动画风格，赛璐珞上色，线条清晰', '二次元类（漫剧）', '标准日式动画风格，赛璐珞上色，清晰线条，典型动漫五官，明暗分界明显，色彩鲜艳，电视动画质感，2D 平面感。'),
  style('anime-cn-guoman', '国漫风', '如《哪吒》《白蛇》，融合中国元素', '二次元类（漫剧）', '中国动画电影风格，融合水墨与三维特效，东方奇幻元素，华丽法术特效，独特角色设计，史诗感。'),
  style('light-novel', '轻小说插画', '柔和明亮，适合青春、日常，角色美型', '二次元类（漫剧）', '日本轻小说封面风格，柔和明亮光线，美型人物设计，青春气息，校园或奇幻背景，精致眼部绘制，色彩通透。'),
  style('moe-anime', '萌系动漫', '如《K-ON!》，大眼睛，软萌，色彩粉嫩', '二次元类（漫剧）', '大眼睛，小嘴巴，Q 版或软萌比例，粉嫩色彩，高光眼神，可爱治愈，日常系氛围，空气感。'),
  style('shonen-hotblood', '热血少年漫', '如《海贼王》《火影忍者》，线条粗犷，动感强', '二次元类（漫剧）', '粗犷线条，强烈透视，动态模糊，高对比阴影，燃系爆发力，夸张表情，战斗场景。'),
  style('shoujo-manga', '少女漫', '如《NANA》，细腻，睫毛精，花朵背景', '二次元类（漫剧）', '纤细线条，华丽睫毛与眼睛，花朵蕾丝背景，粉彩色调，浪漫唯美，情感细腻，柔光效果。'),
  style('mecha-anime', '机甲动漫', '如《高达》系列，机械设定，硬朗线条', '二次元类（漫剧）', '硬表面机械设定，复杂装甲细节，金属质感，写实比例机器人，科幻背景，激光特效，工业美学，严谨结构。'),
  style('isekai-fantasy', '异世界奇幻', '如《Re:0》，奇幻元素，角色精致', '二次元类（漫剧）', '异世界转生题材，精致西幻角色设计，魔法阵，冒险者服装，剑与魔法，明亮色彩，RPG 界面感，精致背景美术。'),
  style('kyoani', '京都动画风', '细腻的人物作画，柔和的色彩，真实系', '二次元类（漫剧）', '极高人物作画质量，细腻发丝，真实眼部反光，柔和色彩过渡，日常光影，情感表达丰富，高清晰度。'),
  style('ufotable', 'ufotable 风', '如《鬼灭之刃》，摄影处理华丽，特效丰富', '二次元类（漫剧）', '华丽摄影处理，浮世绘元素结合三维特效，粒子光效，高对比色彩，动态镜头感，呼吸感，视觉盛宴。'),
  style('cyber-anime-semi', '赛博朋克+二次元半写实', '赛博朋克与二次元动漫融合的超现实数字艺术风格。人物表现采用半写实二次元与 3D 渲染结合，五官精致、皮肤质感细腻、发丝高光清晰，同时保留动漫化比例与柔和轮廓。光影采用多层复合打光：整体呈现电影级光影、体积光、浅景深与高质量数字插画质感，适合角色立绘、虚拟偶像、游戏宣传图与数字艺术创作。', '二次元类（漫剧）', '赛博朋克与二次元动漫融合的超现实数字艺术风格。人物表现采用半写实二次元与 3D 渲染结合，五官精致、皮肤质感细腻、发丝高光清晰，同时保留动漫化比例与柔和轮廓。光影采用多层复合打光：整体呈现电影级光影、体积光、浅景深与高质量数字插画质感，适合角色立绘、虚拟偶像、游戏宣传图与数字艺术创作。'),

  // 概念设计类（漫剧）
  style('char-concept', '角色概念原画', '强调角色设计，线稿+色块，突出服装、道具、姿态', '概念设计类（漫剧）', '角色设计图，三视图，线稿加平涂色彩，强调服装剪裁与配饰细节，中性背景，清晰轮廓，功能与美感结合，游戏资产图。'),
  style('scene-concept', '场景概念原画', '强调环境氛围，构图宏大，光影强烈，细节丰富', '概念设计类（漫剧）', '环境概念设计，宏大构图，强烈光影氛围，笔触概括，强调空间感与透视，电影镜头感，史诗风景，遮罩绘景风格。'),
  style('prop-concept', '道具概念设计', '专注武器、载具、关键物品的设计图', '概念设计类（漫剧）', '武器或载具设计图，工业设计草图，细节标注，爆炸图视角，金属与材质展示，功能性设计，蓝图背景。'),
  style('dark-concept', '暗黑风格概念', '高对比，阴郁氛围，适合反派或末世题材', '概念设计类（漫剧）', '黑暗奇幻风格，高对比度，阴郁色调，恐怖氛围，魂系美学，压抑光影，怪物设计，粗犷笔触，绝望感。'),
  style('scifi-concept', '科幻概念', '未来科技，硬表面，冷色调，蓝图风格', '概念设计类（漫剧）', '硬科幻设计，未来科技，冷色调，全息投影元素，极简功能主义，太空飞船或未来城市，干净线条，高科技材质。'),
  style('fantasy-concept', '奇幻概念', '魔法世界，自然元素，温暖色调，神秘感', '概念设计类（漫剧）', '传统奇幻设定，魔法森林或古老城堡，自然元素（藤蔓、水晶），温暖色调，神秘感，手绘质感，奇幻冒险美学。'),
  style('ink-concept', '水墨概念', '中国传统水墨渲染，留白，意境，适合武侠仙侠', '概念设计类（漫剧）', '中国风水墨概念图，黑白灰为主，少量朱砂点缀，留白意境，笔触苍劲，武侠氛围，山水画构图，写意风格，东方哲学感。'),
  style('industrial-concept', '工业设计概念', '如汽车、机械设计，线稿+渲染，强调功能性', '概念设计类（漫剧）', '产品工业设计图，汽车或家电设计，完美曲面，棚拍灯光，材质球展示，极简现代，功能性美学。'),

  // 写实类（真人剧）
  style('commercial-photo', '商业摄影写实', '如时尚杂志封面，光影精致，皮肤质感细腻，略带美化', '写实类（真人剧）', '商业广告摄影，时尚杂志封面，完美布光，精致妆容，皮肤细腻无瑕疵，高端镜头成像，景深虚化，色彩鲜艳，专业模特。'),
  style('documentary-photo', '纪实摄影写实', '如新闻摄影，真实自然，不刻意美化，保留皮肤纹理', '写实类（真人剧）', '新闻纪实摄影，自然光，无修饰，真实皮肤纹理与皱纹，抓拍瞬间，生活化场景，真实情感，35mm 胶片质感，人文关怀。'),
  style('cinematic-real', '电影质感写实', '好莱坞大片级别，光影氛围浓厚，略带艺术处理', '写实类（真人剧）', '电影剧照，好莱坞大片质感，戏剧性布光，色彩分级，宽银幕比例，叙事性构图，氛围感强，高动态范围。'),
  style('portrait-retouch', '人像精修写实', '如专业人像摄影后期，皮肤光滑，眼神光清晰', '写实类（真人剧）', '专业人像摄影，影棚灯光，眼神光清晰，皮肤光滑如瓷，发丝分明，背景纯净，高分辨率，完美比例，柔光效果。'),
  style('raw-photo', 'RAW 风格写实', '如相机原始格式，细节丰富，色调中性，可后期调色', '写实类（真人剧）', '相机原片风格，中性色温，高动态范围，保留所有细节，无后期调色痕迹，真实色彩还原，高清晰度，原始底片质感。'),
  style('bw-film', '黑白胶片写实', '黑白摄影风格，颗粒感，高对比，复古质感', '写实类（真人剧）', '黑白摄影，高颗粒感，高对比度，经典布光，复古氛围，银盐质感，情感深沉，光影造型强，艺术摄影。'),
  style('macro-photo', '微距摄影写实', '极致细节，如昆虫、花卉的微距摄影', '写实类（真人剧）', '微距镜头拍摄，极致细节，浅景深，背景强烈虚化，昆虫复眼或花瓣纹理，微观世界，高清晰度，科学摄影风格。'),

  // 经典艺术类（真人剧）
  style('classic-oil', '古典油画', '伦勃朗光线，油画质感，厚重笔触', '经典艺术类（真人剧）', '伦勃朗式布光，油画笔触，厚重颜料感，深沉色调，明暗对照法，古典主义，博物馆藏品质感，庄重细腻。'),
  style('impressionist-oil', '印象派油画', '光影斑驳，色彩鲜艳，笔触松散', '经典艺术类（真人剧）', '破碎笔触，捕捉光与色，户外光感，色彩鲜艳，模糊轮廓，梦幻空气感，艺术画作。'),
  style('watercolor-art', '水彩风', '柔和通透，适合唯美、古风角色，纸张纹理', '经典艺术类（真人剧）', '水彩画风格，水的流动感，色彩晕染，纸张纹理，透明感，轻盈，边缘柔和，清新淡雅，留白。'),
  style('sketch-draw', '素描/速写', '单色线条感，适合概念草图，炭笔或铅笔质感', '经典艺术类（真人剧）', '铅笔或炭笔素描，线条艺术，黑白灰关系，排线纹理，草图感，结构严谨，艺术习作，单色手绘痕迹。'),
  style('printmaking', '版画', '木刻或铜版画风格，线条硬朗，黑白对比强', '经典艺术类（真人剧）', '木刻或铜版画风格，硬朗线条，黑白分明，刀味木味，强烈装饰感，复古高对比，民间艺术风格。'),
  style('mural-dunhuang', '壁画', '如敦煌壁画风格，earthy 色调，斑驳质感', '经典艺术类（真人剧）', '敦煌壁画或湿壁画风格，斑驳墙面质感，矿物颜料色彩，古朴，宗教或历史题材，剥落感，历史沉淀，平面装饰感。'),
  style('tempera', '蛋彩画', '文艺复兴前技法，色彩温润，细节细腻', '经典艺术类（真人剧）', '文艺复兴早期蛋彩画风格，温润色彩，细腻线条，半透明光泽，木板画质感，古典肖像，严谨技法，柔和过渡。'),
  style('pastel', '色粉画', '柔和朦胧，适合肖像，粉质感', '经典艺术类（真人剧）', '色粉笔画，粉质感，柔和朦胧，无笔触痕迹，色彩丰富细腻，肖像画，温馨浪漫，纸张颗粒感。'),

  // 影视风格
  style('film-80s-us', '80 年代美剧风', '颗粒感 + 怀旧音乐 + 大字体标题', '影视风格', '80 年代电视录像带质感，低分辨率，色彩溢出，柔光镜，复古时尚，模拟信号噪点，VHS 磁带效果，怀旧氛围。'),
  style('film-90s-idol', '90 年代偶像剧风格', '柔焦 + 梦幻滤镜 + 夸张表情', '影视风格', '柔焦滤镜，梦幻光晕，高曝光，夸张妆容发型，浪漫氛围，室内布景，复古胶片感。'),
  style('film-crime-chase', '警匪片风格', '紧张节奏 + 追逐镜头 + 低光场景', '影视风格', '警匪动作片，低照度高对比，紧张氛围，手持摄影，冷色调，城市夜景，枪战烟雾，硬汉形象，蓝色滤镜。'),
  style('film-campus', '校园青春风格', '明亮色彩 + 对称构图 + 轻音乐', '影视风格', '青春校园电影，明亮高调照明，蓝天白墙，制服，阳光感，清新色彩，对称构图，活力纯真。'),
  style('film-disaster', '灾难电影风格', '剧烈晃动 + 闪回叠化 + 广角特写', '影视风格', '灾难大片，广角镜头，剧烈动态模糊，碎片飞溅，尘土飞扬，压抑天空，混乱构图，史诗破坏场景，IMAX 质感。'),
  style('film-scifi-exp', '科幻实验片风格', '霓虹光 + 深色调 + 镜面反射', '影视风格', '实验性科幻，霓虹光效，深色调，镜面反射，抽象几何，迷幻色彩，未来主义，赛博空间视觉化。'),
  style('film-stage', '舞台剧改编影像风', '高对比黑白 + 台词为主', '影视风格', '舞台剧录像风格，高对比黑白或强烈聚光灯，夸张肢体语言，固定机位，戏剧化布景，台词字幕，剧场感。'),
  style('film-religious', '宗教主题风格', '庄严色调 + 静态构图', '影视风格', '宗教电影，庄严对称构图，烛光，烟雾，金色与深红色调，神圣感，静默慢节奏，教堂或寺庙内部。'),
  style('film-realism', '现实主义电影风格', '自然光 + 非演员 + 长镜头', '影视风格', '意大利新现实主义，自然光，非职业演员质感，长镜头，粗糙颗粒，街头实景，生活流，无修饰，社会写实。'),
  style('film-psycho', '心理惊悚片风格', '镜头错位 + 昏暗光影 + 变焦特写', '影视风格', '心理惊悚，扭曲镜头，昏暗光影，特写变焦，不安构图，冷色调，阴影中的恐惧，压抑氛围。'),
  style('film-urban-crime', '城市犯罪片风', '夜景霓虹 + 快节奏剪辑', '影视风格', '城市犯罪片，夜景霓虹反射湿地面，快节奏剪辑，黑色电影元素，现代都市冷漠感，高饱和夜景，动作感。'),
  style('film-folk', '民族文化电影风格', '传统服饰 + 地方音乐 + 自然环境', '影视风格', '民族志电影，传统服饰细节，自然风光，地方特色建筑，民俗活动，自然光，色彩丰富，人文纪实。'),
  style('film-future-scifi', '未来科幻风格', '金属感强 + HUD 叠加界面', '影视风格', '硬科幻电影，金属质感，全息 HUD 界面叠加，冷峻蓝灰色调，太空舱内部，高科技设备，无菌感。'),
  style('film-revenge', '复仇主题风格', '慢镜头 + 阴郁配乐 + 特写眼神', '影视风格', '复仇电影，慢动作特写，阴郁配乐视觉化，眼神特写，血腥美学，高对比暗调，暴力美学。'),
  style('film-jp-youth', '青春日剧风格', '清淡色调 + 浅景深 + 柔和光线', '影视风格', '日本青春剧，清淡低饱和色调，浅景深，柔和自然光，过曝白色，细腻情感，生活化场景，治愈系。'),
  style('film-british', '英伦剧情风格', '暗色复古 + 室内烛光 + 对称构图', '影视风格', '英伦复古，暗色调，室内烛光或壁炉光，对称构图，古典家具，阴雨天，绅士淑女，克制情感。'),
  style('film-battlefield', '战地纪实风格', '手持抖动 + 高对比 + 爆炸环境', '影视风格', '战地记者视角，手持剧烈抖动，高对比，爆炸烟尘，混乱残酷，去饱和色调，新闻摄影风格，紧迫感。'),
  style('film-cyber-east', '赛博东亚风', '汉字霓虹 + 摩天楼林立 + 杂乱城市', '影视风格', '赛博朋克东亚城市，汉字霓虹招牌，拥挤摩天楼，杂乱有序街道，蒸汽雨水，高对比霓虹色，未来九龙城寨感。'),
  style('film-indie-west', '欧美独立电影风', '低饱和 + 空镜 + 叙事碎片化', '影视风格', '独立电影美学，低饱和自然光，大量空镜头，叙事碎片化，胶片颗粒，文艺气息，非主流构图。'),
  style('film-time-travel', '短剧穿越风格', '古今混搭 + 快速变装 + 场景拼接', '影视风格', '短视频短剧风格，高饱和，快速变装特效，古今场景拼接，夸张表情，竖屏构图感，强节奏爽剧视觉。'),
  style('film-survival', '荒野生存剧风', '自然光 + 环境音强 + 沉浸追随', '影视风格', '荒野生存，自然光，跟随镜头，广阔风景，孤独背影，写实色调，沉浸体验，地理纪录片风格。'),
  style('film-french-romance', '法语爱情片风格', '长镜 + 低语对白 + 街拍质感', '影视风格', '法国爱情电影，长镜头，低语对白视觉化，巴黎街头，自然光影，浪漫慵懒，手持摄影，文艺浪漫。'),
  style('film-horror', '恐怖片风格', '压暗光线 + 突变音效 + 主观镜头', '影视风格', '恐怖电影，压暗光线，突兀阴影，主观镜头，冷色调，狭窄空间，惊吓点，高对比，不安氛围。'),
  style('film-live-fairy', '真人童话风格', '饱和梦境色 + 慢节奏', '影视风格', '真人版童话，梦幻饱和色彩，柔光，魔法粒子，精致服装，童话场景，慢节奏，浪漫超现实美感。'),
  style('film-apocalypse', '末世电影风格', '破败城市 + 灰黄色调 + 广角', '影视风格', '末世废土，破败城市建筑，灰黄色调，广角荒凉，灰尘与生锈金属，生存装备，压抑天空。'),
  style('film-spy', '谍战片风格', '暗房 + 电话亭 + 帽子眼神特写', '影视风格', '谍战悬疑，暗房红光，电话亭，帽子风衣，眼神特写，阴影中交易，冷峻色调，紧张复古科技感。'),
  style('film-cold-war', '俄式冷战风格', '蓝灰调 + 低色温 + 大量字幕叠加', '影视风格', '苏联冷战美学，蓝灰低色温，粗野主义建筑，字幕叠加，严肃压抑，历史纪录片感，颗粒感。'),
  style('film-childhood', '童年回忆片风格', '黄调复古 + 慢镜头 + 自然音效', '影视风格', '怀旧童年，暖黄滤镜，慢镜头，自然音效视觉化，老式玩具，阳光斑驳，温馨，模糊记忆感，胶片质感。'),
  style('film-detective', '警探剧风格', '玻璃写字板 + 白板推理 + 悬疑配乐', '影视风格', '警探推理，玻璃写字板与白板线索，冷色调办公室，特写证据，严肃理性，现代刑侦悬疑。'),
  style('film-xuanhuan-guofeng', '玄幻国风片', '飘带 + 云雾特效 + 红青对撞', '影视风格', '中国玄幻剧，飘带飞舞，云雾特效，红青对撞色彩，仙侠法术，慢动作打斗，唯美华丽古装质感。'),
  style('film-crime-reenact', '罪案还原剧风', '现场还原 + 旁白 + 模糊人物', '影视风格', '罪案纪录片，现场还原，旁白视觉化，模糊人物面部，冷峻色调，手持摄影，真实犯罪纪实感。'),
  style('film-jp-late-night', '日式深夜剧风格', '微光环境 + 封闭空间 + 吃饭动作', '影视风格', '日本深夜剧，微光环境，封闭空间，吃饭动作特写，温暖孤独，低照度，生活流，私密感。'),
  style('film-doomsday-traveler', '末日旅人风格', '破败 + 独行 + 极简对话', '影视风格', '末日公路片，破败风景，独行者，极简对话视觉化，广角荒原，冷色调，孤独生存主义，电影感。'),
  style('film-hitchcock', '希区柯克悬疑风', '固定机位 + 交替剪辑 + 低音乐', '影视风格', '希区柯克风格，固定机位，交替剪辑蒙太奇，低音乐视觉化，楼梯阴影，窥视视角，低饱和心理悬疑。'),
  style('film-wong-kar-wai', '王家卫电影风格', '慢镜头 + 模糊边缘 + 饱和色彩', '影视风格', '王家卫美学，慢镜头，动态模糊，饱和色彩，抽帧，狭窄空间，霓虹灯，情感浓郁，复古光影斑驳。'),
  style('film-nolan', '诺兰式倒叙结构', '非线性时间轴 + 暗色调', '影视风格', '诺兰电影风格，非线性时间暗示，冷峻色调，IMAX 大画幅，实拍质感，复杂结构，时间扭曲感。'),
  style('film-kurosawa', '黑泽明剧场感', '高反差黑白影调 + 固定机位', '影视风格', '黑泽明风格，高反差黑白，固定机位，暴雨大风，武士构图，静态中的张力，能剧式表演，史诗感。'),
  style('film-hk-neon', '港片光影风格', '霓虹反光 + 快速切换镜头', '影视风格', '港片黄金时代，霓虹反光，快速切换镜头，动作模糊，高对比，都市夜景，江湖气，胶片颗粒。'),
  style('film-kdrama-romance', '韩剧慢镜头浪漫', '柔光 + 背景虚化 + 配乐旋律', '影视风格', '韩剧浪漫场景，柔光滤镜，背景强烈虚化，慢动作，雪花或花瓣，精致妆容，梦幻氛围。'),
  style('film-miyazaki', '宫崎骏动画感', '自然色彩 + 清新构图 + 手绘质感', '影视风格', '吉卜力手绘风格，自然色彩，清新构图，手绘质感，蓝天白云，美食特写，治愈童真，水彩背景。'),
  style('film-marvel', '漫威大片感', '大场景 + 爆炸特效 + CG 合成', '影视风格', '超级英雄电影，大场景 CGI，爆炸特效，高饱和，动态镜头，英雄姿态，史诗商业大片质感。'),
  style('film-pixar', '皮克斯动画质感', '明亮色彩 + 卡通建模 + 情感流动', '影视风格', '三维动画，明亮色彩，卡通化建模，夸张表情，情感流动，柔和光照，家庭友好，精致材质。'),
  style('film-zhang-yimou', '张艺谋色彩对比风格', '红绿对撞 + 对称构图', '影视风格', '强烈红绿对撞，对称构图，宏大场面，色彩浓烈，民俗元素，视觉冲击，油画感，史诗。'),
  style('film-ang-lee', '李安东方写实风', '自然光线 + 内敛情绪', '影视风格', '自然光线，内敛情绪，细腻情感表达，东方美学，克制写实，人文关怀，柔和色调，电影质感。'),
  style('film-western', '西部片风格', '荒漠远景 + 冷暖对比 + 低角度', '影视风格', '经典西部片，荒漠远景，冷暖对比，低角度拍摄，牛仔帽左轮，夕阳粗犷，宽银幕。'),
  style('film-french-art', '法式文艺风', '碎片叙事 + 自然光影 + 低饱和', '影视风格', '法国文艺片，碎片化叙事，自然光影，低饱和，街头漫步，随性浪漫，胶片质感，生活流。'),
  style('film-doc', '纪录片感', '自然光 + 镜头抖动 + 真实色调', '影视风格', '电视纪录片，自然光，轻微镜头抖动，真实色调，观察式摄影，采访视角，客观冷静。'),
  style('film-hk-nostalgia', '港风怀旧感', '黄色滤镜 + 慢动作走位', '影视风格'),
  style('film-noir', '黑色电影风格', '强光阴影 + 硬汉独白 + 反光雨夜', '影视风格'),
  style('film-us-youth', '美式青春片风格', '明快节奏 + 活力色彩', '影视风格'),
  style('film-bollywood', '印度歌舞片风格', '高饱和 + 快速剪辑 + 群舞镜头', '影视风格'),
  style('film-euro-cold', '欧洲冷感系', '灰白色调 + 极简构图', '影视风格'),
  style('film-bbc-doc', 'BBC 纪录片感', '精致构图 + 慢推镜头 + 旁白配音', '影视风格', '精致构图，慢推镜头，旁白配音，自然光影，壮丽风光，高画质质感，优雅克制。'),
  style('film-netflix-thriller', 'Netflix 惊悚剧风格', '低光源 + 突变音效 + 细节特写', '影视风格', '低光源，突变音效视觉化，细节特写，冷峻色彩，悬念张力，电影级调色。'),
  style('film-doc-handheld', '纪录片手持风格', '真实环境光 + 轻微镜头晃动', '影视风格', '真实环境光，轻微镜头晃动，肩扛跟拍质感，原生真实，去修饰，临场感强。'),
  style('film-romanticism', '浪漫主义镜头', '柔光 + 色彩渐变 + 慢速推镜', '影视风格', '柔光，色彩渐变，慢速推镜，梦幻氛围，唯美构图，抒情节奏。'),
  style('film-new-wave', '新浪潮电影风格', '突兀剪辑 + 非逻辑叙事', '影视风格', '突兀剪辑，非逻辑叙事，自然光，街头实景，跳切，反传统，作者电影气息。'),
  style('film-absurd', '荒诞剧风格', '怪异构图 + 夸张表演 + 低饱和', '影视风格', '怪异构图，夸张表演，低饱和，超现实情境，冷幽默，疏离氛围。'),
  style('film-theatre', '剧场舞台风', '静态构图 + 中心打光 + 对称', '影视风格', '静态构图，中心打光，对称布局，戏剧布景，人工布光，凝练张力。'),
  style('film-dystopia', '反乌托邦电影风格', '灰蓝色调 + 压抑空间', '影视风格', '灰蓝色调，压抑空间，规整秩序感，监控氛围，疏离冷峻，未来集权城市。'),

  // 兼容旧项目已存 value，避免更新时报枚举错误
  style('anime-jp', '日漫', '标准日式动画风格，赛璐珞上色，线条清晰', '兼容旧项', '标准日式动画风格，赛璐珞上色，清晰线条，典型动漫五官，明暗分界明显，色彩鲜艳，电视动画质感，2D 平面感。'),
  style('anime-cn', '国漫', '融合中国元素的国漫画面', '兼容旧项', '中国动画电影风格，融合水墨与三维特效，东方奇幻元素，华丽法术特效，独特角色设计，史诗感。'),
  style('cel', '赛璐璐', '赛璐珞平涂上色，线条清晰', '兼容旧项'),
  style('shinkai', '新海诚', '如新海诚写实向，背景细腻，光影通透', '兼容旧项', '新海诚／吉卜力风格，极度细腻背景美术，写实光影追踪，丁达尔光效，清新空气感，色彩和谐，情感充沛，高分辨率背景。'),
  style('ghibli', '吉卜力', '自然色彩 + 清新构图 + 手绘质感', '兼容旧项', '吉卜力手绘风格，自然色彩，清新构图，手绘质感，蓝天白云，美食特写，治愈童真，水彩背景。'),
  style('shoujo', '少女漫', '细腻，睫毛精，花朵背景', '兼容旧项', '纤细线条，华丽睫毛与眼睛，花朵蕾丝背景，粉彩色调，浪漫唯美，情感细腻，柔光效果。'),
  style('manga-bw', '黑白漫画', '黑白线稿与网点，漫画分镜感', '兼容旧项'),
  style('comic-us', '美漫', '欧美漫画块面与高动态构图', '兼容旧项'),
  style('webtoon', '韩漫条漫', '竖屏条漫构图，清爽上色', '兼容旧项'),
  style('chibi', 'Q版', '头身比夸张的可爱变形风格', '兼容旧项'),
  style('motion-comic', '动态漫', '漫画分镜加有限动画与运镜', '兼容旧项'),
  style('anime-3d', '三维动画', '三维角色建模与动画渲染', '兼容旧项', '三渲二风格，鲜艳色块，清晰轮廓线，动漫式上色，明亮色彩，可爱角色比例，二次元与三维结合。'),
  style('toon-shader', '三渲二', '三维建模卡通着色', '兼容旧项', '三渲二风格，鲜艳色块，清晰轮廓线，动漫式上色，明亮色彩，可爱角色比例，二次元与三维结合。'),
  style('pixar', '皮克斯', '明亮色彩 + 卡通建模 + 情感流动', '兼容旧项', '三维动画，明亮色彩，卡通化建模，夸张表情，情感流动，柔和光照，家庭友好，精致材质。'),
  style('realistic', '写实', '写实光影与材质', '兼容旧项', '电影剧照，好莱坞大片质感，戏剧性布光，色彩分级，宽银幕比例，叙事性构图，氛围感强，高动态范围。'),
  style('semi-real', '半写实', '介于卡通与写实之间的半写实渲染', '兼容旧项', '现代都市 3D 风格，半写实人物比例，时尚现代服装，真实布料解算，城市街道背景，自然日光照明，略带美颜的皮肤质感。'),
  style('cinematic', '电影感', '电影光影氛围与镜头语言', '兼容旧项', '电影剧照，好莱坞大片质感，戏剧性布光，色彩分级，宽银幕比例，叙事性构图，氛围感强，高动态范围。'),
  style('film', '复古胶片', '胶片颗粒与复古色调', '兼容旧项', '黑白摄影，高颗粒感，高对比度，经典布光，复古氛围，银盐质感，情感深沉，光影造型强，艺术摄影。'),
  style('impasto', '厚涂', '厚涂笔触与体积感', '兼容旧项', '数字厚涂，油画质感，丰富笔触，写实光影结构，概念艺术风格，深沉色彩，强调体积感，无描边，大师级画作。'),
  style('watercolor', '水彩', '柔和通透，纸张纹理', '兼容旧项', '水彩画风格，水的流动感，色彩晕染，纸张纹理，透明感，轻盈，边缘柔和，清新淡雅，留白。'),
  style('oil', '油画', '油画质感，厚重笔触', '兼容旧项', '伦勃朗式布光，油画笔触，厚重颜料感，深沉色调，明暗对照法，古典主义，博物馆藏品质感，庄重细腻。'),
  style('ink', '水墨', '水墨渲染，留白意境', '兼容旧项', '中国风水墨概念图，黑白灰为主，少量朱砂点缀，留白意境，笔触苍劲，武侠氛围，山水画构图，写意风格，东方哲学感。'),
  style('ink-wuxia', '武侠水墨', '武侠题材水墨写意', '兼容旧项', '中国风水墨概念图，黑白灰为主，少量朱砂点缀，留白意境，笔触苍劲，武侠氛围，山水画构图，写意风格，东方哲学感。'),
  style('gongbi', '工笔', '工笔细线与淡雅设色', '兼容旧项', '中国传统工笔或水墨风格，流畅线条，淡雅色彩，留白意境，汉服元素，云雾缭绕，古典韵味，宣纸质感，东方美学。'),
  style('guofeng', '古风国风', '中国传统美学与服饰场景', '兼容旧项', '中国传统工笔或水墨风格，流畅线条，淡雅色彩，留白意境，汉服元素，云雾缭绕，古典韵味，宣纸质感，东方美学。'),
  style('neo-guofeng', '新国风', '传统国风与现代视觉结合', '兼容旧项', '现代三维技术融合传统东方美学，温润如玉的材质感，典雅含蓄配色，细腻皮肤纹理，极简构图，宁静高雅氛围，类 C4D 渲染。'),
  style('dunhuang', '敦煌', '敦煌壁画色调与斑驳质感', '兼容旧项', '敦煌壁画或湿壁画风格，斑驳墙面质感，矿物颜料色彩，古朴，宗教或历史题材，剥落感，历史沉淀，平面装饰感。'),
  style('ukiyoe', '浮世绘', '浮世绘平面色块与线条', '兼容旧项', '华丽摄影处理，浮世绘元素结合三维特效，粒子光效，高对比色彩，动态镜头感，呼吸感，视觉盛宴。'),
  style('xianxia', '仙侠', '仙侠云雾、飘带与灵气特效', '兼容旧项', '中国玄幻剧，飘带飞舞，云雾特效，红青对撞色彩，仙侠法术，慢动作打斗，唯美华丽古装质感。'),
  style('illustration', '商业插画', '商业插画饱和色彩与动态感', '兼容旧项', '欧美游戏原画风格，高饱和色彩，强烈动态姿势，戏剧性光影，精致金属与魔法特效，史诗感，视觉冲击力强。'),
  style('concept', '概念原画', '概念设计线稿与色块', '兼容旧项', '角色设计图，三视图，线稿加平涂色彩，强调服装剪裁与配饰细节，中性背景，清晰轮廓，功能与美感结合，游戏资产图。'),
  style('picture-book', '绘本', '绘本柔和造型与叙事插图', '兼容旧项', '儿童绘本风格，圆润线条，柔和梦幻色彩，富有想象力的生物，温馨氛围，蜡笔或彩铅质感，天真烂漫，故事感强。'),
  style('fairy', '童话', '童话柔和色彩与圆润造型', '兼容旧项', '儿童绘本风格，圆润线条，柔和梦幻色彩，富有想象力的生物，温馨氛围，蜡笔或彩铅质感，天真烂漫，故事感强。'),
  style('flat', '扁平', '扁平色块与简洁线条', '兼容旧项', '扁平化设计，矢量图形，清晰边缘，色块分明，简洁渐变，极简主义，现代 UI 风格，高对比，几何形状构成。'),
  style('sketch', '素描', '单色素描线条感', '兼容旧项', '铅笔或炭笔素描，线条艺术，黑白灰关系，排线纹理，草图感，结构严谨，艺术习作，单色手绘痕迹。'),
  style('lineart', '线稿', '干净线稿为主', '兼容旧项'),
  style('pixel', '像素', '像素块面与复古游戏感', '兼容旧项'),
  style('clay', '黏土', '黏土定格动画质感', '兼容旧项', '定格动画风格，黏土材质，指纹痕迹，柔和漫反射光照，微缩模型场景，略带顿挫的动态感，温馨可爱，高饱和纯色背景。'),
  style('papercut', '剪纸', '剪纸层叠与剪影轮廓', '兼容旧项'),
  style('lowpoly', '低多边形', '低多边形几何面片', '兼容旧项'),
  style('cyber', '赛博朋克', '霓虹高对比与未来都市', '兼容旧项', '赛博朋克美学，青与洋红霓虹灯光，机械义肢，高科技低生活，潮湿地面反射，体积光，强烈明暗对比，未来都市背景，光线追踪，高细节机械结构。'),
  style('steampunk', '蒸汽朋克', '黄铜机械与维多利亚工业美学', '兼容旧项'),
  style('vaporwave', '蒸汽波', '复古电子色与错位排版感', '兼容旧项'),
  style('gothic', '哥特', '哥特建筑与暗色服饰氛围', '兼容旧项'),
  style('dark', '暗黑', '高对比阴郁暗黑氛围', '兼容旧项', '黑暗奇幻风格，高对比度，阴郁色调，恐怖氛围，魂系美学，压抑光影，怪物设计，粗犷笔触，绝望感。'),
  style('horror', '惊悚漫画', '惊悚构图与压迫光影', '兼容旧项', '恐怖电影，压暗光线，突兀阴影，主观镜头，冷色调，狭窄空间，惊吓点，高对比，不安氛围。'),
  style('campus', '校园清新', '明亮校园日常清新色调', '兼容旧项', '青春校园电影，明亮高调照明，蓝天白墙，制服，阳光感，清新色彩，对称构图，活力纯真。'),
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

function applyVisualStyles(rows) {
  const next = (rows || []).map(item => {
    const name = String(item.name || item.code || '').trim();
    const note = String(item.note || '').trim();
    const code = String(item.code || '').trim();
    if (!code) return null;
    return {
      value: code,
      name,
      note,
      label: note ? `${name}【${note}】` : name,
      group: String(item.group_name || '').trim(),
      prompt: String(item.prompt || '').trim() || (note ? `${name}风格：${note}` : name),
    };
  }).filter(Boolean);
  if (!next.length) return;
  VISUAL_STYLES.splice(0, VISUAL_STYLES.length, ...next);
}

function applyNamedList(target, rows) {
  const next = (rows || []).map(item => String(item.name || item.code || '').trim()).filter(Boolean);
  if (!next.length) return;
  target.splice(0, target.length, ...next);
}

function applyShotSizes(rows) {
  applyNamedList(SHOT_SIZES, rows);
}

function applyCameraMoves(rows) {
  applyNamedList(CAMERA_MOVES, rows);
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
  applyVisualStyles,
  applyShotSizes,
  applyCameraMoves,
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
      topic_options: require('./topics').TOPIC_OPTIONS.map(item => ({ value: item.value, label: item.label })),
      content_types: require('./contentCatalog').TYPES.map(item => ({
        id: item.id,
        label: item.label,
        bind: item.bind,
      })),
    };
  },
};
