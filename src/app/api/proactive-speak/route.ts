import { NextRequest, NextResponse } from 'next/server';
import { ZegoAIAgent } from '@/lib/zego/aiagent';
import { AgentStore } from '@/lib/store';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { type, text, agent_instance_id } = body;

    const store = AgentStore.getInstance();
    const instanceId = agent_instance_id || store.getAgentInstanceId();

    if (!instanceId) {
      return NextResponse.json(
        { code: 400, message: '未找到活跃的智能体实例 ID (agent_instance_id)' },
        { status: 400 }
      );
    }

    const assistant = ZegoAIAgent.getInstance();

    if (type === 'welcome') {
      const welcomeText =
        text ||
        process.env.WELCOME_TEXT ||
        '您好！我是嘉信讯通数字人助手，请问有什么可以帮您？';
      const result = await assistant.sendAgentInstanceTTS(
        instanceId,
        welcomeText,
        'High',
        'ClearAndInterrupt'
      );
      return NextResponse.json({ code: 0, message: '欢迎语发送成功', data: result }, { status: 200 });
    }

    if (type === 'idle_timeout') {
      const idlePrompt =
        text ||
        process.env.IDLE_PROMPT ||
        '用户已经 3 分钟没有说话了，请主动说一句简短自然的问候问问用户是否有疑问。';
      const result = await assistant.sendAgentInstanceLLM(
        instanceId,
        idlePrompt,
        'Medium',
        'ClearAndInterrupt'
      );
      return NextResponse.json({ code: 0, message: '静默关怀提醒发送成功', data: result }, { status: 200 });
    }

    if (type === 'custom' && text) {
      const result = await assistant.sendAgentInstanceTTS(
        instanceId,
        text,
        'High',
        'ClearAndInterrupt'
      );
      return NextResponse.json({ code: 0, message: '自定义播报发送成功', data: result }, { status: 200 });
    }

    return NextResponse.json({ code: 400, message: '无效的 type 参数' }, { status: 400 });
  } catch (error: any) {
    console.error('[proactive-speak] 接口处理失败:', error);
    return NextResponse.json(
      { code: 500, message: error.message || '主动触发说话失败' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
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
