"""
SolarMind Background Job Processing & Lifecycle Service.

Coordinates asynchronous image analysis, diagnosis evaluation, duplicate prevention,
retry management, consistent database persistence, and sanitized error reporting.
"""

from datetime import datetime, timezone
import logging
import re
import threading
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

from app.schemas.job import JobCreate, JobResponse, JobStatus

logger = logging.getLogger("solarmind.services.job_processing")


class JobProcessingService:
    """In-process background job processing engine with duplicate protection and retry policies."""

    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def submit_job(
        self,
        job_in: JobCreate,
        handler: Optional[Callable[..., Any]] = None,
        *args,
        **kwargs,
    ) -> JobResponse:
        """
        Submits a job for background processing.
        Prevents accidental duplicate job creation for identical active tasks.
        """
        with self._lock:
            # 1. Duplicate Prevention Check
            existing = self._find_active_job(job_in.job_type, job_in.resource_id)
            if existing:
                logger.info(
                    "Duplicate job prevented: Active job %s already exists for %s:%s",
                    existing["job_id"],
                    job_in.job_type,
                    job_in.resource_id,
                )
                return self._to_job_response(existing)

            # 2. Create Job Record
            job_id = f"JOB-{uuid4().hex[:10].upper()}"
            now_utc = datetime.now(timezone.utc)

            job_record: Dict[str, Any] = {
                "job_id": job_id,
                "job_type": job_in.job_type,
                "resource_id": job_in.resource_id,
                "plant_id": job_in.plant_id,
                "status": JobStatus.QUEUED,
                "created_at": now_utc,
                "started_at": None,
                "completed_at": None,
                "retry_count": 0,
                "max_retries": job_in.max_retries,
                "is_retryable": True,
                "error_message": None,
                "result_payload": None,
                "handler": handler,
                "args": args,
                "kwargs": kwargs,
            }

            self._jobs[job_id] = job_record
            logger.info("Queued job %s (%s on resource %s)", job_id, job_in.job_type, job_in.resource_id)

        # 3. Trigger execution if handler is provided
        if handler:
            self._execute_job_sync(job_id)

        with self._lock:
            return self._to_job_response(self._jobs[job_id])

    def get_job(self, job_id: str) -> Optional[JobResponse]:
        """Retrieves current job status and outputs."""
        with self._lock:
            record = self._jobs.get(job_id)
            if not record:
                return None
            return self._to_job_response(record)

    def list_jobs(
        self,
        resource_id: Optional[str] = None,
        job_type: Optional[str] = None,
        status: Optional[JobStatus] = None,
    ) -> List[JobResponse]:
        """Lists tracked jobs with optional filters."""
        with self._lock:
            results = []
            for record in self._jobs.values():
                if resource_id and record["resource_id"] != resource_id:
                    continue
                if job_type and record["job_type"] != job_type:
                    continue
                if status and record["status"] != status:
                    continue
                results.append(self._to_job_response(record))
            return sorted(results, key=lambda j: j.created_at, reverse=True)

    def retry_job(self, job_id: str) -> JobResponse:
        """
        Retries a failed job if retry limit has not been exceeded.
        """
        with self._lock:
            record = self._jobs.get(job_id)
            if not record:
                raise ValueError(f"Job '{job_id}' not found.")

            if record["status"] not in [JobStatus.FAILED, JobStatus.QUEUED]:
                raise ValueError(f"Cannot retry job '{job_id}' in state '{record['status']}'.")

            if record["retry_count"] >= record["max_retries"]:
                record["is_retryable"] = False
                raise ValueError(f"Job '{job_id}' exceeded max retry limit ({record['max_retries']}).")

            record["retry_count"] += 1
            record["status"] = JobStatus.QUEUED
            record["error_message"] = None
            record["completed_at"] = None
            logger.info("Retrying job %s (attempt %d/%d)", job_id, record["retry_count"], record["max_retries"])

        self._execute_job_sync(job_id)

        with self._lock:
            return self._to_job_response(self._jobs[job_id])

    def _execute_job_sync(self, job_id: str) -> None:
        """Executes job handler safely, recording state and sanitized errors."""
        with self._lock:
            record = self._jobs.get(job_id)
            if not record:
                return
            record["status"] = JobStatus.PROCESSING
            record["started_at"] = datetime.now(timezone.utc)
            handler = record.get("handler")
            args = record.get("args", ())
            kwargs = record.get("kwargs", {})

        if not handler:
            with self._lock:
                record["status"] = JobStatus.COMPLETED
                record["completed_at"] = datetime.now(timezone.utc)
            return

        try:
            result = handler(*args, **kwargs)

            with self._lock:
                record["result_payload"] = result if isinstance(result, dict) else (
                    result.model_dump(mode="json") if hasattr(result, "model_dump") else {"output": str(result)}
                )

                # If result indicates NOT_CONFIGURED
                if isinstance(result, dict) and result.get("status") == "NOT_CONFIGURED":
                    record["status"] = JobStatus.NOT_CONFIGURED
                elif hasattr(result, "status") and result.status == "NOT_CONFIGURED":
                    record["status"] = JobStatus.NOT_CONFIGURED
                else:
                    record["status"] = JobStatus.COMPLETED

                record["completed_at"] = datetime.now(timezone.utc)
                logger.info("Job %s completed with status %s", job_id, record["status"])
        except Exception as exc:
            sanitized_err = self._sanitize_error(str(exc))
            logger.error("Job %s failed: %s", job_id, sanitized_err, exc_info=False)

            with self._lock:
                record["status"] = JobStatus.FAILED
                record["error_message"] = sanitized_err
                record["completed_at"] = datetime.now(timezone.utc)
                if record["retry_count"] >= record["max_retries"]:
                    record["is_retryable"] = False

    def _find_active_job(self, job_type: str, resource_id: str) -> Optional[Dict[str, Any]]:
        """Finds any active (QUEUED or PROCESSING) job for the specified resource."""
        for record in self._jobs.values():
            if record["job_type"] == job_type and record["resource_id"] == resource_id:
                if record["status"] in [JobStatus.QUEUED, JobStatus.PROCESSING]:
                    return record
        return None

    @staticmethod
    def _sanitize_error(msg: str) -> str:
        """Strips passwords, tokens, connection strings, and secret patterns from logs/outputs."""
        sanitized = re.sub(r"://([^:]+):([^@]+)@", r"://***:***@", msg)
        sanitized = re.sub(r"(token|secret|password|key)\s*=\s*['\"][^'\"]+['\"]", r"\1='***'", sanitized, flags=re.I)
        sanitized = re.sub(r"C:\\Users\\[^\\]+\\", r"[PATH]/", sanitized)
        return sanitized[:500]

    @staticmethod
    def _to_job_response(record: Dict[str, Any]) -> JobResponse:
        return JobResponse(
            job_id=record["job_id"],
            job_type=record["job_type"],
            resource_id=record["resource_id"],
            plant_id=record.get("plant_id"),
            status=record["status"],
            created_at=record["created_at"],
            started_at=record.get("started_at"),
            completed_at=record.get("completed_at"),
            retry_count=record.get("retry_count", 0),
            max_retries=record.get("max_retries", 3),
            is_retryable=record.get("is_retryable", True),
            error_message=record.get("error_message"),
            result_payload=record.get("result_payload"),
        )


# Global singleton instance
job_processing_service = JobProcessingService()
