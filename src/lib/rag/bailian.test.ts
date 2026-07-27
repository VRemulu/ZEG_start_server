import test from 'node:test';
import assert from 'node:assert/strict';

// ────────────────────────────────────────────────────────────
// parseRerankConfig 测试
// ────────────────────────────────────────────────────────────

test('parseRerankConfig: BAILIAN_RERANK_ENABLED=false 时正确关闭重排', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  const cfg = parseRerankConfig({ BAILIAN_RERANK_ENABLED: 'false', BAILIAN_RERANK_MIN_SCORE: '0.20', BAILIAN_RERANK_TOP_N: '5' });
  assert.equal(cfg.enabled, false);
});

test('parseRerankConfig: BAILIAN_RERANK_ENABLED=true 时启用重排', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  const cfg = parseRerankConfig({ BAILIAN_RERANK_ENABLED: 'true', BAILIAN_RERANK_MIN_SCORE: '0.20', BAILIAN_RERANK_TOP_N: '5' });
  assert.equal(cfg.enabled, true);
});

test('parseRerankConfig: 未设置时默认关闭（防止意外开启）', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  const cfg = parseRerankConfig({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.minScore, 0.20);
  assert.equal(cfg.topN, 5);
});

test('parseRerankConfig: minScore 合法边界值（0.01 和 1.00）解析正确', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  const low = parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '0.01', BAILIAN_RERANK_TOP_N: '5' });
  const high = parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '1.00', BAILIAN_RERANK_TOP_N: '5' });
  assert.equal(low.minScore, 0.01);
  assert.equal(high.minScore, 1.00);
});

test('parseRerankConfig: topN 合法边界值（1 和 20）解析正确', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  const low = parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '0.20', BAILIAN_RERANK_TOP_N: '1' });
  const high = parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '0.20', BAILIAN_RERANK_TOP_N: '20' });
  assert.equal(low.topN, 1);
  assert.equal(high.topN, 20);
});

test('parseRerankConfig: minScore 非数字时抛出包含变量名的明确错误', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  assert.throws(
    () => parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: 'abc', BAILIAN_RERANK_TOP_N: '5' }),
    (err: Error) => err.message.includes('BAILIAN_RERANK_MIN_SCORE')
  );
});

test('parseRerankConfig: minScore 越界（大于 1.0）时抛出错误', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  assert.throws(
    () => parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '1.5', BAILIAN_RERANK_TOP_N: '5' }),
    (err: Error) => err.message.includes('BAILIAN_RERANK_MIN_SCORE')
  );
});

test('parseRerankConfig: topN 越界（大于 20）时抛出错误', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  assert.throws(
    () => parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '0.20', BAILIAN_RERANK_TOP_N: '21' }),
    (err: Error) => err.message.includes('BAILIAN_RERANK_TOP_N')
  );
});

test('parseRerankConfig: topN 空字符串时使用默认值 5', async () => {
  const { parseRerankConfig } = await import('./bailian.ts');
  // 空字符串等同于未设置
  const cfg = parseRerankConfig({ BAILIAN_RERANK_MIN_SCORE: '0.20', BAILIAN_RERANK_TOP_N: '' });
  assert.equal(cfg.topN, 5);
});

// ────────────────────────────────────────────────────────────
// filterAndRankNodes 测试
// ────────────────────────────────────────────────────────────

test('filterAndRankNodes: 按 score 降序排列', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = [
    { text: '片段A', score: 0.5, metadata: { doc_name: 'doc1' } },
    { text: '片段B', score: 0.9, metadata: { doc_name: 'doc2' } },
    { text: '片段C', score: 0.3, metadata: { doc_name: 'doc3' } },
  ];
  const result = filterAndRankNodes(nodes, 0.2, 10);
  assert.equal(result[0].text, '片段B');
  assert.equal(result[1].text, '片段A');
  assert.equal(result[2].text, '片段C');
});

test('filterAndRankNodes: 低于阈值的节点被过滤', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = [
    { text: '高分片段', score: 0.8, metadata: {} },
    { text: '低分片段', score: 0.1, metadata: {} },
  ];
  const result = filterAndRankNodes(nodes, 0.2, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '高分片段');
});

test('filterAndRankNodes: 所有节点低于阈值时返回空数组（零召回）', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = [
    { text: '片段A', score: 0.05, metadata: {} },
    { text: '片段B', score: 0.1, metadata: {} },
  ];
  const result = filterAndRankNodes(nodes, 0.20, 10);
  assert.equal(result.length, 0);
});

test('filterAndRankNodes: 按 maxCount 截断', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = Array.from({ length: 10 }, (_, i) => ({
    text: `片段${i}`,
    score: 0.9 - i * 0.05,
    metadata: {},
  }));
  const result = filterAndRankNodes(nodes, 0.1, 3);
  assert.equal(result.length, 3);
});

test('filterAndRankNodes: 节点缺少 score 时视为 0 分并被阈值过滤', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = [
    { text: '无分片段', metadata: {} }, // 无 score
    { text: '有分片段', score: 0.8, metadata: {} },
  ];
  const result = filterAndRankNodes(nodes as any, 0.20, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '有分片段');
});

test('filterAndRankNodes: 节点缺少 metadata.doc_name 时不崩溃，documentName 为 undefined', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = [
    { text: '片段', score: 0.8 }, // 无 metadata
  ];
  const result = filterAndRankNodes(nodes as any, 0.2, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].documentName, undefined);
});

test('filterAndRankNodes: 节点缺少 text 时被过滤，不注入 undefined', async () => {
  const { filterAndRankNodes } = await import('./bailian.ts');
  const nodes = [
    { score: 0.8, metadata: {} }, // 无 text
    { text: '有效片段', score: 0.7, metadata: {} },
  ];
  const result = filterAndRankNodes(nodes as any, 0.2, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, '有效片段');
});

// ────────────────────────────────────────────────────────────
// 路由不回归验证（确保批次 A 未破坏问题路由）
// ────────────────────────────────────────────────────────────

test('routeQuestion: 青岛栈桥仍路由为 general，不进入企业知识库', async () => {
  const { routeQuestion } = await import('../question-routing.ts');
  assert.equal(routeQuestion('对，说一下青岛的栈桥。'), 'general');
  assert.equal(routeQuestion('介绍一下青岛栈桥'), 'general');
  assert.equal(routeQuestion('讲个笑话'), 'general');
});

test('routeQuestion: 企业业务问题路由为 enterprise_kb', async () => {
  const { routeQuestion } = await import('../question-routing.ts');
  assert.equal(routeQuestion('这个项目的合同金额是多少？'), 'enterprise_kb');
  assert.equal(routeQuestion('查询发票信息'), 'enterprise_kb');
});

// ────────────────────────────────────────────────────────────
// 零召回时 buildRoutedUserContent 不允许编造
// ────────────────────────────────────────────────────────────

test('buildRoutedUserContent: 企业路由零召回时明确说明无法确认，禁止编造', async () => {
  const { buildRoutedUserContent } = await import('../question-routing.ts');
  const content = buildRoutedUserContent('合同金额是多少', 'enterprise_kb', '');
  assert.match(content, /无法从现有资料确认/);
  assert.match(content, /不得编造/);
  assert.doesNotMatch(content, /知识库查询结果/);
});
