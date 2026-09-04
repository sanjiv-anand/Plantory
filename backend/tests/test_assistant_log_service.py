from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.assistant_log_service import looks_like_log_statement, parse_log_action


def test_looks_like_log_statement():
    assert looks_like_log_statement("Yesterday I noticed it grew 2 cm")
    assert not looks_like_log_statement("When did it grow 2 cm?")


def test_parse_yesterday_growth():
    action = parse_log_action("Yesterday I noticed it grew 2 cm", today=date(2026, 9, 10))
    assert action is not None
    assert action.target_date == date(2026, 9, 9)
    assert action.height_delta_cm == Decimal("2")
    assert action.confidence >= 0.35


def test_parse_typo_mccms():
    action = parse_log_action("today it grew 2 mccms", today=date(2026, 9, 10))
    assert action is not None
    assert action.height_delta_cm == Decimal("2")


def test_parse_absolute_height():
    action = parse_log_action("Log that height is 14 cm today", today=date(2026, 9, 10))
    assert action is not None
    assert action.height_cm == Decimal("14")


def test_parse_watering():
    action = parse_log_action("I watered her yesterday", today=date(2026, 9, 10))
    assert action is not None
    assert action.watering_done is True
    assert action.target_date == date(2026, 9, 9)


def test_parse_leaf_count():
    action = parse_log_action("Yesterday she had 4 leaves", today=date(2026, 9, 10))
    assert action is not None
    assert action.leaf_count == 4
