"""Wire-level schemas for the project-search API.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SearchMode = Literal["keyword", "semantic"]


class SearchRequest(BaseModel):
    """Body of `POST /api/v1/projects/{id}/search`."""

    query: str = Field(..., min_length=1, max_length=1024)
    mode: SearchMode = "semantic"
   
    limit: int = Field(default=10, ge=1, le=50)
    min_score: float = Field(default=0.35, ge=0.0, le=1.0)


class SearchHit(BaseModel):
    """One result row, regardless of mode.
    """

    path: str
    snippet: str
    score: float
    start_line: int = -1
    end_line: int = -1


class SearchResponse(BaseModel):
    items: list[SearchHit]
    mode: SearchMode

    query: str
