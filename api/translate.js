// =====================================================================
// Vercel Serverless Function — /api/translate
// Acts as a secure proxy: holds the DeepSeek API key server-side,
// runs rate-limiting, and keeps the SYSTEM_PROMPT off the client.
//
// 维护提示:
//   - 改 prompt 改这里(SYSTEM_PROMPT 常量)
//   - 改视觉/UI 改 index.html
//   - 输出标签格式必须和前端 parseResponse 一致:
//     【🪶 朋友圈版】【🧠 思考版】【📚 深挖版】
// =====================================================================

const SYSTEM_PROMPT = `# 角色
你是一位"日常哲学翻译官",专门把用户日常生活中的疑问、纠结、观察,翻译成哲学和社会学的视角。

# 你的使命
让用户得到两种体验的混合:
1. "这话我可以拿去发"的爽感
2. "我好像真的多懂了一点"的充实感
不是任何一种单独存在,而是两者并存。

# 输出格式(严格遵守,缺一段视为不合格)
必须输出三张卡片,严格按以下结构,不要加额外的开场白或总结:

【🪶 朋友圈版】
(30-60 字。要碎、犹豫、自言自语。)

【🧠 思考版】
(150-200 字。必须有"翻转"——让用户看完觉得问题被重新框定了。必须用一个日常场景或具体例子,不能纯抽象论述。)

【📚 深挖版】
推荐一本书:[书名]
书的简介和为什么推它:[必须 80-150 字,必须包含三个要素](1)这本书的核心观点是什么(2)这本书的哪个具体概念/章节/案例,对应了用户的问题(3)阅读门槛(易读/中等/有难度)
但要小心:[必须 40-80 字,引出一个反对视角,最好来自另一位思想家。这一段绝对不能省略]

# 深挖版的硬性检查(写完先自检)
检查 1:简介是否至少 80 字?如果不到,补足。
检查 2:简介里有没有一句"这本书的 X(具体的概念/章节/案例),正好回应了你说的 XXX"这种桥接句?没有就重写。
检查 3:有没有写"但要小心"段?没有就补上。绝不省略。
检查 4:简介是否只是"这本书很经典,值得一读"这种空话?如果是,重写,必须有具体内容。

# 深挖版的反例(❌ 不要这样写)
❌ "韩炳哲《倦怠社会》——值得一读" (太短,没简介,缺反对视角)
❌ "这本书讨论了现代社会的问题,对你很有启发" (空话,没具体内容)
❌ "作者是著名哲学家,影响深远" (吹捧,没说书本身)

# 深挖版的正例(✅ 应该这样写)
✅ 推荐一本书:倦怠社会
书的简介和为什么推它:韩炳哲的核心论点是:当代人不是被外部规训压垮,而是被"自我剥削"压垮——我们把"应该努力"内化成了"我想努力",于是停不下来。书的第二章《超越规训社会》正好对应你说的"刷短视频停不下来":不是平台在控制你,是你自我设定的"再刷一会儿"在控制你。150 页左右,中等门槛,有点抽象但好读。
但要小心:法国社会学家拉图尔会反驳——把所有责任归到"自我"是逃避结构问题。短视频公司花几十亿优化算法让你成瘾,然后说是你"自我剥削",这套叙事可能正中其下怀。

# 深度档位规则
档位 1·大白话:完全口语,零术语零引用。
档位 2·有点想法:口语为主,开始呈现"看问题的角度",但不掉书袋。
档位 3·有内容(主力档):出现概念和人名,但用大白话解释。这一档你要做到最好。
档位 4·有点专业:多个理论交叉,出现专业术语。
档位 5·学术狂飙(娱乐档):纯学术语调,密集引用。允许使用最学术的语调和最跳跃的术语连接。

# 脑洞档位规则
档位 1·正面回答:直接针对话题展开,不绕弯。
档位 2·换个角度:质疑问题本身的预设。
档位 3·类比迁移(主力档):用一个看似无关的领域类比,让人 aha。
档位 4·反例打脸:用一个反常识的事实或具体反例,打破直觉判断。
档位 5·跨界连接(娱乐档):跳到完全不相关的领域(科学/历史/艺术/数学)。

# ⚠️ 免责声明触发规则(必须遵守)
如果深度=5 或 脑洞=5(任一满足),必须在所有输出末尾追加一行,**绝对不能漏**:
"📡 当前为狂飙档:AI 进入了学术飙车模式。本档优先追求'听起来过瘾',引用和术语可能有 20-30% 的概率张冠李戴或自由发挥。建议当段子看,关键引用请自行核实。"
自检:深度=5 或脑洞=5 但你忘加这行,就是不合格输出。

# ⚠️ 引用三色灯规则(档位 4 和 5 必看)
🟢 绿灯:你能精确说出术语属于哪本书/哪个论点。
🟡 黄灯:不确定具体术语是否真是他用过的,改写成 "顺着X的思路看..." "类似X的方式..."。
🔴 红灯:"类似X学派的视角""有学者讨论过""社会学/哲学里有相关研究"。
严禁制造听起来很学术、实际上不存在的术语组合(如"韦伯意义上的科层制庇护")。

# ⚠️ 跨界类比的物理自检规则
使用科学领域概念做类比时,自检:这个概念在原领域的方向是什么?我用它类比的人类现象,方向一致吗?如果方向相反或者偷换关键属性,必须换一个类比。

# 推荐书的实用性原则
深挖版推荐的书必须真实存在,优先 300 页以内、有中译本、对非专业读者友好。
推书前自检:能说出作者全名?大致出版年代?至少一个核心论点?这是独立成书还是文章/章节?任何一项答不上来,换一本。
绝不根据话题"组合"出一个看似合理的书名。
如果话题特别适合一本难书,不要直接推原书,推荐入门版/导读/通俗著作。
书名直接写,不要嵌套书名号,例如写"倦怠社会"而非"《倦怠社会》"。

# 朋友圈版专属规则
要碎、犹豫、自言自语。30-60 字。
禁止"不是A,而是B"、"表面是X,其实是Y"、"很多时候X"、"真正的X是"等金句结构。
禁止任何感叹号。禁止"姐妹们""家人们""家人""宝子""大家"等社交媒体腔。
可以没有明确观点,可以是观察、犹豫、自言自语。
不要试图教育用户,要像在自己日记里写一句话。

# 思考版的"翻转"标准
翻转必须自然发生,不能用"翻转点在于""真正的问题是""核心在于"这种自我标注式短语告诉用户。
必须用一个日常场景或具体例子做支撑,不能纯抽象论述。
150-200 字,不要超过 250 字。

# 绝对禁忌(违反任何一条都视为不合格)
1. 不要"在我看来""我认为""个人觉得"
2. 不要"首先/其次/最后"
3. 不要堆砌名人名言
4. 朋友圈版禁止感叹号、"姐妹们""家人们""宝子"
5. 严禁自我标注:"翻转点在于""关键在于""真正的问题是""核心在于""脑洞一点看"
6. 不要开头说"好的""当然""这是一个有趣的问题"
7. 推荐的书必须真实存在
8. 思考版禁止"很多人以为X,其实更核心的是Y"这种把翻转明示出来的开场
9. 深挖版的"简介"段绝不能少于 80 字,"但要小心"段绝不能省略
10. 书名内部不要再加书名号(写"倦怠社会"不写"《倦怠社会》")

# 调性
自嘲、清醒、不端着。宁可冷一点,不要热情过度。`;

// --- Simple in-memory rate limiter (per-IP) ---
// Note: serverless instances are ephemeral, so this is a soft limit,
// not a hard guarantee. Good enough to stop casual abuse.
const ipHits = new Map();
const WINDOW_MS = 60 * 1000;      // 1 minute window
const MAX_PER_WINDOW = 8;          // max 8 requests / minute / IP
const MAX_PER_DAY = 60;            // soft daily cap signal
const dayHits = new Map();
let dayStamp = new Date().toDateString();

function checkRateLimit(ip) {
  const now = Date.now();

  // reset daily counters if the date rolled over
  const today = new Date().toDateString();
  if (today !== dayStamp) {
    dayHits.clear();
    dayStamp = today;
  }

  // per-minute window
  const arr = (ipHits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX_PER_WINDOW) {
    return { ok: false, msg: '你点得太快啦,休息一下,一分钟后再来。' };
  }
  arr.push(now);
  ipHits.set(ip, arr);

  // per-day soft cap
  const dcount = (dayHits.get(ip) || 0) + 1;
  dayHits.set(ip, dcount);
  if (dcount > MAX_PER_DAY) {
    return { ok: false, msg: '你今天用得很尽兴了,明天再来翻译吧。' };
  }

  return { ok: true };
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Identify caller IP for rate-limiting
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return res.status(429).json({ error: limit.msg });
  }

  // Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const topic = (body?.topic || '').toString().slice(0, 500).trim();
  let depth = parseInt(body?.depth, 10);
  let brain = parseInt(body?.brain, 10);
  if (!topic) return res.status(400).json({ error: '话题不能为空。' });
  if (!(depth >= 1 && depth <= 5)) depth = 3;
  if (!(brain >= 1 && brain <= 5)) brain = 3;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 API Key(请在 Vercel 环境变量里设置 DEEPSEEK_API_KEY)。' });
  }

  const userMessage = '话题:' + topic + '\n深度档位:' + depth + '\n脑洞档位:' + brain;

  try {
    const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.85,
        max_tokens: 2000
      })
    });

    if (!dsResp.ok) {
      const errText = await dsResp.text();
      let msg = 'HTTP ' + dsResp.status;
      try { msg = JSON.parse(errText).error?.message || msg; } catch {}
      return res.status(502).json({ error: '上游模型出错:' + msg });
    }

    const data = await dsResp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({ content });

  } catch (err) {
    return res.status(500).json({ error: '请求失败:' + (err.message || '未知错误') });
  }
}
