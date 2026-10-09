"""
SolarMind Manufacturer-Specific Inverter Fault Code Catalog.

Provides verified, manufacturer-specific fault code mappings.
Enforces the rule that generic fault dictionaries must NOT be assumed across different OEMs.
Marks unknown or unsupported codes as explicitly unresolved.
"""

from typing import Any, Dict, Optional
from app.fault_engine.schemas import DetectionCategory, SeverityLevel


# Verified manufacturer-specific error code dictionaries
MANUFACTURER_CATALOGS: Dict[str, Dict[str, Dict[str, Any]]] = {
    "DEYE": {
        "F13": {
            "title": "Grid Phase Sequence Fault / Grid Phase Lost",
            "category": DetectionCategory.GRID_INTERRUPTION,
            "severity": SeverityLevel.HIGH,
            "probable_cause": "AC grid supply phase loss or incorrect phase wiring sequence at inverter AC output terminals.",
            "recommended_action": "Check AC breaker, measure 3-phase grid line-to-line voltages with a true-RMS multimeter, and verify phase rotation.",
            "is_safety_hazard": False,
        },
        "F18": {
            "title": "AC Overcurrent Hardware Fault",
            "category": DetectionCategory.INVERTER_FAULT,
            "severity": SeverityLevel.CRITICAL,
            "probable_cause": "Instantaneous AC inverter bridge current exceeded hardware trip threshold, possibly due to grid voltage surge or load short.",
            "recommended_action": "Isolate AC/DC disconnects, inspect AC filter capacitors and inverter bridge for burn marks, verify grid impedance.",
            "is_safety_hazard": True,
        },
        "F20": {
            "title": "DC Overcurrent Hardware Trip",
            "category": DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            "severity": SeverityLevel.CRITICAL,
            "probable_cause": "DC input current exceeded inverter maximum rated peak current. Likely PV module string short or DC surge.",
            "recommended_action": "Measure string DC short-circuit current with DC clamp meter; verify string Isc does not exceed inverter MPPT rating.",
            "is_safety_hazard": True,
        },
        "F24": {
            "title": "PV Array Insulation / Ground Isolation Fault",
            "category": DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            "severity": SeverityLevel.CRITICAL,
            "probable_cause": "Insulation resistance between DC conductors (+/-) and earth ground is below 50kΩ threshold (e.g. water ingress in MC4 connector, damaged cable insulation).",
            "recommended_action": "Perform 1000V DC insulation resistance (Megger) test on each string to earth. Inspect roof cables and conduit for moisture or chafing.",
            "is_safety_hazard": True,
        },
        "F29": {
            "title": "Internal Inverter / Heatsink Over-Temperature",
            "category": DetectionCategory.ABNORMAL_TEMPERATURE,
            "severity": SeverityLevel.HIGH,
            "probable_cause": "Heatsink temperature exceeded 85°C. Cooling fan failure, blocked airflow heatsink fins, or direct solar exposure.",
            "recommended_action": "Inspect cooling fans for rotation, clean heatsink dust/debris, ensure minimum 30cm clearance on sides, install solar shade if in direct sun.",
            "is_safety_hazard": False,
        },
        "F56": {
            "title": "DC Bus Over-Voltage",
            "category": DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            "severity": SeverityLevel.CRITICAL,
            "probable_cause": "Internal DC bus capacitor voltage exceeded limit due to cold-weather open-circuit voltage surge or rapid grid disconnect.",
            "recommended_action": "Verify PV string Voc at minimum historical temperature does not exceed inverter maximum input voltage (e.g. 600V/1000V).",
            "is_safety_hazard": True,
        },
    },
    "SMA": {
        "102": {
            "title": "Grid Fault - Voltage or Frequency Out of Range",
            "category": DetectionCategory.GRID_INTERRUPTION,
            "severity": SeverityLevel.HIGH,
            "probable_cause": "Grid AC voltage or frequency deviated outside country grid code permissible window.",
            "recommended_action": "Measure grid voltage and frequency at AC isolator switch; contact distribution system operator (DSO) if persistent.",
            "is_safety_hazard": False,
        },
        "301": {
            "title": "Inverter Overtemperature Derating/Shutdown",
            "category": DetectionCategory.ABNORMAL_TEMPERATURE,
            "severity": SeverityLevel.WARNING,
            "probable_cause": "Internal temperature sensor triggered thermal derating or protection shutdown.",
            "recommended_action": "Check ventilation clearances, air filter cleanliness, and ambient room/outdoor temperature.",
            "is_safety_hazard": False,
        },
        "3501": {
            "title": "Insulation Resistance Low",
            "category": DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            "severity": SeverityLevel.CRITICAL,
            "probable_cause": "Ground fault detected on DC side before connecting to grid.",
            "recommended_action": "Disconnect all strings and test DC+ to PE and DC- to PE with 500V/1000V insulation tester.",
            "is_safety_hazard": True,
        },
    },
    "FRONIUS": {
        "301": {
            "title": "Overcurrent AC",
            "category": DetectionCategory.INVERTER_FAULT,
            "severity": SeverityLevel.HIGH,
            "probable_cause": "AC feed-in current limit briefly exceeded.",
            "recommended_action": "Check AC grid stability and AC terminal tightness.",
            "is_safety_hazard": False,
        },
        "475": {
            "title": "Solar Net Ground Current Fault",
            "category": DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            "severity": SeverityLevel.CRITICAL,
            "probable_cause": "Residual current / RCD differential threshold exceeded on DC or AC side.",
            "recommended_action": "Check for moisture in DC isolator and junction boxes.",
            "is_safety_hazard": True,
        },
    },
    "GROWATT": {
        "Error 102": {
            "title": "Sample Inconsistent - Sensor Mismatch",
            "category": DetectionCategory.INVERTER_FAULT,
            "severity": SeverityLevel.HIGH,
            "probable_cause": "Microcontroller sampling redundancy discrepancy between primary and secondary DSP.",
            "recommended_action": "Restart inverter after complete DC/AC de-energization; if persistent, replace control board.",
            "is_safety_hazard": False,
        },
        "Error 129": {
            "title": "Bus Voltage High",
            "category": DetectionCategory.ABNORMAL_VOLTAGE_CURRENT,
            "severity": SeverityLevel.HIGH,
            "probable_cause": "DC bus internal voltage spiked above safety limit.",
            "recommended_action": "Check string series panel counts and open circuit voltages.",
            "is_safety_hazard": False,
        },
    },
}


def lookup_fault_code(manufacturer: Optional[str], code: str) -> Optional[Dict[str, Any]]:
    """
    Look up a verified fault code for a specific manufacturer.

    Returns:
        Dict with fault code details if recognized, or None if unrecognized/unsupported.
    """
    if not manufacturer or not code:
        return None

    m_key = manufacturer.strip().upper()
    c_key = code.strip().upper()

    # Search in exact manufacturer catalog
    catalog = MANUFACTURER_CATALOGS.get(m_key)
    if catalog:
        # Check direct match or case-insensitive match
        for k, val in catalog.items():
            if k.upper() == c_key:
                return {
                    "manufacturer": manufacturer,
                    "code": code,
                    "is_recognized": True,
                    **val,
                }

    return None
