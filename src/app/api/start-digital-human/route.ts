import { NextRequest, NextResponse } from "next/server";
import { CONSTANTS, LLMConfig, TTSConfig, ZegoAIAgent } from "@/lib/zego/aiagent";
import { AgentStore } from "@/lib/store";

// 类型定义
interface StartDigitalHumanRequest {
  digital_human_id: string;
  config_id: string;
  user_id: string;
  room_id: string;
  user_stream_id: string;
}

interface DigitalHumanResponse {
  code: number;
  message: string;
  agent_id?: string;
  agent_name?: string;
  agent_instance_id?: string;
  digital_human_config?: any;
  request_id?: string;
  agent_stream_id?: string;
  agent_user_id?: string;
}

// 工具函数
function generateRandomId(prefix: string): string {
  return prefix + Math.random().toString(36).substring(2, 10);
}

function validateRequestBody(body: any): body is StartDigitalHumanRequest {
  const requiredFields = ['digital_human_id', 'config_id', 'user_id', 'room_id', 'user_stream_id'];
  return requiredFields.every(field => typeof body[field] === 'string' && body[field].trim());
}

// 创建数字人实例
async function createDigitalHumanInstance(
  assistant: any,
  agentId: string,
  userId: string,
  roomConfig: any,
  digitalHumanConfig: any,
  llmConfig?: LLMConfig,
  ttsConfig?: TTSConfig
): Promise<any> {
  const result = await assistant.createDigitalHumanAgentInstance(
    agentId,
    userId,
    roomConfig,
    digitalHumanConfig,
    llmConfig,
    ttsConfig
  );

  console.log(`创建数字人实例结果: ${result.Code}`);
  return result;
}

// 处理数字人并发限制降级
async function handleConcurrencyLimit(
  assistant: any,
  agentId: string,
  userId: string,
  roomConfig: any
): Promise<NextResponse> {
  const { LLM, TTS } = assistant.getDefaultAgentConfig();
  const fallbackResult = await assistant.createAgentInstance(agentId, userId, roomConfig, LLM, TTS);

  const response: DigitalHumanResponse = {
    code: fallbackResult.Code,
    agent_id: agentId,
    agent_name: CONSTANTS.AGENT_NAME,
    agent_instance_id: fallbackResult.Data.AgentInstanceId,
    request_id: fallbackResult.Data.RequestId,
    agent_stream_id: roomConfig.AgentStreamId,
    agent_user_id: roomConfig.AgentUserId,
    message: `数字人并发已满，已启动语音互动模式: ${fallbackResult.Message}`,
  };

  return NextResponse.json(response, { status: 200 });
}

// 创建成功响应
function createSuccessResponse(
  agentId: string,
  agentName: string,
  agentInstanceId: string,
  digitalHumanConfig: any,
  requestId: string,
  agentStreamId: string,
  agentUserId: string,
): NextResponse {
  const response: DigitalHumanResponse = {
    code: 0,
    message: "数字人智能体启动成功",
    agent_id: agentId,
    agent_name: agentName,
    agent_instance_id: agentInstanceId,
    digital_human_config: digitalHumanConfig,
    request_id: requestId,
    agent_stream_id: agentStreamId,
    agent_user_id: agentUserId,
  };

  return NextResponse.json(response, { status: 200 });
}

// 创建错误响应
function createErrorResponse(code: number, message: string): NextResponse {
  const response: DigitalHumanResponse = {
    code,
    message
  };

  return NextResponse.json(response, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 解析和验证请求体
    const body = await req.json();
    if (!validateRequestBody(body)) {
      return NextResponse.json(
        {
          code: 400,
          message: "请求参数不完整，缺少必需字段: digital_human_id, config_id, user_id, room_id, user_stream_id"
        },
        { status: 400 }
      );
    }

    const {
      digital_human_id,
      config_id,
      user_id,
      room_id,
      user_stream_id,
    } = body;

    // 生成随机ID for 智能体
    const agent_stream_id = generateRandomId("stream_agent_");
    const agent_user_id = generateRandomId("user_agent_");

    // 初始化服务
    const assistant = ZegoAIAgent.getInstance();
    const store = AgentStore.getInstance();

    // 确保智能体已注册
    await assistant.ensureAgentRegistered(CONSTANTS.AGENT_ID, CONSTANTS.AGENT_NAME);

    // 构建配置
    const roomConfig = {
      RoomId: room_id,
      AgentStreamId: agent_stream_id,
      AgentUserId: agent_user_id,
      UserStreamId: user_stream_id,
    };

    const digitalHumanConfig = {
      DigitalHumanId: digital_human_id,
      ConfigId: config_id,
    };

    // 获取最新的默认智能体配置
    const { LLM, TTS } = assistant.getDefaultAgentConfig();

    // 创建数字人实例（显式传入 LLM 和 TTS，强制覆盖音色）
    const result = await createDigitalHumanInstance(
      assistant,
      CONSTANTS.AGENT_ID,
      user_id,
      roomConfig,
      digitalHumanConfig,
      LLM,
      TTS
    );

    // 处理结果
    if (result.Code !== 0) {
      if (result.Code === CONSTANTS.ERROR_CODES.DIGITAL_HUMAN_CONCURRENCY_LIMIT) {
        return await handleConcurrencyLimit(assistant, CONSTANTS.AGENT_ID, user_id, roomConfig);
      } else {
        return createErrorResponse(result.Code, result.Message);
      }
    }

    // 保存实例ID
    const agentInstanceId = result.Data.AgentInstanceId;
    store.setAgentInstanceId(agentInstanceId);

    // 返回成功响应
    return createSuccessResponse(
      CONSTANTS.AGENT_ID,
      CONSTANTS.AGENT_NAME,
      agentInstanceId,
      result.Data.DigitalHumanConfig,
      result.Data.RequestId,
      agent_stream_id,
      agent_user_id,
    );

  } catch (error) {
    console.error("启动数字人智能体失败:", error);

    const errorCode = (error as any).code || 500;
    const errorMessage = (error as any).message || "启动数字人智能体时发生未知错误";

    return NextResponse.json(
      {
        code: errorCode,
        message: errorMessage,
      },
      { status: errorCode >= 400 && errorCode < 500 ? errorCode : 500 }
    );
  }
}
