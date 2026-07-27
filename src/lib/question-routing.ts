export type AnswerRoute = 'enterprise_kb' | 'general';

// 明确的通用闲聊/文旅/无意图黑名单模式（只有命中这些时才跳过知识库）
const GENERAL_EXCLUDE_PATTERNS: RegExp[] = [
  /栈桥/,
  /景点|景区|旅游|门票|交通管制|路线规划/,
  /天气|温度|下雨|预报/,
  /讲个?笑话|唱歌|翻译成/,
];

/**
 * 错别字与同音字自动归一化映射。
 * 支持通过环境变量 ASR_CORRECTIONS 动态配置，格式："柯小:科小,瑞鸿:瑞宏"
 */
export function getAsrCorrections(env: NodeJS.ProcessEnv = process.env): Array<[RegExp, string]> {
  const envCorrections = env.ASR_CORRECTIONS;
  const list: Array<[RegExp, string]> = [
    [/柯小/g, '科小'],
    [/瑞鸿/g, '瑞宏'],
    [/嘉信迅通/g, '嘉信讯通'],
  ];

  if (envCorrections && envCorrections.trim()) {
    const pairs = envCorrections.split(',');
    for (const pair of pairs) {
      const [wrong, right] = pair.split(':').map((s) => s.trim());
      if (wrong && right) {
        list.push([new RegExp(wrong, 'g'), right]);
      }
    }
  }

  return list;
}

/**
 * 对输入提问进行错别字/同音词纠错归一化处理
 */
export function normalizeQuestion(question: string, env: NodeJS.ProcessEnv = process.env): string {
  let normalized = question.trim();
  const corrections = getAsrCorrections(env);

  for (const [pattern, replacement] of corrections) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

/**
 * 【零维护架构】路由判定：
 * 除非明确命中“通用闲聊/文旅黑名单”，否则所有提问（包含未来新增的所有项目与文件）
 * 一律默认允许进入百炼知识库检索，由百炼 Rerank 重排得分门禁自动鉴别召回！
 */
export function routeQuestion(question: string, env: NodeJS.ProcessEnv = process.env): AnswerRoute {
  const normalizedQuestion = normalizeQuestion(question, env);

  // 1. 命中闲聊黑名单的跳过检索
  if (GENERAL_EXCLUDE_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))) {
    return 'general';
  }

  // 2. 默认全量开启知识库检索，实现无需手动添加关键词的零维护体验
  return 'enterprise_kb';
}

export function buildRoutedUserContent(
  question: string,
  route: AnswerRoute,
  kbContent = '',
): string {
  if (route === 'general') {
    return `${question}\n\n回答要求：直接回答这个通用问题，表达自然、简洁。不要提及知识库、内部资料、检索过程、合同或发票等与问题无关的信息。用户问题已经明确时，不要机械地反问是否需要更多内容。若问题涉及今天、当前开放状态、实时票价、天气或交通管制，不得把静态常识当作实时事实，应说明无法确认实时状态并建议以官方最新信息为准。`;
  }

  if (!kbContent.trim()) {
    return `${question}\n\n回答要求：这是企业业务问题，但当前没有可用的参考资料。请简洁说明“无法从现有资料确认”，不得编造合同、发票、项目、客户或金额信息，也不要描述内部知识库的资料范围。`;
  }

  return `${question}\n\n回答要求：只能根据参考资料回答这个企业业务问题。不得编造，不得使用模型常识补充或猜测合同、发票、项目、客户、日期和金额；资料不足时明确说明无法从现有资料确认；不要暴露检索过程或无关的内部资料。\n\n参考资料：\n${kbContent}`;
}
