"""Complete SolarMind database schema migrations

Revision ID: 0003_complete_schema
Revises: 0002_enhance_schema
Create Date: 2026-10-09 13:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0003_complete_schema"
down_revision: Union[str, None] = "0002_enhance_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Plant User Assignments Table
    op.create_table(
        "plant_user_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=50), server_default="homeowner", nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("assigned_by_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plant_id", "user_id", name="uq_plant_user_assignment"),
    )
    op.create_index("ix_plant_user_assignments_plant_id", "plant_user_assignments", ["plant_id"])
    op.create_index("ix_plant_user_assignments_user_id", "plant_user_assignments", ["user_id"])
    op.create_index("ix_plant_user_role", "plant_user_assignments", ["plant_id", "user_id", "role"])

    # 2. Fault Catalog Entries Table
    op.create_table(
        "fault_catalog_entries",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("severity_default", sa.String(length=30), server_default="MEDIUM", nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("standard_remediation", sa.Text(), nullable=False),
        sa.Column("iec_standard_ref", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fault_catalog_entries_name", "fault_catalog_entries", ["name"])
    op.create_index("ix_fault_catalog_entries_category", "fault_catalog_entries", ["category"])
    op.create_index("ix_fault_catalog_cat_active", "fault_catalog_entries", ["category", "is_active"])

    # 3. Diagnosis Rule Versions Table
    op.create_table(
        "diagnosis_rule_versions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rule_id", sa.String(length=60), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=30), server_default="WARNING", nullable=False),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("threshold_unit", sa.String(length=30), server_default="percent", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("previous_threshold_value", sa.Float(), nullable=True),
        sa.Column("documentation", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diagnosis_rule_versions_rule_id", "diagnosis_rule_versions", ["rule_id"])
    op.create_index("ix_diag_rules_rule_ver", "diagnosis_rule_versions", ["rule_id", "version"])

    # 4. Diagnosis Evidence Table
    op.create_table(
        "diagnosis_evidence",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("diagnosis_id", sa.String(length=50), nullable=False),
        sa.Column("evidence_type", sa.String(length=50), nullable=False),
        sa.Column("metric_name", sa.String(length=80), nullable=False),
        sa.Column("metric_value", sa.Float(), nullable=True),
        sa.Column("metric_unit", sa.String(length=30), nullable=True),
        sa.Column("reference_timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("photo_inspection_id", sa.String(length=50), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("evidence_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["diagnosis_id"], ["diagnoses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["photo_inspection_id"], ["photo_inspections.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diagnosis_evidence_diagnosis_id", "diagnosis_evidence", ["diagnosis_id"])
    op.create_index("ix_diag_evidence_type_time", "diagnosis_evidence", ["diagnosis_id", "evidence_type"])

    # 5. Weather Records Table
    op.create_table(
        "weather_records",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("poa_irradiance_wm2", sa.Float(), nullable=True),
        sa.Column("ghi_irradiance_wm2", sa.Float(), nullable=True),
        sa.Column("ambient_temperature_c", sa.Float(), nullable=True),
        sa.Column("cell_temperature_c", sa.Float(), nullable=True),
        sa.Column("wind_speed_ms", sa.Float(), nullable=True),
        sa.Column("cloud_cover_pct", sa.Float(), nullable=True),
        sa.Column("data_source", sa.String(length=50), server_default="WEATHER_STATION", nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_weather_records_plant_id", "weather_records", ["plant_id"])
    op.create_index("ix_weather_records_timestamp", "weather_records", ["timestamp"])
    op.create_index("ix_weather_plant_timestamp", "weather_records", ["plant_id", "timestamp"])

    # 6. Outage Events Table
    op.create_table(
        "outage_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("inverter_id", sa.String(length=50), nullable=True),
        sa.Column("event_type", sa.String(length=50), server_default="GRID_OUTAGE", nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Float(), nullable=True),
        sa.Column("estimated_lost_energy_kwh", sa.Float(), nullable=True),
        sa.Column("estimated_financial_loss_inr", sa.Float(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("resolved", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["inverter_id"], ["inverters.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outage_events_plant_id", "outage_events", ["plant_id"])
    op.create_index("ix_outage_events_start_time", "outage_events", ["start_time"])
    op.create_index("ix_outage_plant_start", "outage_events", ["plant_id", "start_time"])

    # 7. Work Order Status History Table
    op.create_table(
        "work_order_status_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("work_order_id", sa.String(length=50), nullable=False),
        sa.Column("from_status", sa.String(length=40), nullable=True),
        sa.Column("to_status", sa.String(length=40), nullable=False),
        sa.Column("changed_by_id", sa.Integer(), nullable=True),
        sa.Column("changed_by_email", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_order_status_history_work_order_id", "work_order_status_history", ["work_order_id"])
    op.create_index("ix_work_order_status_history_timestamp", "work_order_status_history", ["timestamp"])
    op.create_index("ix_wo_status_history_order_time", "work_order_status_history", ["work_order_id", "timestamp"])

    # 8. Integration Sync Runs Table
    op.create_table(
        "integration_sync_runs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("integration_id", sa.String(length=60), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("records_ingested", sa.Integer(), server_default="0", nullable=False),
        sa.Column("records_failed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=30), server_default="SUCCESS", nullable=False),
        sa.Column("duration_ms", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["integration_id"], ["integration_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_integration_sync_runs_integration_id", "integration_sync_runs", ["integration_id"])
    op.create_index("ix_sync_run_integ_time", "integration_sync_runs", ["integration_id", "timestamp"])

    # 9. Application Settings Table
    op.create_table(
        "application_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=50), server_default="SYSTEM", nullable=False),
        sa.Column("is_secret", sa.Boolean(), server_default=sa.text("0"), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_application_settings_key", "application_settings", ["key"])
    op.create_index("ix_app_settings_cat_key", "application_settings", ["category", "key"])


def downgrade() -> None:
    op.drop_table("application_settings")
    op.drop_table("integration_sync_runs")
    op.drop_table("work_order_status_history")
    op.drop_table("outage_events")
    op.drop_table("weather_records")
    op.drop_table("diagnosis_evidence")
    op.drop_table("diagnosis_rule_versions")
    op.drop_table("fault_catalog_entries")
    op.drop_table("plant_user_assignments")
