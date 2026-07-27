import test from 'node:test';
import assert from 'node:assert/strict';

test('routes Qingdao Zhanqiao, weather and chat questions to general route via exclude patterns', async () => {
  const { routeQuestion } = await import('./question-routing.ts');

  assert.equal(routeQuestion('对，说一下青岛的栈桥。'), 'general');
  assert.equal(routeQuestion('今天天气怎么样？'), 'general');
  assert.equal(routeQuestion('讲个笑话'), 'general');
  assert.equal(routeQuestion('翻译成英文'), 'general');
});

test('Zero-Maintenance architecture: all new projects, companies and short phrases route to enterprise KB by default', async () => {
  const { routeQuestion, normalizeQuestion } = await import('./question-routing.ts');

  // 新增项目名称与极简短语，无需配置任何关键词即可自动路由至 enterprise_kb
  assert.equal(routeQuestion('军舰数字孪生'), 'enterprise_kb');
  assert.equal(routeQuestion('医院送药吹气管道'), 'enterprise_kb');
  assert.equal(routeQuestion('养老APP项目'), 'enterprise_kb');
  assert.equal(routeQuestion('科小能力申报'), 'enterprise_kb');
  assert.equal(routeQuestion('未来上传的任意新文件项目名称'), 'enterprise_kb');
  assert.equal(normalizeQuestion('柯小能力申报'), '科小能力申报');
  assert.equal(routeQuestion('柯小能力申报'), 'enterprise_kb');
});

test('supports dynamic ASR corrections from environment variable', async () => {
  const { normalizeQuestion } = await import('./question-routing.ts');

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
    '军舰数字孪生负责人是谁？',
    'enterprise_kb',
    '项目名称:军舰数字孪生 项目负责人:刘元甲,王新',
  );

  assert.match(content, /只能根据参考资料回答/);
  assert.match(content, /项目负责人:刘元甲,王新/);
  assert.match(content, /不得编造/);
});

test('tells the model not to invent enterprise facts when retrieval is empty', async () => {
  const { buildRoutedUserContent } = await import('./question-routing.ts');
  const content = buildRoutedUserContent('查询合同金额', 'enterprise_kb', '');

  assert.match(content, /没有可用的参考资料/);
  assert.match(content, /无法从现有资料确认/);
});
