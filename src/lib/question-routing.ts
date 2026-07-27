export type AnswerRoute = 'enterprise_kb' | 'general';

// 预设高置信度企业关键词模式（包含对科小/柯小、售前、能力申报等业务场景支持）
const DEFAULT_ENTERPRISE_PATTERNS: RegExp[] = [
  /嘉信讯通/i,
  /(?:我司|本公司|我们公司)/,
  /合同(?:金额|编号|日期|信息|内容|签订|付款)/,
  /发票(?:信息|号码|金额|日期|抬头|税号)?/,
  /客户(?:名称|信息|资料)/,
  /验收(?:情况|日期|报告|结果)?/,
  /中标(?:金额|信息|项目)?/,
  /(?:回款|付款)(?:情况|进度|金额)?/,
  /(?:项目).*(?:合同|金额|客户|验收|交付)/,
  /(?:合同|客户|验收|交付).*(?:项目)/,
  /信访一网通办/,
  /党建引领/,
  /大气污染源管理/,
  /[科柯]小/,           // 支持"科小"与同音字"柯小"
  /能力申报/,          // 支持"能力申报"类业务查询
  /售前/,              // 支持售前项目查询
  /青岛瑞宏/,          // 支持客户名称
];

/**
 * 错别字与同音字自动归一化映射。
 * 可通过环境变量 ASR_CORRECTIONS 配置，格式如："柯小:科小,瑞鸿:瑞宏,嘉信迅通:嘉信讯通"
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
 * 获取所有的企业业务匹配模式。
 * 支持通过环境变量 ENTERPRISE_KEYWORDS 动态补充关键词（逗号分隔）。
 */
export function getEnterprisePatterns(env: NodeJS.ProcessEnv = process.env): RegExp[] {
  const patterns = [...DEFAULT_ENTERPRISE_PATTERNS];

  const customKeywords = env.ENTERPRISE_KEYWORDS;
  if (customKeywords && customKeywords.trim()) {
    const keywords = customKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    for (const kw of keywords) {
      // 避免重复添加
      try {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push(new RegExp(escaped, 'i'));
      } catch (err) {
        console.warn(`[question-routing] 无效的环境变量关键词: "${kw}"`, err);
      }
    }
  }

  return patterns;
}

/**
 * Uses high-confidence business phrases to decide whether an enterprise
 * knowledge-base lookup is appropriate.
 */
export function routeQuestion(question: string, env: NodeJS.ProcessEnv = process.env): AnswerRoute {
  const normalizedQuestion = normalizeQuestion(question, env);
  const patterns = getEnterprisePatterns(env);

  return patterns.some((pattern) => pattern.test(normalizedQuestion))
    ? 'enterprise_kb'
    : 'general';
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
