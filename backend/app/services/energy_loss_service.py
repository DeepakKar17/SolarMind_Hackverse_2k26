"""
SolarMind Energy Loss Estimation & Recommendation Service.

Implements rigorous, physics-grounded energy shortfall quantification,
financial deficit calculation, multi-cause attribution partitioning,
overlap deduplication, and evidence-grounded priority ranking.
"""

from datetime import datetime, timezone
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.energy_loss import (
    BaselineMethod,
    DataCoverageAudit,
    EnergyLossEstimationRequest,
    EnergyLossEstimationResponse,
    FaultAttributionItem,
    InspectionPriorityLevel,
    InspectionRecommendationDetail,
    LossCertainty,
    PriorityRankingScore,
    TelemetryIntervalPoint,
)
from app.services.fault_knowledge_service import fault_knowledge_service

logger = logging.getLogger("solarmind.services.energy_loss")


class EnergyLossService:
    """Service estimating solar generation loss and generating prioritized recommendations."""

    @staticmethod
    def _normalize_dt(dt: datetime) -> datetime:
        """Ensure naive UTC datetime for arithmetic."""
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    def estimate_energy_loss(self, request: EnergyLossEstimationRequest) -> EnergyLossEstimationResponse:
        """
        Calculates energy shortfall, financial deficit, data coverage,
        multi-cause attribution, and prioritized recommendations.
        """
        start_utc = self._normalize_dt(request.start_time)
        end_utc = self._normalize_dt(request.end_time)
        duration_seconds = max(0.0, (end_utc - start_utc).total_seconds())
        duration_hours = duration_seconds / 3600.0

        assumptions: List[str] = []
        limitations: List[str] = []

        # 1. Audit Data Coverage and Timeseries Sample Density
        coverage_audit = self._audit_coverage(
            start_utc=start_utc,
            end_utc=end_utc,
            readings=request.readings,
            nominal_interval_minutes=15.0,
        )

        # 2. Rule 1: Never infer exact lost energy from a single low-power reading
        if len(request.readings) == 1 and request.expected_baseline_kwh is None:
            limitations.append(
                "A single telemetry sample represents instantaneous power (kW) and is strictly "
                "insufficient to infer exact integrated energy loss (kWh). At least two consecutive "
                "intervals or an established time window are required."
            )
            certainty = LossCertainty.INSUFFICIENT_DATA
            expected_kwh = 0.0
            observed_kwh = 0.0
            shortfall_kwh = 0.0
            confirmed_kwh = 0.0
            potential_kwh = 0.0
            calc_method = "SINGLE_POINT_INSTANTANEOUS_EVALUATION"
        elif request.expected_baseline_kwh is not None and request.actual_generation_kwh is not None:
            # Aggregate Pre-computed Mode
            expected_kwh = max(0.0, float(request.expected_baseline_kwh))
            observed_kwh = max(0.0, float(request.actual_generation_kwh))
            shortfall_kwh = max(0.0, expected_kwh - observed_kwh)
            calc_method = "AGGREGATE_INTERVAL_SUMMATION"
            assumptions.append("Used pre-computed aggregate baseline and generation totals.")

            # Distinguish confirmed vs potential
            if request.fault_codes:
                confirmed_kwh = shortfall_kwh
                potential_kwh = 0.0
                certainty = LossCertainty.CONFIRMED_LOSS
            else:
                confirmed_kwh = 0.0
                potential_kwh = shortfall_kwh
                certainty = LossCertainty.ESTIMATED_POTENTIAL_LOSS
        elif request.readings and len(request.readings) >= 2:
            # Timeseries Integration Mode (Trapezoidal)
            expected_kwh, observed_kwh = self._integrate_timeseries(request.readings, request.installed_capacity_kwp)
            shortfall_kwh = max(0.0, expected_kwh - observed_kwh)
            calc_method = f"TRAPEZOIDAL_INTEGRATION_{int(coverage_audit.nominal_interval_minutes)}MIN"
            assumptions.append(
                f"Interpolated power linearly across {len(request.readings)} intervals using trapezoidal integration."
            )

            # Determine certainty from telemetry evidence
            has_fault_codes = bool(request.fault_codes)
            has_inverter_fault_state = any(
                r.inverter_status and any(k in r.inverter_status.lower() for k in ["fault", "error", "tripped", "outage"])
                for r in request.readings
            )

            if has_fault_codes or has_inverter_fault_state:
                confirmed_kwh = shortfall_kwh
                potential_kwh = 0.0
                certainty = LossCertainty.CONFIRMED_LOSS
            elif coverage_audit.coverage_percentage >= 70.0:
                confirmed_kwh = 0.0
                potential_kwh = shortfall_kwh
                certainty = LossCertainty.ESTIMATED_POTENTIAL_LOSS
            else:
                confirmed_kwh = 0.0
                potential_kwh = shortfall_kwh
                certainty = LossCertainty.CIRCUMSTANTIAL_SUSPICION
        else:
            # Fallback when no readings or aggregate
            limitations.append("Missing telemetry readings and pre-computed baseline. Cannot compute energy loss.")
            expected_kwh = 0.0
            observed_kwh = 0.0
            shortfall_kwh = 0.0
            confirmed_kwh = 0.0
            potential_kwh = 0.0
            calc_method = "NO_DATA_AVAILABLE"
            certainty = LossCertainty.INSUFFICIENT_DATA

        # 3. Rule 2: Never estimate financial impact without a known applicable tariff
        financial_impact_inr: Optional[float] = None
        if request.tariff_rate_inr is not None and request.tariff_rate_inr > 0.0:
            financial_impact_inr = round(shortfall_kwh * request.tariff_rate_inr, 2)
            assumptions.append(f"Applied flat electricity tariff rate of ₹{request.tariff_rate_inr:.2f} per kWh.")
        else:
            limitations.append(
                "Financial impact was not calculated because no valid electricity tariff (₹/kWh) was supplied for this plant."
            )

        # 4. Rule 3: Do not attribute all production shortfall to a single fault when multiple causes are possible
        attribution_breakdown = self._partition_attribution(
            shortfall_kwh=shortfall_kwh,
            readings=request.readings,
            fault_codes=request.fault_codes,
            concurrent_diagnoses=request.concurrent_diagnoses,
        )

        # 5. Rule 7: Build evidence-based recommendations
        recommendations = self._build_recommendations(
            request=request,
            shortfall_kwh=shortfall_kwh,
            attribution_breakdown=attribution_breakdown,
        )

        # 6. Priority Ranking Formula
        top_severity = self._extract_top_severity(request, attribution_breakdown)
        priority_ranking = self._calculate_priority_score(
            severity=top_severity,
            shortfall_kwh=shortfall_kwh,
            financial_impact_inr=financial_impact_inr,
            duration_hours=duration_hours,
            coverage_percentage=coverage_audit.coverage_percentage,
            has_confirmed_fault=certainty == LossCertainty.CONFIRMED_LOSS,
        )

        return EnergyLossEstimationResponse(
            plant_id=request.plant_id,
            inverter_id=request.inverter_id,
            start_time=start_utc,
            end_time=end_utc,
            duration_hours=round(duration_hours, 2),
            expected_generation_kwh=round(expected_kwh, 3),
            observed_generation_kwh=round(observed_kwh, 3),
            estimated_shortfall_kwh=round(shortfall_kwh, 3),
            confirmed_loss_kwh=round(confirmed_kwh, 3),
            potential_loss_kwh=round(potential_kwh, 3),
            tariff_rate_inr=request.tariff_rate_inr,
            estimated_financial_impact_inr=financial_impact_inr,
            baseline_method=request.baseline_method,
            calculation_method=calc_method,
            loss_certainty=certainty,
            attribution_breakdown=attribution_breakdown,
            data_coverage=coverage_audit,
            assumptions=assumptions,
            uncertainty_limitations=limitations,
            priority_ranking=priority_ranking,
            recommendations=recommendations,
        )

    # -------------------------------------------------------------------------
    # Overlapping Intervals Deduplication (Rule 6)
    # -------------------------------------------------------------------------

    @staticmethod
    def merge_overlapping_intervals(intervals: List[Tuple[datetime, datetime]]) -> List[Tuple[datetime, datetime]]:
        """
        Merges overlapping or contiguous time intervals to avoid double-counting
        energy shortfall across overlapping diagnosis windows (Rule 6).
        """
        if not intervals:
            return []

        # Normalize and sort by start time
        normalized = []
        for s, e in intervals:
            s_utc = s.astimezone(timezone.utc).replace(tzinfo=None) if s.tzinfo else s
            e_utc = e.astimezone(timezone.utc).replace(tzinfo=None) if e.tzinfo else e
            if e_utc > s_utc:
                normalized.append((s_utc, e_utc))

        if not normalized:
            return []

        normalized.sort(key=lambda x: x[0])

        merged: List[Tuple[datetime, datetime]] = [normalized[0]]
        for current_start, current_end in normalized[1:]:
            last_start, last_end = merged[-1]
            if current_start <= last_end:
                # Overlap or adjacent -> merge
                merged[-1] = (last_start, max(last_end, current_end))
            else:
                merged.append((current_start, current_end))

        return merged

    # -------------------------------------------------------------------------
    # Numerical Integration & Audit Helpers
    # -------------------------------------------------------------------------

    def _integrate_timeseries(
        self,
        readings: List[TelemetryIntervalPoint],
        capacity_kwp: float,
    ) -> Tuple[float, float]:
        """Calculates expected and observed energy in kWh using trapezoidal integration."""
        sorted_points = sorted(readings, key=lambda p: self._normalize_dt(p.timestamp))

        total_expected_kwh = 0.0
        total_observed_kwh = 0.0

        for i in range(len(sorted_points) - 1):
            p1 = sorted_points[i]
            p2 = sorted_points[i + 1]

            t1 = self._normalize_dt(p1.timestamp)
            t2 = self._normalize_dt(p2.timestamp)
            dt_hours = max(0.0, (t2 - t1).total_seconds() / 3600.0)

            # Skip unrealistic gaps (e.g. multi-day or overnight gap leaps)
            if dt_hours > 18.0:
                continue

            # Actual Power integration
            act_1 = p1.actual_power_kw if p1.actual_power_kw is not None else 0.0
            act_2 = p2.actual_power_kw if p2.actual_power_kw is not None else 0.0
            total_observed_kwh += ((act_1 + act_2) / 2.0) * dt_hours

            # Expected Power integration
            exp_1 = p1.expected_power_kw if p1.expected_power_kw is not None else self._infer_expected_power(p1, capacity_kwp)
            exp_2 = p2.expected_power_kw if p2.expected_power_kw is not None else self._infer_expected_power(p2, capacity_kwp)
            total_expected_kwh += ((exp_1 + exp_2) / 2.0) * dt_hours

        return total_expected_kwh, total_observed_kwh

    @staticmethod
    def _infer_expected_power(point: TelemetryIntervalPoint, capacity_kwp: float) -> float:
        """Infers expected power from POA irradiance if expected_power_kw is omitted."""
        if point.poa_irradiance_wm2 is not None and point.poa_irradiance_wm2 > 20.0:
            eff = 0.82  # Typical system derate factor
            if point.ambient_temp_c and point.ambient_temp_c > 25.0:
                temp_loss = (point.ambient_temp_c - 25.0) * 0.0038
                eff *= max(0.70, 1.0 - temp_loss)
            return (point.poa_irradiance_wm2 / 1000.0) * capacity_kwp * eff
        return 0.0

    def _audit_coverage(
        self,
        start_utc: datetime,
        end_utc: datetime,
        readings: List[TelemetryIntervalPoint],
        nominal_interval_minutes: float = 15.0,
    ) -> DataCoverageAudit:
        """Audits timeseries sample count, intervals, and missing gaps."""
        duration_minutes = max(0.0, (end_utc - start_utc).total_seconds() / 60.0)
        expected_samples = max(1, int(math.ceil(duration_minutes / nominal_interval_minutes)))

        valid_count = sum(1 for r in readings if r.is_valid and r.actual_power_kw is not None)
        missing_count = max(0, expected_samples - valid_count)
        coverage_pct = min(100.0, max(0.0, (valid_count / expected_samples) * 100.0))

        # At least 2 valid readings required for trapezoidal integration
        is_sufficient = valid_count >= 2 and coverage_pct >= 30.0

        return DataCoverageAudit(
            total_expected_samples=expected_samples,
            valid_samples_received=valid_count,
            missing_samples_count=missing_count,
            coverage_percentage=round(coverage_pct, 1),
            nominal_interval_minutes=nominal_interval_minutes,
            is_sufficient_for_integration=is_sufficient,
        )

    # -------------------------------------------------------------------------
    # Multi-Cause Attribution Partitioning (Rule 3)
    # -------------------------------------------------------------------------

    def _partition_attribution(
        self,
        shortfall_kwh: float,
        readings: List[TelemetryIntervalPoint],
        fault_codes: List[str],
        concurrent_diagnoses: List[Dict[str, Any]],
    ) -> List[FaultAttributionItem]:
        """
        Partitions shortfall across multiple concurrent causes without assigning 100%
        to a single cause when multiple anomalies are active.
        """
        if shortfall_kwh <= 0.0:
            return []

        causes: List[Tuple[str, float, str]] = []  # (Name, Weight, Rationale)

        # 1. Evaluate explicit fault codes
        for code in fault_codes:
            lookup_res = fault_knowledge_service.lookup("Deye", code)
            if lookup_res.is_known and lookup_res.solarmind_interpretation:
                cat = lookup_res.solarmind_interpretation.category
                name = f"Inverter Alarm {code} ({lookup_res.documented_fact.documented_name if lookup_res.documented_fact else cat})"
                causes.append((name, 3.0, f"Verified OEM hardware fault code '{code}' triggered."))
            else:
                causes.append((f"Unmapped Fault Code {code}", 1.5, f"Inverter reported alarm code '{code}'."))

        # 2. Evaluate concurrent active diagnoses
        for diag in concurrent_diagnoses:
            f_class = diag.get("fault_class", "ANOMALY")
            f_title = diag.get("fault_title", f_class)
            causes.append((f_title, 2.0, f"Active diagnostic record '{f_class}' overlapping this period."))

        # 3. Evaluate timeseries evidence for physical signatures
        if readings:
            has_zero_gen_high_sun = any(
                (r.actual_power_kw or 0.0) < 0.05 and (r.poa_irradiance_wm2 or 0.0) > 400.0 for r in readings
            )
            has_high_temp = any((r.ambient_temp_c or 0.0) > 42.0 for r in readings)

            if has_zero_gen_high_sun and not any("Grid" in c[0] or "F13" in c[0] for c in causes):
                causes.append(
                    ("Grid Outage / AC Supply Disconnection", 2.5, "Zero AC generation observed under high solar irradiance.")
                )
            if has_high_temp and not any("Thermal" in c[0] or "F29" in c[0] for c in causes):
                causes.append(
                    ("Thermal Derating / High Temperature", 1.0, "Ambient temperature exceeded 42°C threshold.")
                )

        if not causes:
            # Single cause or unexplained deviation
            return [
                FaultAttributionItem(
                    cause_name="Unclassified Solar Output Deficit",
                    allocated_shortfall_kwh=round(shortfall_kwh, 3),
                    percentage_of_total=100.0,
                    attribution_rationale="Shortfall observed against expected baseline with no conflicting concurrent alarms.",
                )
            ]

        # Allocate shortfall proportionally by weight
        total_weight = sum(w for _, w, _ in causes)
        attribution_items: List[FaultAttributionItem] = []

        for name, weight, rationale in causes:
            share_ratio = weight / total_weight
            allocated_kwh = round(shortfall_kwh * share_ratio, 3)
            percentage = round(share_ratio * 100.0, 1)
            attribution_items.append(
                FaultAttributionItem(
                    cause_name=name,
                    allocated_shortfall_kwh=allocated_kwh,
                    percentage_of_total=percentage,
                    attribution_rationale=rationale,
                )
            )

        return attribution_items

    # -------------------------------------------------------------------------
    # Priority Ranking Calculation & Formula
    # -------------------------------------------------------------------------

    @staticmethod
    def _calculate_priority_score(
        severity: str,
        shortfall_kwh: float,
        financial_impact_inr: Optional[float],
        duration_hours: float,
        coverage_percentage: float,
        has_confirmed_fault: bool,
    ) -> PriorityRankingScore:
        """
        Documented Priority Ranking Formula:
        Composite Priority Score P = S + I + D + E (clamped to 0-100)

        Components:
        - Severity (S, max 40): CRITICAL=40, HIGH=30, MEDIUM=18, LOW=8, INFO=4.
        - Impact (I, max 30): Shortfall kWh & INR impact tiers.
        - Duration (D, max 15): Fault persistence tiers (>24h=15, 6-24h=10, 1-6h=6, <1h=2).
        - Evidence Quality (E, max 15): Data coverage and OEM confirmation (>=90%=15, 70-90%=10, 50-70%=6, <50%=2).
        """
        # 1. Severity Component (max 40)
        sev_upper = severity.upper()
        if "CRITICAL" in sev_upper:
            s_pts = 40.0
        elif "HIGH" in sev_upper:
            s_pts = 30.0
        elif "MEDIUM" in sev_upper or "WARNING" in sev_upper:
            s_pts = 18.0
        elif "LOW" in sev_upper:
            s_pts = 8.0
        else:
            s_pts = 4.0

        # 2. Impact Component (max 30)
        if financial_impact_inr is not None:
            if financial_impact_inr >= 750.0 or shortfall_kwh >= 100.0:
                i_pts = 30.0
            elif financial_impact_inr >= 350.0 or shortfall_kwh >= 50.0:
                i_pts = 22.0
            elif financial_impact_inr >= 150.0 or shortfall_kwh >= 20.0:
                i_pts = 15.0
            elif financial_impact_inr >= 35.0 or shortfall_kwh >= 5.0:
                i_pts = 8.0
            elif shortfall_kwh > 0.5:
                i_pts = 3.0
            else:
                i_pts = 0.0
        else:
            # Fallback to pure kWh shortfall when tariff is omitted
            if shortfall_kwh >= 100.0:
                i_pts = 25.0
            elif shortfall_kwh >= 50.0:
                i_pts = 18.0
            elif shortfall_kwh >= 20.0:
                i_pts = 12.0
            elif shortfall_kwh >= 5.0:
                i_pts = 6.0
            elif shortfall_kwh > 0.5:
                i_pts = 2.0
            else:
                i_pts = 0.0

        # 3. Duration Component (max 15)
        if duration_hours >= 24.0:
            d_pts = 15.0
        elif duration_hours >= 6.0:
            d_pts = 10.0
        elif duration_hours >= 1.0:
            d_pts = 6.0
        else:
            d_pts = 2.0

        # 4. Evidence Component (max 15)
        if coverage_percentage >= 90.0 and has_confirmed_fault:
            e_pts = 15.0
        elif coverage_percentage >= 70.0:
            e_pts = 10.0
        elif coverage_percentage >= 50.0:
            e_pts = 6.0
        else:
            e_pts = 2.0

        composite = min(100.0, max(0.0, s_pts + i_pts + d_pts + e_pts))

        # Categorize
        if composite >= 80.0:
            level = InspectionPriorityLevel.CRITICAL
        elif composite >= 60.0:
            level = InspectionPriorityLevel.HIGH
        elif composite >= 40.0:
            level = InspectionPriorityLevel.MEDIUM
        elif composite >= 20.0:
            level = InspectionPriorityLevel.LOW
        else:
            level = InspectionPriorityLevel.INFORMATIONAL

        explanation = (
            f"Composite Score: {composite:.1f}/100 [Severity: {s_pts:.0f}/40, Impact: {i_pts:.0f}/30, "
            f"Duration: {d_pts:.0f}/15, Evidence: {e_pts:.0f}/15]. Level: {level.value}."
        )

        return PriorityRankingScore(
            composite_score=round(composite, 1),
            priority_level=level,
            severity_component=s_pts,
            impact_component=i_pts,
            duration_component=d_pts,
            evidence_component=e_pts,
            ranking_formula_explanation=explanation,
        )

    # -------------------------------------------------------------------------
    # Evidence-Based Recommendations Builder (Rule 7)
    # -------------------------------------------------------------------------

    def _build_recommendations(
        self,
        request: EnergyLossEstimationRequest,
        shortfall_kwh: float,
        attribution_breakdown: List[FaultAttributionItem],
    ) -> List[InspectionRecommendationDetail]:
        """Builds concrete, prioritized inspection tasks grounded in empirical evidence."""
        recs: List[InspectionRecommendationDetail] = []

        # 1. Fault Code Recommendations
        for code in request.fault_codes:
            lookup_res = fault_knowledge_service.lookup(request.inverter_manufacturer or "Deye", code)
            if lookup_res.is_known and lookup_res.documented_fact:
                fact = lookup_res.documented_fact
                precautions = [fact.manufacturer_hazard_warning] if fact.manufacturer_hazard_warning else []
                recs.append(
                    InspectionRecommendationDetail(
                        action_title=f"Resolve {fact.manufacturer} Alarm {fact.code}: {fact.documented_name}",
                        recommended_priority=InspectionPriorityLevel.CRITICAL if "DANGER" in (fact.manufacturer_hazard_warning or "") else InspectionPriorityLevel.HIGH,
                        suggested_timeline="Immediate (within 4 hours)" if "DANGER" in (fact.manufacturer_hazard_warning or "") else "Within 24 hours",
                        evidence_grounding=f"Documented OEM fault code '{code}' active during evaluation window. {fact.documented_description}",
                        safety_precautions=precautions,
                        tools_required=["True-RMS Multimeter", "Calibrated DC Insulation Tester"],
                    )
                )

        # 2. Multi-cause recommendations
        for item in attribution_breakdown:
            if "Grid Outage" in item.cause_name:
                recs.append(
                    InspectionRecommendationDetail(
                        action_title="Inspect AC Grid Interconnection & Distribution Breakers",
                        recommended_priority=InspectionPriorityLevel.HIGH,
                        suggested_timeline="Within 12 hours",
                        evidence_grounding=f"Attributed for {item.allocated_shortfall_kwh:.1f} kWh ({item.percentage_of_total:.0f}%) of generation loss. AC line measurements indicated supply disruption.",
                        safety_precautions=["De-energize AC isolator before touching terminal blocks."],
                        tools_required=["Phase Rotation Meter", "AC Clamp Meter"],
                    )
                )
            elif "Thermal Derating" in item.cause_name:
                recs.append(
                    InspectionRecommendationDetail(
                        action_title="Inspect Inverter Cooling Fans and Heatsink Clearances",
                        recommended_priority=InspectionPriorityLevel.MEDIUM,
                        suggested_timeline="Next scheduled maintenance visit",
                        evidence_grounding=f"Attributed for {item.allocated_shortfall_kwh:.1f} kWh of thermal derating shortfall during high ambient temperature periods.",
                        safety_precautions=["Allow heatsink to cool before touching external casing."],
                        tools_required=["Compressed air canister", "Infrared Thermal Camera"],
                    )
                )

        if not recs:
            if shortfall_kwh > 5.0:
                recs.append(
                    InspectionRecommendationDetail(
                        action_title="Perform String I-V Curve Check and Visual Array Inspection",
                        recommended_priority=InspectionPriorityLevel.MEDIUM,
                        suggested_timeline="Within 48 hours",
                        evidence_grounding=f"Observed unexplained energy deficit of {shortfall_kwh:.1f} kWh against expected healthy baseline.",
                        safety_precautions=["Observe standard electrical safety precautions when testing live strings."],
                        tools_required=["I-V Curve Tracer", "Clamp Meter"],
                    )
                )
            else:
                recs.append(
                    InspectionRecommendationDetail(
                        action_title="Continue Routine Telemetry Monitoring",
                        recommended_priority=InspectionPriorityLevel.INFORMATIONAL,
                        suggested_timeline="Routine schedule",
                        evidence_grounding="Generation closely tracks expected baseline with minimal variance.",
                        safety_precautions=[],
                        tools_required=[],
                    )
                )

        return recs

    def _extract_top_severity(
        self,
        request: EnergyLossEstimationRequest,
        attribution_breakdown: List[FaultAttributionItem],
    ) -> str:
        """Determines top severity across codes and diagnoses."""
        for code in request.fault_codes:
            lookup = fault_knowledge_service.lookup(request.inverter_manufacturer or "Deye", code)
            if lookup.is_known and lookup.solarmind_interpretation:
                return lookup.solarmind_interpretation.inferred_severity

        for diag in request.concurrent_diagnoses:
            sev = diag.get("severity", "WARNING")
            if sev in ["CRITICAL", "HIGH"]:
                return sev

        if any("Outage" in a.cause_name or "Ground" in a.cause_name for a in attribution_breakdown):
            return "HIGH"

        return "MEDIUM"


# Global singleton instance
energy_loss_service = EnergyLossService()
