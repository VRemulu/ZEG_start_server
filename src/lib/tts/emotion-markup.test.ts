import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmotionMarkup } from './emotion-markup';

test('parseEmotionMarkup 情绪语法解析测试 - 正常解析全角括号情绪前缀', () => {
  const res = parseEmotionMarkup('（开心地说）今天天气真好呀');
  assert.equal(res.emotionText, '开心地说');
  assert.equal(res.speechText, '今天天气真好呀');
  assert.equal(res.zegoFormattedText, '[[[{"context_texts":["开心地说"]}]]]今天天气真好呀');
});

test('parseEmotionMarkup 情绪语法解析测试 - 正常解析半角括号情绪前缀', () => {
  const res = parseEmotionMarkup('(温柔地说)您好，请问有什么可以帮您？');
  assert.equal(res.emotionText, '温柔地说');
  assert.equal(res.speechText, '您好，请问有什么可以帮您？');
  assert.equal(res.zegoFormattedText, '[[[{"context_texts":["温柔地说"]}]]]您好，请问有什么可以帮您？');
});

test('parseEmotionMarkup 情绪语法解析测试 - 无情绪前缀保留原样', () => {
  const res = parseEmotionMarkup('今天天气真好呀');
  assert.equal(res.emotionText, undefined);
  assert.equal(res.speechText, '今天天气真好呀');
  assert.equal(res.zegoFormattedText, '今天天气真好呀');
});

test('parseEmotionMarkup 情绪语法解析测试 - 处理多个前缀仅提取第一个', () => {
  const res = parseEmotionMarkup('（开心地说）（严肃地）今天天气真好');
  assert.equal(res.emotionText, '开心地说');
  assert.equal(res.speechText, '（严肃地）今天天气真好');
  assert.equal(res.zegoFormattedText, '[[[{"context_texts":["开心地说"]}]]]（严肃地）今天天气真好');
});

test('parseEmotionMarkup 情绪语法解析测试 - 处理空输入', () => {
  const res = parseEmotionMarkup('');
  assert.equal(res.emotionText, undefined);
  assert.equal(res.speechText, '');
  assert.equal(res.zegoFormattedText, '');
});

