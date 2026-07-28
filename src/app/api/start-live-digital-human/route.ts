import { NextRequest, NextResponse } from "next/server";
import { CONSTANTS, ZegoAIAgent } from "@/lib/zego/aiagent";
import { AgentStore } from "@/lib/store";

interface StartLiveDigitalHumanRequest {
  digital_human_id?: string;
  config_id?: string;
  room_id?: string;
  voice_type?: string;
  agent_id?: string;
  cdn_url?: string;
}

function generateRandomId(prefix: string): string {
  return prefix + Math.random().toString(36).substring(2, 10);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: StartLiveDigitalHumanRequest = await req.json();
    const { digital_human_id, config_id, room_id, voice_type } = body;

    const assistant = ZegoAIAgent.getInstance();
    const store = AgentStore.getInstance();

    await assistant.ensureAgentRegistered(CONSTANTS.AGENT_ID, CONSTANTS.AGENT_NAME);

    const roomId = room_id || generateRandomId("room_");
    const userId = generateRandomId("user_live_");
    const agentStreamId = generateRandomId("stream_agent_");
    const agentUserId = generateRandomId("user_agent_");
    const userStreamId = generateRandomId("stream_user_");

    const roomConfig = {
      RoomId: roomId,
      AgentStreamId: agentStreamId,
      AgentUserId: agentUserId,
      UserStreamId: userStreamId,
    };

    const digitalHumanConfig = {
      DigitalHumanId: digital_human_id || "20be9bfb-ef6b-4d63-8c3b-1f20077599c5",
      ConfigId: config_id || "9231f855-5c12-4217-bcbf-ec7bd56dbdfa",
    };

    const { LLM, TTS } = assistant.getDefaultAgentConfig();

    if (voice_type && typeof voice_type === 'string' && voice_type.trim()) {
      const selectedVoice = voice_type.trim();
      if (TTS.Vendor === 'ByteDanceV3') {
        TTS.Params.req_params.speaker = selectedVoice;
      } else {
        if (!TTS.Params.audio) {
          TTS.Params.audio = {};
        }
        TTS.Params.audio.voice_type = selectedVoice;
      }
    }

    const result = await assistant.createDigitalHumanAgentInstance(
      CONSTANTS.AGENT_ID,
      userId,
      roomConfig,
      digitalHumanConfig,
      LLM,
      TTS
    );

    if (result.Code !== 0) {
      return NextResponse.json({ code: result.Code, message: result.Message }, { status: 200 });
    }

    const agentInstanceId = result.Data.AgentInstanceId;
    store.setAgentInstanceId(agentInstanceId);

    return NextResponse.json(
      {
        code: 0,
        message: "播报数字人启动成功",
        agent_instance_id: agentInstanceId,
        agent_stream_id: agentStreamId,
        agent_user_id: agentUserId,
        request_id: result.Data.RequestId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("启动播报数字人失败:", error);
    return NextResponse.json(
      { code: 500, message: error.message || "启动播报数字人失败" },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}
