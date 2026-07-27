import test from 'node:test';
import assert from 'node:assert/strict';

test('routes Qingdao Zhanqiao and other general questions away from the enterprise KB', async () => {
  const { routeQuestion } = await import('./question-routing.ts');

  assert.equal(routeQuestion('对，说一下青岛的栈桥。'), 'general');
  assert.equal(routeQuestion('讲个笑话'), 'general');
  assert.equal(routeQuestion('这个旅游项目有什么特色？'), 'general');
  assert.equal(routeQuestion('介绍一家科技公司'), 'general');
});

test('routes high-confidence internal business questions to the enterprise KB', async () => {
  const { routeQuestion } = await import('./question-routing.ts');

  assert.equal(routeQuestion('青岛嘉信讯通信息有限公司有哪些项目？'), 'enterprise_kb');
  assert.equal(routeQuestion('这个项目的合同金额是多少？'), 'enterprise_kb');
  assert.equal(routeQuestion('查询一下发票信息'), 'enterprise_kb');
  assert.equal(routeQuestion('客户名称和验收情况是什么？'), 'enterprise_kb');
});

test('routes "科小能力申报" and homophone ASR variant "柯小能力申报" to enterprise KB', async () => {
  const { routeQuestion, normalizeQuestion } = await import('./question-routing.ts');

  assert.equal(normalizeQuestion('柯小能力申报'), '科小能力申报');
  assert.equal(routeQuestion('科小能力申报'), 'enterprise_kb');
  assert.equal(routeQuestion('柯小能力申报'), 'enterprise_kb');
  assert.equal(routeQuestion('科小能力申报。'), 'enterprise_kb');
  assert.equal(routeQuestion('关于售前项目一览'), 'enterprise_kb');
});

test('supports dynamic enterprise keywords from environment variable', async () => {
  const { routeQuestion } = await import('./question-routing.ts');

  const customEnv = { ENTERPRISE_KEYWORDS: '自定义特有项目名,某些私有关键词' };
  assert.equal(routeQuestion('自定义特有项目名', customEnv), 'enterprise_kb');
  assert.equal(routeQuestion('某些私有关键词', customEnv), 'enterprise_kb');
});

test('supports dynamic ASR corrections from environment variable', async () => {
  const { normalizeQuestion, routeQuestion } = await import('./question-routing.ts');

  const customEnv = { ASR_CORRECTIONS: '错别词:正确词' };
  assert.equal(normalizeQuestion('这是一个错别词测试', customEnv), '这是一个正确词测试');
});

test('builds a general answer request without enterprise reference material', async () => {
  const { buildRoutedUserContent } = await import('./question-routing.ts');
  const content = buildRoutedUserContent(
    '介绍一下青岛栈桥',
    'general',
    '内部合同金额为 100 万元',
  );

  assert.match(content, /介绍一下青岛栈桥/);
  assert.match(content, /直接回答/);
  assert.doesNotMatch(content, /内部合同金额/);
  assert.doesNotMatch(content, /以下是知识库查询结果/);
});

test('builds a grounded enterprise answer request with retrieved content', async () => {
  const { buildRoutedUserContent } = await import('./question-routing.ts');
  const content = buildRoutedUserContent(
    '项目合同金额是多少？',
    'enterprise_kb',
    '合同金额：100 万元',
  );

  assert.match(content, /只能根据参考资料回答/);
  assert.match(content, /合同金额：100 万元/);
  assert.match(content, /不得编造/);
});

test('tells the model not to invent enterprise facts when retrieval is empty', async () => {
  const { buildRoutedUserContent } = await import('./question-routing.ts');
  const content = buildRoutedUserContent('查询合同金额', 'enterprise_kb', '');

  assert.match(content, /没有可用的参考资料/);
  assert.match(content, /无法从现有资料确认/);
});
