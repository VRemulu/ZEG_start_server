import { parseEmotionMarkup } from './emotion-markup';

describe('parseEmotionMarkup 情绪语法解析测试', () => {
  test('正常解析全角括号情绪前缀', () => {
    const res = parseEmotionMarkup('（开心地说）今天天气真好呀');
    expect(res.emotionText).toBe('开心地说');
    expect(res.speechText).toBe('今天天气真好呀');
    expect(res.zegoFormattedText).toBe('[[[{"context_texts":["开心地说"]}]]]今天天气真好呀');
  });

  test('正常解析半角括号情绪前缀', () => {
    const res = parseEmotionMarkup('(温柔地说)您好，请问有什么可以帮您？');
    expect(res.emotionText).toBe('温柔地说');
    expect(res.speechText).toBe('您好，请问有什么可以帮您？');
    expect(res.zegoFormattedText).toBe('[[[{"context_texts":["温柔地说"]}]]]您好，请问有什么可以帮您？');
  });

  test('无情绪前缀保留原样', () => {
    const res = parseEmotionMarkup('今天天气真好呀');
    expect(res.emotionText).toBeUndefined();
    expect(res.speechText).toBe('今天天气真好呀');
    expect(res.zegoFormattedText).toBe('今天天气真好呀');
  });

  test('处理多个前缀仅提取第一个', () => {
    const res = parseEmotionMarkup('（开心地说）（严肃地）今天天气真好');
    expect(res.emotionText).toBe('开心地说');
    expect(res.speechText).toBe('（严肃地）今天天气真好');
    expect(res.zegoFormattedText).toBe('[[[{"context_texts":["开心地说"]}]]]（严肃地）今天天气真好');
  });

  test('处理空输入', () => {
    const res = parseEmotionMarkup('');
    expect(res.emotionText).toBeUndefined();
    expect(res.speechText).toBe('');
    expect(res.zegoFormattedText).toBe('');
  });
});
