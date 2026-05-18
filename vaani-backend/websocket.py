import json
import base64
from datetime import datetime
from pydantic import BaseModel
from services.tts import stream_tts
from services.rag import get_context
from services.stt import speech_to_text
from services.llm import generate_response
from fastapi.responses import JSONResponse
from services.memory import ConversationMemory
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

class ChatMessage(BaseModel):
    message: str

router = APIRouter()

# In-memory call log storage
call_logs = []

GREETING_TEXT = "Hello there! How can I help you?"

@router.websocket("/ws/voice")
async def voice_chat(websocket: WebSocket):
    await websocket.accept()
    
    # Initialize conversation memory for this session
    memory = ConversationMemory()

    # Send AI greeting immediately when call starts
    try:
        await websocket.send_text(json.dumps({
            "type": "transcript",
            "role": "ai",
            "text": GREETING_TEXT,
            "timestamp": datetime.now().isoformat()
        }))

        # Stream greeting TTS audio
        for chunk in stream_tts(GREETING_TEXT):
            await websocket.send_bytes(chunk)

        await websocket.send_text(json.dumps({
            "type": "audio_complete"
        }))
    except Exception as e:
        print(f"Greeting error: {e}")

    while True:
        try:
            print("Waiting for audio...")
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                print("Client disconnected")
                break

            audio_bytes = message.get("bytes")
            if not audio_bytes:
                if message.get("text"):
                    print(f"Ignoring unexpected text frame: {message['text'][:80]}")
                continue

            print(f"Received audio: {len(audio_bytes)} bytes")

            if len(audio_bytes) == 0:
                print("Received empty audio bytes, skipping")
                continue

            # 1. STT
            user_text = speech_to_text(audio_bytes)
            print("User:", repr(user_text))

            # Skip empty or failed transcriptions
            if not user_text or user_text == "[Could not transcribe audio]":
                print("Skipping empty or failed transcription")
                continue

            # Send user's transcribed text as JSON
            await websocket.send_text(json.dumps({
                "type": "transcript",
                "role": "user",
                "text": user_text,
                "timestamp": datetime.now().isoformat()
            }))

            # 2. RAG
            context = get_context(user_text)

            # Get conversation memory context
            memory_context = memory.get_context_string()

            # 3. LLM - Pass both RAG context and conversation memory
            ai_response = generate_response(user_text, context, memory_context)
            print("AI:", ai_response)

            # Store in conversation memory
            memory.add_message("user", user_text)
            memory.add_message("ai", ai_response)

            # Send AI response text as JSON
            await websocket.send_text(json.dumps({
                "type": "transcript",
                "role": "ai",
                "text": ai_response,
                "timestamp": datetime.now().isoformat()
            }))

            # Store call log
            call_logs.append({
                "id": len(call_logs) + 1,
                "user_text": user_text,
                "ai_response": ai_response,
                "timestamp": datetime.now().isoformat()
            })

            # 4. TTS stream - send audio bytes
            for chunk in stream_tts(ai_response):
                await websocket.send_bytes(chunk)

            # Signal audio stream complete
            await websocket.send_text(json.dumps({
                "type": "audio_complete"
            }))

        except WebSocketDisconnect:
            print("Client disconnected")
            break
        except Exception as e:
            print(f"WebSocket error: {e}")
            import traceback
            traceback.print_exc()
            break

@router.get("/api/call-logs")
async def get_call_logs():
    return JSONResponse(content={"logs": list(reversed(call_logs))})

@router.post("/api/chat")
async def text_chat(chat_message: ChatMessage):
    """Handle text-based chat messages"""
    try:
        # Initialize memory
        memory = ConversationMemory()
        
        message = chat_message.message.strip()
        
        if not message:
            return JSONResponse(
                status_code=400,
                content={"error": "Message cannot be empty"}
            )

        print(f"Received text message: {message}")

        # 1. RAG - Get context
        try:
            context = get_context(message)
            print(f"Context retrieved: {len(context) if context else 0} characters")
        except Exception as rag_error:
            print(f"RAG Error: {rag_error}")
            context = ""

        # Get conversation memory context
        memory_context = memory.get_context_string()

        # 2. LLM - Generate response with memory
        try:
            ai_response = generate_response(message, context, memory_context)
            print(f"AI Response: {ai_response}")
        except Exception as llm_error:
            print(f"LLM Error: {llm_error}")
            import traceback
            traceback.print_exc()
            return JSONResponse(
                status_code=500,
                content={"error": f"Failed to generate response: {str(llm_error)}"}
            )

        # Store in conversation memory
        memory.add_message("user", message)
        memory.add_message("ai", ai_response)

        # 3. TTS - Generate audio
        audio_url = None
        try:
            audio_chunks = []
            for chunk in stream_tts(ai_response):
                if chunk:
                    audio_chunks.append(chunk)

            # If we have audio chunks, create a base64 string to return as URL
            if audio_chunks:
                audio_blob = b"".join(audio_chunks)
                audio_b64 = base64.b64encode(audio_blob).decode()
                audio_url = f"data:audio/wav;base64,{audio_b64}"
                print(f"Audio generated: {len(audio_blob)} bytes")
        except Exception as tts_error:
            print(f"TTS Error (non-fatal): {tts_error}")
            # Don't fail if TTS fails, still return the text response

        # Store in call logs
        try:
            call_logs.append({
                "id": len(call_logs) + 1,
                "user_text": message,
                "ai_response": ai_response,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as log_error:
            print(f"Log storage error (non-fatal): {log_error}")

        return JSONResponse(
            status_code=200,
            content={
                "ai_response": ai_response,
                "audio_url": audio_url,
                "timestamp": datetime.now().isoformat()
            }
        )

    except Exception as e:
        print(f"Error processing text chat: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )