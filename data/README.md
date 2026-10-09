# SolarMind Data Directory

This directory holds local datasets, simulation traces, telemetry exports, and uploaded inspection imagery for SolarMind.

## Structure
- `raw/`: Raw solar irradiance logs, raw inverter telemetry CSVs, and uncurated input dumps.
- `processed/`: Cleansed, normalized time-series data ready for baseline modeling and fault evaluation.
- `uploads/`: Thermal or optical panel images uploaded by users for computer vision fault analysis (e.g., hotspot, bird droppings, soiling, crack inspection).

> **Security & VCS Policy:**
> All files inside `raw/`, `processed/`, and `uploads/` (except `.gitkeep`) are excluded from Git version control via `.gitignore`. Never commit proprietary telemetry, customer photos, or live system databases here.
