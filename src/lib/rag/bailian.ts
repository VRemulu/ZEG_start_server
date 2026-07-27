import * as bailian20231229 from '@alicloud/bailian20231229'
import * as OpenApi from '@alicloud/openapi-client'
import * as Util from '@alicloud/tea-util'
import { logInfo, logError } from '../logger.ts'

// ────────────────────────────────────────────────────────────
// 结构化检索片段契约（供问答入口和测试统一消费）
// ────────────────────────────────────────────────────────────

export interface RetrievalChunk {
  id?: string;
  text: string;
  documentName?: string;
  /** score 来源：重排得分或原始相似度 */
  score: number;
  scoreKind: 'rerank' | 'similarity';
  source: 'bailian';
}

export interface KnowledgeRetrievalResult {
  chunks: RetrievalChunk[];
  /** 兼容现有问答入口直接消费的拼接字符串 */
  kbContent: string;
  /** 脱敏的检索摘要，用于日志和观测 */
  summary: {
    provider: 'bailian';
    totalReturned: number;
    afterFilter: number;
    rerankEnabled: boolean;
    elapsedMs: number;
  };
}

// ────────────────────────────────────────────────────────────
// 重排配置解析（提取为纯函数便于单元测试）
// ────────────────────────────────────────────────────────────

export interface RerankConfig {
  enabled: boolean;
  minScore: number;
  topN: number;
}

/**
 * 解析并验证三个百炼重排环境变量。
 * NOTE: BAILIAN_RERANK_ENABLED 必须严格比对字符串 'true'，防止 Boolean('false') 误判。
 */
export function parseRerankConfig(env: NodeJS.ProcessEnv = process.env): RerankConfig {
  const enabled = env.BAILIAN_RERANK_ENABLED === 'true';

  // 解析 minScore
  const rawMinScore = env.BAILIAN_RERANK_MIN_SCORE || '0.20';
  const minScore = parseFloat(rawMinScore);
  if (!isFinite(minScore) || minScore < 0.01 || minScore > 1.0) {
    throw new Error(
      `BAILIAN_RERANK_MIN_SCORE 必须是 0.01 ~ 1.00 之间的有限数字，当前值: "${rawMinScore}"`
    );
  }

  // 解析 topN
  const rawTopN = env.BAILIAN_RERANK_TOP_N || '5';
  const topN = parseInt(rawTopN, 10);
  if (!isFinite(topN) || topN < 1 || topN > 20) {
    throw new Error(
      `BAILIAN_RERANK_TOP_N 必须是 1 ~ 20 之间的整数，当前值: "${rawTopN}"`
    );
  }

  return { enabled, minScore, topN };
}

// ────────────────────────────────────────────────────────────
// 节点过滤与排序（提取为纯函数便于单元测试）
// ────────────────────────────────────────────────────────────

interface RawNode {
  metadata?: { doc_name?: string };
  text?: string;
  score?: number;
}

/**
 * 对百炼返回的原始节点列表做防御性过滤：
 * 1. 丢弃缺少 text 的节点（防止注入 undefined）
 * 2. 节点缺少 score 时视为 0 分（低质量，将在阈值过滤阶段被丢弃）
 * 3. 按 score 降序排列
 * 4. 过滤掉低于 minScore 的节点
 * 5. 取前 maxCount 条
 */
export function filterAndRankNodes(
  nodes: RawNode[],
  minScore: number,
  maxCount: number
): RetrievalChunk[] {
  return nodes
    .filter((node) => typeof node.text === 'string' && node.text.trim().length > 0)
    .map((node): RetrievalChunk => ({
      text: node.text as string,
      documentName: node.metadata?.doc_name ?? undefined,
      // NOTE: score 缺失时视为 0 分，确保这类节点被阈值过滤丢弃
      score: typeof node.score === 'number' && isFinite(node.score) ? node.score : 0,
      scoreKind: 'rerank',
      source: 'bailian',
    }))
    .sort((a, b) => b.score - a.score)
    .filter((chunk) => chunk.score >= minScore)
    .slice(0, maxCount);
}

// ────────────────────────────────────────────────────────────
// 阿里云客户端工厂
// ────────────────────────────────────────────────────────────

const createClient = () => {
  const config = new OpenApi.Config({
    accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  });
  config.endpoint = process.env.ALIBABA_CLOUD__SERVICE_ENDPOINT;
  return new bailian20231229.default(config);
};

// ────────────────────────────────────────────────────────────
// 主检索函数
// ────────────────────────────────────────────────────────────

/**
 * 向阿里云百炼知识库发起检索请求，返回结构化召回结果。
 *
 * 零召回（过滤后无有效片段）：返回空 chunks 和空 kbContent，不抛出异常。
 * 服务异常（鉴权失败/超时/接口报错/响应结构异常）：抛出明确异常，
 *   由调用方区分处理，不得伪装成"知识库没有资料"。
 */
export const retrieveFromBailian = async ({
  query,
}: {
  query: string;
}): Promise<KnowledgeRetrievalResult> => {
  const rerankConfig = parseRerankConfig();

  // KB_CHUNK_COUNT 是最终注入 LLM 的上限；BAILIAN_RERANK_TOP_N 是重排候选上限
  // 两者取较小值，避免含义不明的双重截断
  const kbChunkCount = Number(process.env.KB_CHUNK_COUNT) || 8;
  const maxCount = Math.min(rerankConfig.topN, kbChunkCount);

  const client = createClient();
  const retrieveRequest = new bailian20231229.RetrieveRequest({
    query,
    enableReranking: rerankConfig.enabled,
    ...(rerankConfig.enabled && {
      rerankMinScore: rerankConfig.minScore,
      rerankTopN: rerankConfig.topN,
    }),
    indexId: process.env.ALIBABA_CLOUD_BAILIAN_KB_INDEX_ID,
  });

  const runtime = new Util.RuntimeOptions({});
  const headers = {};

  // NOTE: 仅记录查询意图，不记录查询原文，防止日志泄露用户输入
  logInfo(`[bailian] 开始检索，rerankEnabled=${rerankConfig.enabled}`);
  const startMs = Date.now();

  const result = await client.retrieveWithOptions(
    process.env.ALIBABA_CLOUD_BAILIAN_WORKSPACE_ID!,
    retrieveRequest,
    headers,
    runtime
  );

  const elapsedMs = Date.now() - startMs;

  // NOTE: 区分"服务异常"与"零召回"——接口本身失败才抛出异常
  if (!result?.body?.success) {
    const errMsg = `[bailian] 检索接口返回失败，success=false，耗时 ${elapsedMs}ms`;
    logError(errMsg);
    throw new Error(errMsg);
  }

  const rawNodes: RawNode[] = result?.body?.data?.nodes ?? [];

  // 注意：data.nodes 可能不存在（响应结构异常），统一视为服务异常
  if (!Array.isArray(result?.body?.data?.nodes)) {
    const structErrMsg = `[bailian] 响应结构异常：data.nodes 不是数组，耗时 ${elapsedMs}ms`;
    logError(structErrMsg);
    throw new Error(structErrMsg);
  }

  const chunks = filterAndRankNodes(rawNodes, rerankConfig.minScore, maxCount);

  // 脱敏日志：只记录数量和耗时，不记录片段正文、文档名或原始响应
  logInfo(
    `[bailian] 检索完成，总召回=${rawNodes.length}，过滤后=${chunks.length}，耗时=${elapsedMs}ms，rerankEnabled=${rerankConfig.enabled}`
  );

  // 零召回：返回空结果，由问答入口的 buildRoutedUserContent 触发"无法从现有资料确认"
  const kbContent = chunks
    .map((chunk) => `doc_name: ${chunk.documentName ?? '未知文档'}\ncontent: ${chunk.text}`)
    .join('\n\n');

  return {
    chunks,
    kbContent,
    summary: {
      provider: 'bailian',
      totalReturned: rawNodes.length,
      afterFilter: chunks.length,
      rerankEnabled: rerankConfig.enabled,
      elapsedMs,
    },
  };
};