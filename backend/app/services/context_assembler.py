from __future__ import annotations

from datetime import date
from typing import Any

from app.services.retrieval_service import RetrievalResult


class ContextAssembler:
    """Build structured prompt sections from retrieved context."""

    @staticmethod
    def assemble(
        *,
        plant: dict[str, Any],
        retrieval: RetrievalResult,
        question: str,
        current_date: date,
        current_page: str | None = None,
        current_journal_entry: dict[str, Any] | None = None,
        conversation_summary: str | None = None,
        recent_turns: list[dict[str, str]] | None = None,
        user_preferences: list[dict[str, Any]] | None = None,
    ) -> str:
        sections: list[str] = []

        sections.append(ContextAssembler._current_context(plant, current_date, current_page, current_journal_entry))
        sections.append(ContextAssembler._plant_facts(retrieval.plant_facts))
        sections.append(ContextAssembler._memories(retrieval.memories, user_preferences))
        sections.append(ContextAssembler._journal_entries(retrieval.journal_entries, current_journal_entry))
        sections.append(ContextAssembler._events(retrieval.events))
        sections.append(ContextAssembler._photos(retrieval.photos, current_journal_entry))
        sections.append(ContextAssembler._weather(retrieval.weather))
        sections.append(ContextAssembler._measurements(retrieval.measurements))
        if retrieval.contradictions:
            sections.append(ContextAssembler._contradictions(retrieval.contradictions))
        sections.append(ContextAssembler._user_voice(retrieval.journal_entries, retrieval.memories))
        sections.append(ContextAssembler._conversation(conversation_summary, recent_turns))
        sections.append(f"USER QUESTION:\n{question.strip()}")
        sections.append(
            "REPLY INSTRUCTIONS:\n"
            "Answer the user's question directly in a natural, personal voice. "
            "Do not restate the context sections back to them."
        )

        return "\n\n".join(section for section in sections if section)

    @staticmethod
    def context_keys(retrieval: RetrievalResult, *, has_conversation: bool) -> list[str]:
        keys = ["current_context", "plant_facts"]
        if retrieval.memories:
            keys.append("memories")
        if retrieval.journal_entries:
            keys.append("journal_entries")
        if retrieval.events:
            keys.append("events")
        if retrieval.photos:
            keys.append("photos")
        if retrieval.weather:
            keys.append("weather")
        if retrieval.measurements:
            keys.append("measurements")
        if retrieval.contradictions:
            keys.append("contradictions")
        if has_conversation:
            keys.append("conversation")
        return keys

    @staticmethod
    def _current_context(
        plant: dict[str, Any],
        current_date: date,
        current_page: str | None,
        current_journal_entry: dict[str, Any] | None,
    ) -> str:
        lines = [
            "CURRENT CONTEXT:",
            f"Plant: {plant.get('name', 'Unknown')}",
            f"Today: {current_date.isoformat()}",
        ]
        if plant.get("day_number"):
            lines.append(f"Plant age: {plant['day_number']} days")
        if plant.get("status"):
            lines.append(f"Status: {plant['status']}")
        if current_page:
            lines.append(f"Page: {current_page}")
        if current_journal_entry:
            lines.append(f"Viewing journal entry: {current_journal_entry.get('date')} — {current_journal_entry.get('title') or 'Untitled'}")
        return "\n".join(lines)

    @staticmethod
    def _plant_facts(facts: list[dict[str, Any]]) -> str:
        if not facts:
            return ""
        lines = ["PLANT FACTS:"]
        for fact in facts:
            lines.append(f"- {fact['fact']}")
        return "\n".join(lines)

    @staticmethod
    def _memories(memories: list[dict[str, Any]], preferences: list[dict[str, Any]] | None) -> str:
        lines: list[str] = []
        if memories:
            lines.append("RELEVANT MEMORIES:")
            for memory in memories:
                source = memory.get("source_type")
                source_id = memory.get("source_id")
                suffix = f" (source: {source} #{source_id})" if source_id else ""
                lines.append(f"- {memory['content']}{suffix}")
        if preferences:
            if not lines:
                lines.append("USER PREFERENCES:")
            else:
                lines.append("")
                lines.append("USER PREFERENCES:")
            for pref in preferences:
                lines.append(f"- {pref['content']}")
        return "\n".join(lines)

    @staticmethod
    def _journal_entries(entries: list[dict[str, Any]], current: dict[str, Any] | None) -> str:
        if not entries and not current:
            return ""
        lines = ["RELEVANT JOURNAL ENTRIES:"]
        shown: set[int | str] = set()
        if current:
            lines.extend(ContextAssembler._format_entry(current, prefix="[CURRENT] "))
            shown.add(current.get("id", current.get("date")))
        for entry in entries:
            key = entry.get("id", entry.get("date"))
            if key in shown:
                continue
            shown.add(key)
            lines.extend(ContextAssembler._format_entry(entry))
        return "\n".join(lines)

    @staticmethod
    def _format_entry(entry: dict[str, Any], *, prefix: str = "") -> list[str]:
        lines = [f"{prefix}{entry.get('date') or 'Unknown date'}:"]
        if entry.get("title"):
            lines.append(f"  Title: {entry['title']}")
        if entry.get("memory"):
            lines.append(f"  Memory: {entry['memory'][:500]}")
        if entry.get("observation"):
            lines.append(f"  Observation: {entry['observation'][:500]}")
        if entry.get("height_cm"):
            lines.append(f"  Height: {entry['height_cm']} cm")
        if entry.get("watering_done"):
            lines.append("  Watered: yes")
        if entry.get("fertilized"):
            lines.append("  Fertilized: yes")
        if entry.get("tags"):
            lines.append(f"  Tags: {', '.join(entry['tags'])}")
        return lines

    @staticmethod
    def _events(events: list[dict[str, Any]]) -> str:
        if not events:
            return ""
        lines = ["RELEVANT EVENTS:"]
        for event in events:
            label = event.get("title") or event.get("type")
            lines.append(f"- {event.get('date')}: {label}")
            if event.get("description"):
                lines.append(f"  {event['description'][:200]}")
        return "\n".join(lines)

    @staticmethod
    def _photos(photos: list[dict[str, Any]], current: dict[str, Any] | None) -> str:
        lines: list[str] = []
        if current and current.get("has_photo"):
            lines.append("PHOTO CONTEXT:")
            lines.append(f"- Photo attached to entry on {current.get('date')}. (Text-only model — do not describe visual details.)")
        if photos:
            if not lines:
                lines.append("PHOTO CONTEXT:")
            for photo in photos[:5]:
                title = photo.get("title") or photo.get("original_filename") or "Photo"
                lines.append(f"- {photo.get('date')}: {title} uploaded.")
        return "\n".join(lines)

    @staticmethod
    def _weather(weather: list[dict[str, Any]]) -> str:
        if not weather:
            return ""
        lines = ["WEATHER CONTEXT:"]
        for snap in weather[:4]:
            parts = [snap.get("date") or "Unknown date"]
            if snap.get("temperature_c"):
                parts.append(f"{snap['temperature_c']}°C")
            if snap.get("humidity_pct"):
                parts.append(f"humidity {snap['humidity_pct']}%")
            if snap.get("precipitation_mm"):
                parts.append(f"precip {snap['precipitation_mm']}mm")
            lines.append(f"- {' · '.join(str(p) for p in parts)}")
        return "\n".join(lines)

    @staticmethod
    def _measurements(measurements: list[dict[str, Any]]) -> str:
        if not measurements:
            return ""
        lines = ["MEASUREMENTS:"]
        for m in measurements[:6]:
            parts = [str(m.get("date"))]
            if m.get("height_cm"):
                parts.append(f"height {m['height_cm']} cm")
            if m.get("leaf_count") is not None:
                parts.append(f"leaves {m['leaf_count']}")
            if m.get("flower_count") is not None:
                parts.append(f"flowers {m['flower_count']}")
            lines.append(f"- {' · '.join(parts)}")
        return "\n".join(lines)

    @staticmethod
    def _contradictions(items: list[str]) -> str:
        lines = ["CONTRADICTIONS (mention these honestly; prefer plant metadata over inferred journal dates):"]
        for item in items:
            lines.append(f"- {item}")
        return "\n".join(lines)

    @staticmethod
    def _user_voice(
        journal_entries: list[dict[str, Any]],
        memories: list[dict[str, Any]],
    ) -> str:
        snippets: list[str] = []
        for entry in journal_entries[:4]:
            for field in ("memory", "observation"):
                text = entry.get(field)
                if text and len(text.strip()) > 12:
                    snippets.append(text.strip()[:160])
        for memory in memories[:2]:
            content = memory.get("content")
            if content and "User" in content:
                snippets.append(content[:160])
        if not snippets:
            return ""
        unique = list(dict.fromkeys(snippets))[:3]
        lines = ["HOW THIS USER WRITES (match their warmth; do not copy verbatim):"]
        for snippet in unique:
            lines.append(f'- "{snippet}"')
        return "\n".join(lines)

    @staticmethod
    def _conversation(summary: str | None, recent_turns: list[dict[str, str]] | None) -> str:
        lines: list[str] = []
        if summary:
            lines.append("CONVERSATION SUMMARY:")
            lines.append(summary)
        if recent_turns:
            lines.append("RECENT CONVERSATION:")
            for turn in recent_turns[-4:]:
                role = turn.get("role", "user").upper()
                content = turn.get("content", "")
                lines.append(f"{role}: {content[:300]}")
        return "\n".join(lines)
