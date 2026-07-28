import { createHash } from 'crypto';
import { isEqual } from '@/lib/object';

const SYSTEM_PROMPT = `
请严格遵循后台附加在用户问题后的“回答要求”，用友好、简洁、口语化的自然段回答，内容应适合数字人直接语音播报。
只输出纯文本，不要使用 Markdown、标题符号、加粗符号、项目符号、编号列表、表格、代码块、链接格式或 emoji。
如果需要调整表达语气，可以在回答的最开头使用全角括号注明语气，例如：（亲切地说）或（严肃地说）。如果使用默认语气，则不需要添加括号。
企业业务问题只能依据后台提供的参考资料回答；资料不足时说明无法从现有资料确认，不得编造。
通用问题应直接使用稳定的通用知识回答，不要提及知识库、内部资料或检索过程。涉及当前开放状态、实时票价、天气或交通管制时，不得把静态知识当作实时事实。
不要在用户问题已经明确时机械地追加“是否需要更多内容”等反问。
`;

// 常量定义
export const CONSTANTS = {
    AGENT_ID: "ai_agent_example_1",
    AGENT_NAME: "李浩然",
    ERROR_CODES: {
      DIGITAL_HUMAN_CONCURRENCY_LIMIT: 410001025,
    },
  } as const;

export interface RtcInfo {
    RoomId: string;
    AgentStreamId: string;
    AgentUserId: string;
    UserStreamId: string;
}

interface ZegoConfig {
    appId: number;
    serverSecret: string;
}

interface CommonParams {
    AppId: number;
    Signature: string;
    SignatureNonce: string;
    SignatureVersion: string;
    Timestamp: number;
}

interface SignatureParams {
    appId: number;
    signatureNonce: string;
    serverSecret: string;
    timestamp: number;
    action: string;
}

export interface LLMConfig {
    Url: string;
    ApiKey: string;
    Model: string;
    SystemPrompt?: string;
    Temperature?: number;
    TopP?: number;
    Params?: any;
}

export interface FilterText {
    BeginCharacters: string;
    EndCharacters: string;
}

/**
 * ByteDanceV3 TTS 情绪控制高级配置
 *
 * 告诉 ZEGO 如何从 LLM 输出的文本中解析 [[{"context_texts":["开心地说"]}]] 元数据标签，
 * 并将解析到的情绪参数（如 context_texts）映射到火山引擎 TTS 的对应参数路径，
 * 从而实现逐句动态调整数字人语气（开心/温柔/严肃等）。
 *
 * 只有 Vendor="ByteDanceV3" 时才需要使用此配置。
 *
 * @see https://doc-zh.zego.im/aiagent-server/advanced/controlling-tts-effects
 */
export interface AdvancedConfig {
    /** 元数据标签解析规则：定义标签的起止边界 */
    LLMMetaInfo: {
        Enabled: boolean;    // 是否启用元数据标签解析
        StartMark: string;   // 起始标记，通常为 "[[" 
        EndMark: string;     // 结束标记，通常为 "]]"
    };
    /** 参数路径映射：将元数据 JSON 中的字段映射到火山 TTS req_params 路径 */
    TTSParamPaths: Array<{
        ParamPath: string;   // 火山 TTS 参数路径，如 "req_params.context_texts"
        Source: string;      // 元数据 JSON 中的字段名，如 "context_texts"
    }>;
}

export interface TTSConfig {
    Vendor: string;
    Params?: any;
    FilterText?: FilterText[];
    /** ByteDanceV3 情绪控制高级配置（仅 Vendor="ByteDanceV3" 时生效） */
    AdvancedConfig?: AdvancedConfig;
}

export interface ASRConfig {
    HotWord?: string;
    Params?: any;
}

export interface ZIMConfig {
    RobotId: string;
    LoadMessageCount: number;
}

export interface DigitalHumanInfo {
    DigitalHumanId: string;
    ConfigId: string;
}

export interface MessageHistory {
    SyncMode: number;
    Messages: any[];
    WindowSize: number;
    ZIM: ZIMConfig;
}

export interface CallbackConfig {
    ASRResult: number;
    LLMResult: number;
}

// 会话消息响应类型
export interface ConversationMessagesResponse {
    Code: number;
    Message: string;
    RequestId: string;
    Data: any;
}

export class ZegoAIAgent {
    private static instance: ZegoAIAgent;
    private appId: number;
    private serverSecret: string;
    private baseUrl = 'https://aigc-aiagent-api.zegotech.cn';

    private constructor(config: ZegoConfig) {
        this.appId = config.appId;
        this.serverSecret = config.serverSecret;
    }

    public static getInstance(): ZegoAIAgent {
        if (!ZegoAIAgent.instance) {
            const appId = Number(process.env.NEXT_PUBLIC_ZEGO_APP_ID);
            const serverSecret = process.env.ZEGO_SERVER_SECRET || '';

            if (!appId || !serverSecret) {
                throw new Error('NEXT_PUBLIC_ZEGO_APP_ID and ZEGO_SERVER_SECRET environment variables must be set');
            }

            ZegoAIAgent.instance = new ZegoAIAgent({
                appId,
                serverSecret
            });
        }
        return ZegoAIAgent.instance;
    }

    private generateSignature(params: SignatureParams): string {
        const { appId, signatureNonce, serverSecret, timestamp } = params;
        const str = `${appId}${signatureNonce}${serverSecret}${timestamp}`;
        const hash = createHash('md5');
        hash.update(str);
        return hash.digest('hex');
    }

    private generateCommonParams(action: string): CommonParams {
        const timestamp = Math.floor(Date.now() / 1000);
        const signatureNonce = Math.random().toString(36).substring(2);

        const signature = this.generateSignature({
            appId: this.appId,
            signatureNonce,
            serverSecret: this.serverSecret,
            timestamp,
            action
        });

        return {
            AppId: this.appId,
            SignatureNonce: signatureNonce,
            Timestamp: timestamp,
            SignatureVersion: '2.0',
            Signature: signature
        };
    }

    private buildUrl(action: string, commonParams: CommonParams, baseUrl?: string): string {
        const params = new URLSearchParams({
            Action: action,
            AppId: commonParams.AppId.toString(),
            SignatureNonce: commonParams.SignatureNonce,
            Timestamp: commonParams.Timestamp.toString(),
            SignatureVersion: commonParams.SignatureVersion,
            Signature: commonParams.Signature
        });

        if (baseUrl) {
            return `${baseUrl}/?${params.toString()}`;
        } else {
            return `${this.baseUrl}/?${params.toString()}`;
        }
    }

    async sendRequest<T>(
        action: string,
        body?: any,
        baseURL?: string,
        method: 'GET' | 'POST' = 'POST'
    ): Promise<T> {
        try {
            const commonParams = this.generateCommonParams(action);
            const url = this.buildUrl(action, commonParams, baseURL);

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            return data;
        } catch (error) {
            console.error(`Error in ${action}:`, error);
            throw error;
        }
    }

    async queryAgents(agentIds: string[]) {
        // https://aigc-aiagent-api.zegotech.cn?Action=QueryAgents
        const action = 'QueryAgents';
        const body = {
            AgentIds: agentIds
        };
        const result = await this.sendRequest<any>(action, body);
        console.log("query agents result", result);
        return result.Data.Agents;
    }

    getDefaultAgentConfig() {
        const vendor = process.env.TTS_VENDOR || "ByteDance";
        let ttsConfig: any;

        if (vendor === "ByteDanceV3") {
            ttsConfig = {
                Vendor: "ByteDanceV3",
                Params: {
                    "app": {
                        "appid": process.env.TTS_BYTEDANCE_APP_ID || "zego_test",
                        "token": process.env.TTS_BYTEDANCE_TOKEN || "zego_test",
                        "resource_id": process.env.TTS_BYTEDANCE_RESOURCE_ID || "seed-tts-2.0"
                    },
                    "req_params": {
                        "speaker": process.env.TTS_BYTEDANCE_VOICE_TYPE || "zh_female_vv_uranus_bigtts"
                    }
                },
                /**
                 * 【情绪控制核心】告诉 ZEGO 如何解析 [[{"context_texts":["开心地说"]}]] 格式标签
                 *
                 * 配合 emotion-markup.ts 中的 parseEmotionMarkup() 使用：
                 *  - 用户输入: （开心地说）今天天气真好呀
                 *  - 解析后:  [[{"context_texts":["开心地说"]}]]今天天气真好呀
                 *  - ZEGO 提取 context_texts 并映射到火山 TTS 的 req_params.context_texts
                 *  - 数字人用开心语气说 "今天天气真好呀"，元数据标签不被朗读
                 *
                 * 注意: 如果 ZEGO 未正确解析 [[...]]，FilterText 中的 [[/]] 规则作为兜底静默移除
                 */
                AdvancedConfig: {
                    LLMMetaInfo: {
                        Enabled: true,
                        StartMark: "[[",
                        EndMark: "]]"
                    },
                    TTSParamPaths: [
                        {
                            ParamPath: "req_params.context_texts",
                            Source: "context_texts"
                        }
                    ]
                },
                FilterText: [
                    { BeginCharacters: "(", EndCharacters: ")" },
                    { BeginCharacters: "（", EndCharacters: "）" },
                    { BeginCharacters: "{", EndCharacters: "}" },
                    // 安全兜底：如果 AdvancedConfig 未生效，防止 [[...]] 元数据被当作正文朗读
                    { BeginCharacters: "[[", EndCharacters: "]]" }
                ]
            };
        } else {
            ttsConfig = {
                Vendor: "ByteDance",
                Params: {
                    "app": {
                        "appid": process.env.TTS_BYTEDANCE_APP_ID || "",
                        "token": process.env.TTS_BYTEDANCE_TOKEN || "",
                        "cluster": process.env.TTS_BYTEDANCE_CLUSTER || ""
                    },
                    "speed_ratio": 1,
                    "volume_ratio": 1,
                    "pitch_ratio": 1,
                    "emotion": "happy",
                    "audio": {
                        "rate": 24000,
                        "voice_type": process.env.TTS_BYTEDANCE_VOICE_TYPE || "zh_female_linjianvhai_moon_bigtts"
                    }
                },
                FilterText: [
                    { BeginCharacters: "(", EndCharacters: ")" },
                    { BeginCharacters: "（", EndCharacters: "）" },
                    { BeginCharacters: "{", EndCharacters: "}" }
                ]
            };
        }

        return {
            LLM: {
                Url: process.env.LLM_BASE_URL || "",
                ApiKey: process.env.LLM_API_KEY || "",
                Model: process.env.LLM_MODEL || "",
                SystemPrompt: SYSTEM_PROMPT
            },
            TTS: ttsConfig,
            ASR: {
                Params: {}
            }
        }
    }

    async registerAgent(agentId: string, agentName: string, llmConfig: LLMConfig | null = null, ttsConfig: TTSConfig | null = null, asrConfig: ASRConfig | null = null) {
        if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !process.env.LLM_MODEL) {
            throw new Error('LLM_BASE_URL, LLM_API_KEY and LLM_MODEL environment variables must be set');
        }
        const { LLM, TTS, ASR } = await this.getDefaultAgentConfig();
        // https://aigc-aiagent-api.zegotech.cn?Action=RegisterAgent
        const action = 'RegisterAgent';
        const body = {
            AgentId: agentId,
            Name: agentName,
            LLM: llmConfig || LLM,
            TTS: ttsConfig || TTS,
            ASR: asrConfig || ASR
        };
        return this.sendRequest<any>(action, body);
    }

    compareAgentConfig(config: any) {
        const { LLM, TTS, ASR } = this.getDefaultAgentConfig();
        const defaultConfig = {
            LLM,
            TTS,
            ASR
        }
        const agentConfig = {
            LLM: config.LLM,
            TTS: config.TTS,
            ASR: config.ASR
        }
        return isEqual(agentConfig, defaultConfig);
    }

    async updateAgent(agentId: string, agentName: string, llmConfig: LLMConfig | null = null, ttsConfig: TTSConfig | null = null, asrConfig: ASRConfig | null = null) {
        if (!process.env.LLM_BASE_URL || !process.env.LLM_API_KEY || !process.env.LLM_MODEL) {
            throw new Error('LLM_BASE_URL, LLM_API_KEY and LLM_MODEL environment variables must be set');
        }
        const { LLM, TTS, ASR } = await this.getDefaultAgentConfig();
        // https://aigc-aiagent-api.zegotech.cn?Action=UpdateAgent
        const action = 'UpdateAgent';
        const body = {
            AgentId: agentId,
            Name: agentName,
            LLM: llmConfig || LLM,
            TTS: ttsConfig || TTS,
            ASR: asrConfig || ASR
        };
        console.log('updateAgent body', body)
        return this.sendRequest<any>(action, body);
    }

    // 智能体注册逻辑
    async ensureAgentRegistered(agentId: string, agentName: string): Promise<void> {
      try {
        const agents = await this.queryAgents([agentId]);
        const agentExists = agents?.length > 0 &&
          agents.find((agent: any) => agent.AgentId === agentId);

        if (!agentExists) {
          await this.registerAgent(agentId, agentName);
          console.log(`智能体注册成功: ${agentId}`);
        } else {
          console.log(`智能体已存在: ${agentId}`);
          const isConfigEqual = this.compareAgentConfig(agentExists)
          console.log('isConfigEqual', isConfigEqual)
          if (!isConfigEqual) {
            await this.updateAgent(agentId, agentName);
          }
        }
      } catch (error) {
        console.error(`智能体注册失败: ${agentId}`, error);
        throw new Error(`智能体注册失败: ${(error as any).message}`);
      }
    }

    async createAgentInstance(agentId: string, userId: string, rtcInfo: RtcInfo, llmConfig: LLMConfig | null = null, ttsConfig: TTSConfig | null = null, asrConfig: ASRConfig | null = null, messageHistory: MessageHistory | null = null, callbackConfig: CallbackConfig | null = null) {
        // https://aigc-aiagent-api.zegotech.cn?Action=CreateAgentInstance
        const action = 'CreateAgentInstance';
        const body = {
            AgentId: agentId,
            UserId: userId,
            RTC: rtcInfo,
            MessageHistory: messageHistory || {
                SyncMode: 1, // Change to 0 to use history messages from ZIM
                Messages: [],
                WindowSize: 10
            },
            LLM: llmConfig,
            TTS: ttsConfig,
            ASR: asrConfig,
            CallbackConfig: callbackConfig
        };
        const result = await this.sendRequest<any>(action, body);
        console.log("create agent instance result", result);
        return result;
    }

    async createDigitalHumanAgentInstance(agentId: string, userId: string, rtcInfo: RtcInfo, digitalHumanInfo: DigitalHumanInfo, llmConfig: LLMConfig | null = null, ttsConfig: TTSConfig | null = null, asrConfig: ASRConfig | null = null, messageHistory: MessageHistory | null = null, callbackConfig: CallbackConfig | null = null) {
        // https://aigc-aiagent-api.zegotech.cn?Action=CreateDigitalHumanAgentInstance
        const action = 'CreateDigitalHumanAgentInstance';
        const body = {
            AgentId: agentId,
            UserId: userId,
            RTC: rtcInfo,
            DigitalHuman: digitalHumanInfo,
            MessageHistory: messageHistory || {
                SyncMode: 1, // Change to 0 to use history messages from ZIM
                Messages: [],
                WindowSize: 10
            },
            LLM: llmConfig,
            TTS: ttsConfig,
            ASR: asrConfig,
            CallbackConfig: callbackConfig
        };
        const result = await this.sendRequest<any>(action, body);
        console.log("create digital human agent instance result", result);
        return result;
    }

    async deleteAgentInstance(agentInstanceId: string) {
        // https://aigc-aiagent-api.zegotech.cn?Action=DeleteAgentInstance
        const action = 'DeleteAgentInstance';
        const body = {
            AgentInstanceId: agentInstanceId
        };
        const result = await this.sendRequest<any>(action, body);
        console.log("delete agent instance result", result);
        return result;
    }

    async listAgents(limit?: number, cursor?: string) {
        // https://aigc-aiagent-api.zegotech.cn?Action=ListAgents
        const action = 'ListAgents';
        const body: any = {};

        if (limit !== undefined) body.Limit = limit;
        if (cursor) body.Cursor = cursor;

        const result = await this.sendRequest<any>(action, body);
        console.log("list agents result", result);
        return result;
    }

    async sendAgentInstanceTTS(
        agentInstanceId: string,
        text: string,
        priority: 'Low' | 'Medium' | 'High' = 'High',
        samePriorityOption: 'ClearAndInterrupt' | 'Enqueue' = 'ClearAndInterrupt'
    ) {
        // https://aigc-aiagent-api.zegotech.cn?Action=SendAgentInstanceTTS
        const action = 'SendAgentInstanceTTS';
        const body = {
            AgentInstanceId: agentInstanceId,
            Text: text,
            Priority: priority,
            SamePriorityOption: samePriorityOption
        };
        const result = await this.sendRequest<any>(action, body);
        console.log("sendAgentInstanceTTS result", result);
        return result;
    }

    async sendAgentInstanceLLM(
        agentInstanceId: string,
        text: string,
        priority: 'Low' | 'Medium' | 'High' = 'Medium',
        samePriorityOption: 'ClearAndInterrupt' | 'Enqueue' = 'ClearAndInterrupt'
    ) {
        // https://aigc-aiagent-api.zegotech.cn?Action=SendAgentInstanceLLM
        const action = 'SendAgentInstanceLLM';
        const body = {
            AgentInstanceId: agentInstanceId,
            Text: text,
            Priority: priority,
            SamePriorityOption: samePriorityOption
        };
        const result = await this.sendRequest<any>(action, body);
        console.log("sendAgentInstanceLLM result", result);
        return result;
    }

    async getDigitalHumanList() {
        // https://aigc-digitalhuman-api.zegotech.cn?Action=GetDigitalHumanList
        const action = 'GetDigitalHumanList';
        try {
            const result = await this.sendRequest<any>(
                action,
                {},
                'https://aigc-digitalhuman-api.zegotech.cn'
            );
            console.log("getDigitalHumanList result", result);
            return result;
        } catch (error) {
            console.warn("调用 ZEGO 数字人列表接口异常，使用默认形象列表:", error);
            return {
                Code: 0,
                Data: {
                    List: [
                        { DigitalHumanId: '20be9bfb-ef6b-4d63-8c3b-1f20077599c5', Name: '默认数字人形象（经典女性）' }
                    ]
                }
            };
        }
    }
}
