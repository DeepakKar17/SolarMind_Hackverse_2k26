"""
SolarMind Inverter Fault-Code Knowledge Service.

Provides manufacturer-aware fault code lookup, preserving official OEM documentation,
hazard warnings, and sources, while clearly separating documented facts from
SolarMind's own diagnostic interpretations.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger("solarmind.services.fault_knowledge")

DATA_FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "inverter_fault_catalog.json"


class DocumentedOEMFact(BaseModel):
    """Verbatim documented facts extracted directly from the manufacturer user manual."""

    model_config = ConfigDict(extra="forbid")

    manufacturer: str = Field(description="Inverter OEM brand name (e.g. 'Deye', 'SMA')")
    model_family: str = Field(description="Supported model series (e.g. 'SUN-(70-110)K-G03')")
    supported_models: List[str] = Field(default_factory=list, description="Specific models covered by this manual section")
    code: str = Field(description="Official fault code identifier (e.g. 'F01', 'F24')")
    documented_name: str = Field(description="Exact fault title from manufacturer manual")
    documented_description: str = Field(description="Verbatim technical explanation from manufacturer")
    documented_troubleshooting: str = Field(description="Verbatim step-by-step troubleshooting protocol from manufacturer")
    manufacturer_hazard_warning: Optional[str] = Field(default=None, description="Explicit electrical safety warnings from manual")


class SolarMindInterpretation(BaseModel):
    """SolarMind's analytical and algorithmic diagnostic interpretation of the fault."""

    model_config = ConfigDict(extra="forbid")

    category: str = Field(description="Normalized fault category ('ABNORMAL_VOLTAGE_CURRENT', 'GRID_INTERRUPTION', etc.)")
    inferred_severity: str = Field(description="Severity rating ('LOW', 'MEDIUM', 'WARNING', 'HIGH', 'CRITICAL')")
    solarmind_diagnostic_notes: str = Field(description="SolarMind diagnostic engine commentary and context")
    recommended_sensor_checks: List[str] = Field(default_factory=list, description="Telemetry metrics to cross-verify")


class SourceMetadata(BaseModel):
    """Audit metadata for verifiable OEM documentation reference."""

    model_config = ConfigDict(extra="forbid")

    source_document: str = Field(description="Full name and version of source document")
    page_reference: str = Field(description="Section, table, and page number in manual")
    mapping_confidence: float = Field(ge=0.0, le=1.0, description="Confidence rating of this documented mapping (1.0 for OEM manual)")


class FaultCodeLookupResult(BaseModel):
    """Complete manufacturer-aware fault code lookup response."""

    model_config = ConfigDict(extra="forbid")

    query_manufacturer: str
    query_code: str
    query_model: Optional[str] = None
    is_known: bool = Field(description="True if verified in OEM catalog, False if unknown/unresolved")
    status: str = Field(description="'VERIFIED_OEM_MAPPING' | 'UNRESOLVED_UNKNOWN_CODE'")
    message: str = Field(description="High-level status summary")
    documented_fact: Optional[DocumentedOEMFact] = None
    solarmind_interpretation: Optional[SolarMindInterpretation] = None
    source_metadata: Optional[SourceMetadata] = None


class FaultKnowledgeService:
    """Knowledge service querying documented inverter fault codes from catalog data."""

    def __init__(self, data_path: Optional[Path] = None):
        self._data_path = data_path or DATA_FILE_PATH
        self._catalog_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._load_catalog()

    def _load_catalog(self) -> None:
        """Loads and indexes the JSON fault catalog into memory."""
        if not os.path.exists(self._data_path):
            logger.warning("Fault catalog file not found at %s. Initializing empty catalog.", self._data_path)
            self._catalog_cache = {}
            return

        try:
            with open(self._data_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            entries = data.get("entries", [])
            cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

            for entry in entries:
                m_key = entry.get("manufacturer", "").strip().upper()
                c_key = entry.get("code", "").strip().upper()

                if m_key not in cache:
                    cache[m_key] = {}
                cache[m_key][c_key] = entry

            self._catalog_cache = cache
            logger.info("Loaded %d verified fault code definitions from %s", len(entries), self._data_path.name)
        except Exception as exc:
            logger.error("Failed to load fault catalog from %s: %s", self._data_path, exc, exc_info=True)
            self._catalog_cache = {}

    def lookup(
        self,
        manufacturer: Optional[str],
        code: str,
        model: Optional[str] = None,
    ) -> FaultCodeLookupResult:
        """
        Looks up a fault code for a given manufacturer and optional model.

        Guarantees:
        - Exact separation of documented OEM facts from SolarMind interpretations.
        - Strict unknown-code result if manufacturer or code is unmapped.
        - No generic code assumptions across different OEMs.
        """
        clean_mfg = (manufacturer or "").strip()
        clean_code = (code or "").strip()
        clean_model = (model or "").strip() if model else None

        if not clean_mfg or not clean_code:
            return FaultCodeLookupResult(
                query_manufacturer=clean_mfg or "Unknown",
                query_code=clean_code,
                query_model=clean_model,
                is_known=False,
                status="UNRESOLVED_UNKNOWN_CODE",
                message="Manufacturer and code parameters are required for verified fault lookup.",
                documented_fact=None,
                solarmind_interpretation=None,
                source_metadata=None,
            )

        m_key = clean_mfg.upper()
        c_key = clean_code.upper()

        mfg_catalog = self._catalog_cache.get(m_key)
        if not mfg_catalog:
            return FaultCodeLookupResult(
                query_manufacturer=clean_mfg,
                query_code=clean_code,
                query_model=clean_model,
                is_known=False,
                status="UNRESOLVED_UNKNOWN_CODE",
                message=f"Manufacturer '{clean_mfg}' is not currently in the verified OEM knowledge base. No code assumptions made.",
                documented_fact=None,
                solarmind_interpretation=None,
                source_metadata=None,
            )

        raw_entry = mfg_catalog.get(c_key)
        if not raw_entry:
            return FaultCodeLookupResult(
                query_manufacturer=clean_mfg,
                query_code=clean_code,
                query_model=clean_model,
                is_known=False,
                status="UNRESOLVED_UNKNOWN_CODE",
                message=f"Code '{clean_code}' is not a documented fault code for {clean_mfg} in the verified catalog. Consult manufacturer user manual.",
                documented_fact=None,
                solarmind_interpretation=None,
                source_metadata=None,
            )

        # Build Documented OEM Fact
        fact = DocumentedOEMFact(
            manufacturer=raw_entry["manufacturer"],
            model_family=raw_entry["model_family"],
            supported_models=raw_entry.get("supported_models", []),
            code=raw_entry["code"],
            documented_name=raw_entry["documented_name"],
            documented_description=raw_entry["documented_description"],
            documented_troubleshooting=raw_entry["documented_troubleshooting"],
            manufacturer_hazard_warning=raw_entry.get("manufacturer_hazard_warning"),
        )

        # Build SolarMind Interpretation
        interp_raw = raw_entry.get("solarmind_interpretation", {})
        interp = SolarMindInterpretation(
            category=interp_raw.get("category", "INVERTER_FAULT"),
            inferred_severity=interp_raw.get("inferred_severity", "HIGH"),
            solarmind_diagnostic_notes=interp_raw.get("solarmind_diagnostic_notes", ""),
            recommended_sensor_checks=interp_raw.get("recommended_sensor_checks", []),
        )

        # Build Source Metadata
        meta = SourceMetadata(
            source_document=raw_entry.get("source_document", "Verified Manufacturer Documentation"),
            page_reference=raw_entry.get("page_reference", "N/A"),
            mapping_confidence=raw_entry.get("mapping_confidence", 1.0),
        )

        return FaultCodeLookupResult(
            query_manufacturer=clean_mfg,
            query_code=clean_code,
            query_model=clean_model,
            is_known=True,
            status="VERIFIED_OEM_MAPPING",
            message=f"Verified OEM fault mapping found in {fact.source_document if hasattr(fact, 'source_document') else meta.source_document}.",
            documented_fact=fact,
            solarmind_interpretation=interp,
            source_metadata=meta,
        )

    def list_supported_manufacturers(self) -> List[str]:
        """Returns list of all manufacturers present in knowledge base."""
        return sorted([k.capitalize() for k in self._catalog_cache.keys()])

    def list_catalog_entries(self, manufacturer: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns list of entries, optionally filtered by manufacturer."""
        entries: List[Dict[str, Any]] = []
        for m_key, codes in self._catalog_cache.items():
            if manufacturer and m_key != manufacturer.strip().upper():
                continue
            for c_key, entry in codes.items():
                entries.append(entry)
        return entries


# Global knowledge service instance
fault_knowledge_service = FaultKnowledgeService()
