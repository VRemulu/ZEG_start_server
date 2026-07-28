/**
 * 情绪语法解析结果
 */
export interface EmotionMarkupResult {
  /** 提取到的情绪文本，如 "开心地说" */
  emotionText?: string;
  /** 过滤情绪控制块后的朗读正文，如 "今天天气真好呀" */
  speechText: string;
  /** 附带 ZEGO ByteDanceV3 元数据的前缀文本 */
  zegoFormattedText: string;
}

/**
 * 解析带有中文/英文括号的情绪前缀文本
 * 
 * 示例：
 * - "（开心地说）今天天气真好呀" => 情绪: "开心地说", 正文: "今天天气真好呀"
 * - "(温柔地说)您好" => 情绪: "温柔地说", 正文: "您好"
 * - "今天天气真好" => 无情绪前缀
 * 
 * @param input 原始输入字符串
 */
export function parseEmotionMarkup(input: string): EmotionMarkupResult {
  if (!input || typeof input !== 'string') {
    return {
      speechText: '',
      zegoFormattedText: '',
    };
  }

  const trimmed = input.trim();

  // 正则表达匹配开头包含的全角（）或半角 () 括号
  // 只匹配字符串最前面的第一组括号
  const bracketRegex = /^(?:[（\(]([^（\)\(\)]+)[）\)])\s*([\s\S]*)/;
  const match = trimmed.match(bracketRegex);

  if (match) {
    const emotionText = match[1].trim();
    const speechText = match[2].trim();

    if (emotionText) {
      const meta = JSON.stringify([{ context_texts: [emotionText] }]);
      const zegoFormattedText = `[[${meta}]]${speechText}`;

      return {
        emotionText,
        speechText,
        zegoFormattedText,
      };
    }
  }

  return {
    speechText: trimmed,
    zegoFormattedText: trimmed,
  };
}
