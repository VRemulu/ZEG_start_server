export type AnswerRoute = 'enterprise_kb' | 'general';

const ENTERPRISE_PATTERNS: RegExp[] = [
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
];

/**
 * Uses high-confidence business phrases to decide whether an enterprise
 * knowledge-base lookup is appropriate. Ambiguous questions default to the
 * general route so unrelated internal documents are never injected.
 */
export function routeQuestion(question: string): AnswerRoute {
  const normalizedQuestion = question.trim();

  return ENTERPRISE_PATTERNS.some((pattern) => pattern.test(normalizedQuestion))
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
