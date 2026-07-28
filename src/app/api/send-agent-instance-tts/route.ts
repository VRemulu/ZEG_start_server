import { NextRequest, NextResponse } from 'next/server';
import { ZegoAIAgent } from '@/lib/zego/aiagent';
import { AgentStore } from '@/lib/store';
import { parseEmotionMarkup } from '@/lib/tts/emotion-markup';

interface SendAgentInstanceTTSRequest {
  agent_instance_id?: string;
  text: string;
  priority?: 'Low' | 'Medium' | 'High';
  same_priority_option?: 'ClearAndInterrupt' | 'Enqueue';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: SendAgentInstanceTTSRequest = await req.json();
    const { agent_instance_id, text, priority = 'High', same_priority_option = 'ClearAndInterrupt' } = body;

    const store = AgentStore.getInstance();
    const instanceId = agent_instance_id || store.getAgentInstanceId();

    if (!instanceId) {
      return NextResponse.json(
        { code: 400, message: '未找到活跃的智能体实例 ID (agent_instance_id)' },
        { status: 400 }
      );
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { code: 400, message: '播报文本 text 不能为空' },
        { status: 400 }
      );
    }

    const assistant = ZegoAIAgent.getInstance();
    const vendor = process.env.TTS_VENDOR || 'ByteDance';
    const parsed = parseEmotionMarkup(text.trim());
    const textToSend = vendor === 'ByteDanceV3' ? parsed.zegoFormattedText : parsed.speechText;

    const result = await assistant.sendAgentInstanceTTS(
      instanceId,
      textToSend,
      priority,
      same_priority_option
    );

    return NextResponse.json(
      { code: 0, message: '自定义 TTS 播报成功', data: result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[send-agent-instance-tts] 接口处理失败:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '发送 TTS 播报失败' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
