# --- START OF FILE app/main.py ---

import os
import json
import shutil
import asyncio
from typing import TypedDict, List, Literal, Optional, Dict, Any
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END

# --- Import our project's modules ---
# <<< MODIFIED: Import queues from the new state module >>>
from app.state import frontend_input_queue, backend_output_queue
from app.rag.pipeline import get_rag_answer
from app.data.usage import load_from_source
from app.data.chunker import chunk_documents
from app.data.embedder import embed_and_store_chunks
from app.db.logger import log_query
from app.autogen_runner3 import (
    run_conversation_from_config,
    SuperAgentConfigRequest,
    AgentSpec,
    Task
)

# --- Load Environment & Initialize LLM for the router ---
load_dotenv()
llm = ChatOpenAI(model="gpt-4o-2024-05-13", temperature=0, api_key=os.getenv("OPENAI_API_KEY"))

# ===================================================================
# 1. Admin-Managed Configurations & App Setup
# ===================================================================
SUPERVISOR_PROFILE_FILE = "supervisor_profile.json"
ASSISTANTS_CONFIG_FILE = "assistant_config.json"
SUPERVISOR_PROFILE: Dict = {}
ASSISTANT_CONFIGS: List[Dict] = []

def load_supervisor_profile():
    global SUPERVISOR_PROFILE
    try:
        with open(SUPERVISOR_PROFILE_FILE, "r") as f: SUPERVISOR_PROFILE = json.load(f)
        print(f"--- Loaded supervisor profile from {SUPERVISOR_PROFILE_FILE} ---")
    except Exception as e:
        print(f"--- WARNING: Could not load {SUPERVISOR_PROFILE_FILE}. Using default. Error: {e} ---")
        SUPERVISOR_PROFILE = {"supervisor_system_message": "You are a helpful assistant."}

def load_assistants_config():
    global ASSISTANT_CONFIGS
    try:
        with open(ASSISTANTS_CONFIG_FILE, "r") as f:
            ASSISTANT_CONFIGS = json.load(f).get("assistants", [])
        print(f"--- Loaded {len(ASSISTANT_CONFIGS)} assistants from {ASSISTANTS_CONFIG_FILE} ---")
    except Exception as e:
        print(f"--- WARNING: Could not load {ASSISTANTS_CONFIG_FILE}. No conversational agents available. Error: {e} ---")
        ASSISTANT_CONFIGS = []

app = FastAPI(title="Conversational RAG Orchestrator", description="API for RAG and multi-agent conversational workflows.")

@app.on_event("startup")
async def startup_event():
    load_supervisor_profile(); load_assistants_config()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ===================================================================
# 2. Pydantic Models & State Definitions
# ===================================================================
class UserQueryRequest(BaseModel):
    query: str
    lang: Optional[str] = "en"
# --- START OF FILE app/main.py (continued) ---

class SupervisorProfileRequest(BaseModel): name: str; model: str; persona: str; supervisor_system_message: str
class AssistantsConfigRequest(BaseModel): assistants: List[AgentSpec]

class GraphState(TypedDict):
    question: str; lang: str; rag_answer: Dict
    supervisor_profile: Dict; assistant_configs: List[Dict]
    agent_decision: str; final_response: Dict

# ===================================================================
# 3. LangGraph Orchestration Logic (Simplified)
# ===================================================================
def structured_rag_node(state: GraphState) -> dict:
    print("--- [LangGraph] Node: Structured RAG ---")
    return {"rag_answer": get_rag_answer(state["question"], state["lang"])}

def route_query_node(state: GraphState) -> dict:
    print("--- [LangGraph] Node: Route Query ---")
    if not state.get("assistant_configs"): return {"agent_decision": "RAG_Is_Sufficient"}
    supervisor_prompt = state["supervisor_profile"].get("supervisor_system_message", "You are a helpful router.")
    class RouterTool(BaseModel):
        decision: Literal["Invoke_AutoGen_Conversation", "RAG_Is_Sufficient"] = Field(description="Choose 'Invoke_AutoGen_Conversation' for complex tasks. Choose 'RAG_Is_Sufficient' for simple questions.")
    structured_llm = llm.with_structured_output(RouterTool, method="function_calling")
    prompt = f"""You are a master routing AI. Your task is to analyze a user's query and decide if it requires a complex, multi-agent conversation or if it can be handled with a direct informational answer.

**CRITICAL RULE:** You must default to "RAG_Is_Sufficient". Only escalate to "Invoke_AutoGen_Conversation" if the user's request is **both multi-step AND vague**, requiring a back-and-forth conversation to clarify details.

Analyze the user's query based on the following examples:

**Examples that are "RAG_Is_Sufficient" (simple, direct questions):**
- "How do I book a demo?"
- "What are the steps to book a service?"
- "Can you show me the prices for the courses?"
- "What is ISPG?"

**Examples that REQUIRE "Invoke_AutoGen_Conversation" (vague, multi-step commands):**
- "Book a demo."
- "Help me book a service for my car."
- "I need to get my car serviced this week."
- "Organize my schedule for Friday."

**USER QUERY:**
"{state['question']}"

Choose "Invoke_AutoGen_Conversation" ONLY for the vague, multi-step commands. For everything else, choose "RAG_Is_Sufficient".
"""
    result = structured_llm.invoke(prompt)
    print(f"--- [LangGraph] Routing Decision: {result.decision} ---")
    return {"agent_decision": result.decision}

# <<< MODIFIED: No longer runs autogen directly, just formats the output >>>
def format_output_node(state: GraphState) -> dict:
    print("--- [LangGraph] Node: Format Final Output ---")
    if state["agent_decision"] == "Invoke_AutoGen_Conversation":
        # Only send a signal, no placeholder text
        final_payload = {"type": "interactive_session_start"}
    else:
        # Return the RAG answer directly
        final_payload = state["rag_answer"]
    return {"final_response": final_payload}


workflow = StateGraph(GraphState)
workflow.add_node("structured_rag", structured_rag_node)
workflow.add_node("route_query", route_query_node)
workflow.add_node("format_output", format_output_node)
workflow.set_entry_point("structured_rag")
workflow.add_edge("structured_rag", "route_query")

def should_format_or_end(state: GraphState): return "format_output"
workflow.add_conditional_edges("route_query", should_format_or_end, {"format_output": "format_output"})
workflow.add_edge("format_output", END)
app_graph = workflow.compile()

# ===================================================================
# 4. API & WebSocket Endpoints
# ===================================================================
api_router = APIRouter()

# <<< This is the background task that runs the agent conversation >>>
def run_agent_session(config: SuperAgentConfigRequest):
    print("--- [Background Task] Kicking off AutoGen session. ---")
    run_conversation_from_config(config)
    print("--- [Background Task] AutoGen session has finished. ---")

def run_agent_session(config: SuperAgentConfigRequest, loop: asyncio.AbstractEventLoop):
    print("--- [Background Task] Kicking off AutoGen session. ---")
    # Pass the loop down to the runner
    run_conversation_from_config(config, loop)
    print("--- [Background Task] AutoGen session has finished. ---")


@api_router.post("/ask")
async def smart_ask(payload: UserQueryRequest, background_tasks: BackgroundTasks) -> Dict:
    try:
        inputs = {
            "question": payload.query,
            "lang": payload.lang,
            "supervisor_profile": SUPERVISOR_PROFILE,
            "assistant_configs": ASSISTANT_CONFIGS
        }
        final_state = app_graph.invoke(inputs)
        response = final_state.get("final_response", {})

        if response.get("type") == "interactive_session_start":
            print("--- [API /ask] Agentic flow needed. Starting background task. ---")
            agent_config = SuperAgentConfigRequest(
                prompt=payload.query,
                supervisor_system_message=SUPERVISOR_PROFILE.get("supervisor_system_message"),
                assistants=[AgentSpec(**spec) for spec in ASSISTANT_CONFIGS],
                max_turns=25
            )
            
            # <<< MODIFIED: Get the main event loop and pass it to the background task >>>
            main_loop = asyncio.get_running_loop()
            background_tasks.add_task(run_agent_session, agent_config, main_loop)

        log_query(payload.query, response.get("text", str(response)), payload.lang)
        return response

    except Exception as e:
        print(f"ERROR in smart_ask: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# <<< NEW WebSocket Endpoint for real-time agent chat >>>
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("--- [WebSocket] Connection accepted. ---")
    
    # Task to listen for messages FROM the frontend and put them in the input queue
    async def listen_to_client():
        try:
            while True:
                data = await websocket.receive_text()
                print(f"--- [WebSocket] Received from client: {data} ---")
                await frontend_input_queue.put(data)
        except WebSocketDisconnect:
            print("--- [WebSocket] Client disconnected. ---")
            # Signal the agent runner that the user has left
            await frontend_input_queue.put("User has disconnected.")

    # Task to listen for messages FROM the backend agent and send them to the frontend
    async def send_to_client():
        try:
            while True:
                message = await backend_output_queue.get()
                if message == "END_OF_CONVERSATION":
                    print("--- [WebSocket] End of conversation signal received. Closing connection. ---")
                    await websocket.close()
                    break
                print(f"--- [WebSocket] Sending to client: {message} ---")
                await websocket.send_text(message)
                backend_output_queue.task_done()
        except asyncio.CancelledError:
            print("--- [WebSocket] Send task cancelled. ---")

    listen_task = asyncio.create_task(listen_to_client())
    send_task = asyncio.create_task(send_to_client())

    # Wait for one of the tasks to finish (e.g., disconnection or end of conversation)
    done, pending = await asyncio.wait(
        [listen_task, send_task],
        return_when=asyncio.FIRST_COMPLETED,
    )

    # Clean up the other task
    for task in pending:
        task.cancel()


# --- Admin & Upload Endpoints (Unchanged) ---
@api_router.get("/get-supervisor-profile", response_model=Dict)
async def get_supervisor_profile(): return SUPERVISOR_PROFILE

@api_router.post("/save-supervisor-profile")
async def save_supervisor_profile(profile: SupervisorProfileRequest):
    with open(SUPERVISOR_PROFILE_FILE, "w") as f: json.dump(profile.dict(), f, indent=2)
    load_supervisor_profile(); return {"message": "Supervisor profile saved and reloaded."}

@api_router.get("/get-assistants-config", response_model=List[AgentSpec])
async def get_assistants_config(): return ASSISTANT_CONFIGS

@api_router.post("/save-assistants-config")
async def save_assistants_config(config: AssistantsConfigRequest):
    full_config = {"assistants": [assistant.dict() for assistant in config.assistants]}
    with open(ASSISTANTS_CONFIG_FILE, "w") as f: json.dump(full_config, f, indent=2)
    load_assistants_config(); return {"message": "Assistants configuration saved and reloaded."}

KNOWLEDGE_BASE_DIR = "Knowledge_Base"
os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename: raise HTTPException(status_code=400, detail="No file name provided.")
    file_path = os.path.join(KNOWLEDGE_BASE_DIR, file.filename)
    try:
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        docs = load_from_source(file_path)
        if not docs: raise HTTPException(status_code=400, detail=f"Could not process file: {file.filename}.")
        chunks = chunk_documents(docs); embed_and_store_chunks(chunks)
        return {"message": f"Successfully ingested '{file.filename}'. {len(chunks)} chunks added."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {e}")
    finally:
        file.file.close()

# ===================================================================
# 5. Final App Setup
# ===================================================================
app.include_router(api_router, prefix="/api")
@app.get("/")
async def root(): return {"message": "Full-Stack RAG and Agent Orchestrator is running!"}