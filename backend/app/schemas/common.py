"""Common reusable Pydantic schemas for pagination, filters, and standard API structures."""

from datetime import date, datetime
from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Query parameters for paginated endpoints."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1, description="1-indexed page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page (max 100)")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic envelope for paginated collection responses."""

    items: List[T] = Field(description="List of records for the current page")
    total: int = Field(ge=0, description="Total count of matching records across all pages")
    page: int = Field(ge=1, description="Current page number")
    page_size: int = Field(ge=1, description="Number of items requested per page")
    pages: int = Field(ge=0, description="Total number of pages available")

    @classmethod
    def create(cls, items: List[T], total: int, params: PaginationParams) -> "PaginatedResponse[T]":
        pages = (total + params.page_size - 1) // params.page_size if total > 0 else 0
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=pages,
        )


class DateRangeFilter(BaseModel):
    """Filter parameters for querying time-series data and historical events."""

    model_config = ConfigDict(extra="forbid")

    start_time: Optional[datetime] = Field(default=None, description="Start timestamp in UTC (inclusive)")
    end_time: Optional[datetime] = Field(default=None, description="End timestamp in UTC (inclusive)")
    start_date: Optional[date] = Field(default=None, description="Start date (inclusive)")
    end_date: Optional[date] = Field(default=None, description="End date (inclusive)")


class MessageResponse(BaseModel):
    """Standard simple acknowledgement response."""

    message: str = Field(description="Human-readable status or confirmation message")
    success: bool = Field(default=True, description="Whether the operation was successful")
