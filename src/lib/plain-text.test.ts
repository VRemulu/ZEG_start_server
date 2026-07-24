import test from 'node:test';
import assert from 'node:assert/strict';

test('exports the speech-safe text sanitizer', async () => {
  const module = await import('./plain-text.ts').catch(() => ({}));

  assert.equal(typeof module.sanitizeSpeechText, 'function');
});

test('removes Markdown formatting and emoji from spoken output', async () => {
  const { sanitizeSpeechText } = await import('./plain-text.ts');
  const source = '**核心资料** 📌\n### 公司业务\n- 智慧城市\n1. 数字人\n`Spring MVC`';

  assert.equal(
    sanitizeSpeechText(source),
    '核心资料 \n公司业务\n智慧城市\n数字人\nSpring MVC',
  );
});

test('keeps useful text from links and preserves ordinary technical content', async () => {
  const { sanitizeSpeechText } = await import('./plain-text.ts');
  const source = '请查看[公司介绍](https://example.com)。支持 WebSocket、MySQL/Oracle、CAP4J 2.0。';

  assert.equal(
    sanitizeSpeechText(source),
    '请查看公司介绍。支持 WebSocket、MySQL/Oracle、CAP4J 2.0。',
  );
});

test('returns an empty string for formatting-only chunks', async () => {
  const { sanitizeSpeechText } = await import('./plain-text.ts');

  assert.equal(sanitizeSpeechText('**📌`'), '');
});
