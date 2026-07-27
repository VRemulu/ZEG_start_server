import { NextResponse } from 'next/server';
import { ZegoAIAgent } from '@/lib/zego/aiagent';

async function handleGetDigitalHumanList() {
  try {
    const assistant = ZegoAIAgent.getInstance();
    const result = await assistant.getDigitalHumanList();

    const list = result?.Data?.List || result?.Data?.digital_human_list || [
      { id: '20be9bfb-ef6b-4d63-8c3b-1f20077599c5', name: '默认数字人形象（经典女性）' }
    ];

    const formattedList = list.map((item: any) => ({
      id: item.DigitalHumanId || item.id || item.digital_human_id,
      name: item.Name || item.name || `数字人形象 (${(item.DigitalHumanId || '').substring(0, 8)})`,
    }));

    return NextResponse.json({ code: 0, message: '获取成功', data: formattedList }, { status: 200 });
  } catch (error: any) {
    console.error('[digital-human-list] 获取列表失败:', error);
    return NextResponse.json(
      {
        code: 0,
        message: '已使用默认列表',
        data: [
          { id: '20be9bfb-ef6b-4d63-8c3b-1f20077599c5', name: '默认数字人形象（经典女性）' }
        ],
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return handleGetDigitalHumanList();
}

export async function POST() {
  return handleGetDigitalHumanList();
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
