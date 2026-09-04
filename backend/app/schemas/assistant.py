from pydantic import BaseModel, Field


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list)
    stream: bool = False
    journal_entry_id: int | None = None
    current_page: str | None = Field(default=None, max_length=120)


class AssistantChatResponse(BaseModel):
    conversation_id: str | None = None
    message: str | None = None
    context_used: list[str] | None = None
    actions_applied: list[dict] | None = None
    error: str | None = None
    detail: str | None = None


class AssistantLogActionResult(BaseModel):
    entry_id: int
    date: str
    field: str
    value: str
    created: bool = False
    summary: str


class AssistantSummaryRequest(BaseModel):
    date: str | None = None


class AssistantSummaryResponse(BaseModel):
    date: str | None = None
    summary: str | None = None
    message: str | None = None
    error: str | None = None
    detail: str | None = None


class AssistantStoryResponse(BaseModel):
    story: str | None = None
    cached: bool | None = None
    generated_at: str | None = None
    message: str | None = None
    error: str | None = None
    detail: str | None = None


class AssistantContextResponse(BaseModel):
    sections: list[str]
    plant_name: str | None = None
    memory_count: int = 0
    journal_count: int = 0
    event_count: int = 0
    contradictions: list[str] = Field(default_factory=list)
    preview: str = ""


class AIStatusResponse(BaseModel):
    online: bool
    assistant_enabled: bool
    daily_summary_enabled: bool
    story_enabled: bool
    model: str
    runtime: str
    privacy: str
    max_tokens: int
    temperature: float


class AISettingsUpdate(BaseModel):
    assistant_enabled: bool | None = None
    daily_summary_enabled: bool | None = None
    story_enabled: bool | None = None
    max_tokens: int | None = Field(default=None, ge=64, le=1024)
    temperature: float | None = Field(default=None, ge=0.0, le=1.5)


class AITestResponse(BaseModel):
    ok: bool | None = None
    message: str | None = None
    error: str | None = None
    detail: str | None = None


class MemoryRead(BaseModel):
    id: int
    plant_id: int | None
    plant_name: str | None = None
    memory_type: str
    content: str
    source_type: str
    source_id: int | None
    importance: int
    confidence: str
    auto_generated: bool
    created_at: str
    updated_at: str


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    memory_type: str = "IMPORTANT_MEMORY"
    plant_id: int | None = None
    importance: int = Field(default=5, ge=1, le=10)


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    importance: int | None = Field(default=None, ge=1, le=10)


class MemoryRebuildResponse(BaseModel):
    cleared: int
    created: int


class MemoryForgetResponse(BaseModel):
    deleted: int
