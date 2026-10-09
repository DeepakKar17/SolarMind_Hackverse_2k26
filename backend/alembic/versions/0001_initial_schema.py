"""Initial SolarMind schema migration

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Plants Table
    op.create_table(
        "plants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("system_type", sa.String(length=60), nullable=False, server_default="Single-String Residential Rooftop"),
        sa.Column("installed_capacity_kwp", sa.Float(), nullable=False),
        sa.Column("tariff_rate_inr", sa.Float(), nullable=False, server_default="7.50"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="NORMAL"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plants_name", "plants", ["name"])
    op.create_index("ix_plants_status", "plants", ["status"])
    op.create_index("ix_plants_status_active", "plants", ["status", "is_active"])
    op.create_index("ix_plants_owner_id", "plants", ["owner_id"])

    # 2. Inverters Table
    op.create_table(
        "inverters",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("serial_number", sa.String(length=100), nullable=False),
        sa.Column("manufacturer", sa.String(length=80), nullable=False),
        sa.Column("model", sa.String(length=80), nullable=False),
        sa.Column("rated_ac_power_kw", sa.Float(), nullable=False),
        sa.Column("mppt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("strings_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="NORMAL"),
        sa.Column("last_telemetry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("serial_number"),
    )
    op.create_index("ix_inverters_plant_id", "inverters", ["plant_id"])
    op.create_index("ix_inverters_serial_number", "inverters", ["serial_number"])
    op.create_index("ix_inverters_status", "inverters", ["status"])
    op.create_index("ix_inverters_plant_status", "inverters", ["plant_id", "status"])

    # 3. Telemetry Table (telemetries)
    op.create_table(
        "telemetries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("inverter_id", sa.String(length=50), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("v_dc", sa.Float(), nullable=True),
        sa.Column("i_dc", sa.Float(), nullable=True),
        sa.Column("p_dc", sa.Float(), nullable=True),
        sa.Column("v_ac", sa.Float(), nullable=True),
        sa.Column("i_ac", sa.Float(), nullable=True),
        sa.Column("p_ac", sa.Float(), nullable=True),
        sa.Column("frequency_hz", sa.Float(), nullable=True),
        sa.Column("temperature_c", sa.Float(), nullable=True),
        sa.Column("poa_irradiance_wm2", sa.Float(), nullable=True),
        sa.Column("daily_yield_kwh", sa.Float(), nullable=True),
        sa.Column("total_yield_kwh", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["inverter_id"], ["inverters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_telemetries_inverter_id", "telemetries", ["inverter_id"])
    op.create_index("ix_telemetries_timestamp", "telemetries", ["timestamp"])
    op.create_index("ix_telemetries_inverter_time", "telemetries", ["inverter_id", "timestamp"])

    # 4. Diagnoses Table
    op.create_table(
        "diagnoses",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("inverter_id", sa.String(length=50), nullable=False),
        sa.Column("affected_string", sa.String(length=100), nullable=True),
        sa.Column("fault_class", sa.String(length=60), nullable=False),
        sa.Column("fault_title", sa.String(length=150), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="WARNING"),
        sa.Column("engine_type", sa.String(length=40), nullable=False, server_default="ML_CLASSIFIER"),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("is_suspicion_only", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("has_insufficient_evidence", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("estimated_lost_energy_kwh", sa.Float(), nullable=True),
        sa.Column("cumulative_lost_energy_kwh", sa.Float(), nullable=True),
        sa.Column("financial_deficit_inr", sa.Float(), nullable=True),
        sa.Column("probable_cause", sa.Text(), nullable=False),
        sa.Column("root_cause_summary", sa.Text(), nullable=False),
        sa.Column("data_quality_warning", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["inverter_id"], ["inverters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_diagnoses_plant_id", "diagnoses", ["plant_id"])
    op.create_index("ix_diagnoses_inverter_id", "diagnoses", ["inverter_id"])
    op.create_index("ix_diagnoses_fault_class", "diagnoses", ["fault_class"])
    op.create_index("ix_diagnoses_severity", "diagnoses", ["severity"])
    op.create_index("ix_diagnoses_status", "diagnoses", ["status"])
    op.create_index("ix_diagnoses_plant_status", "diagnoses", ["plant_id", "status"])
    op.create_index("ix_diagnoses_class_severity", "diagnoses", ["fault_class", "severity"])

    # 5. Alerts Table
    op.create_table(
        "alerts",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("inverter_id", sa.String(length=50), nullable=False),
        sa.Column("string_id", sa.String(length=100), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="WARNING"),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("acknowledged_by", sa.String(length=100), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("related_diagnosis_id", sa.String(length=50), nullable=True),
        sa.Column("estimated_power_loss_kw", sa.Float(), nullable=True),
        sa.Column("estimated_daily_loss_kwh", sa.Float(), nullable=True),
        sa.Column("actionable_guidance", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["inverter_id"], ["inverters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["related_diagnosis_id"], ["diagnoses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alerts_plant_id", "alerts", ["plant_id"])
    op.create_index("ix_alerts_inverter_id", "alerts", ["inverter_id"])
    op.create_index("ix_alerts_code", "alerts", ["code"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_acknowledged", "alerts", ["acknowledged"])
    op.create_index("ix_alerts_plant_status_ack", "alerts", ["plant_id", "status", "acknowledged"])

    # 6. Work Orders Table
    op.create_table(
        "work_orders",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("diagnosis_id", sa.String(length=50), nullable=True),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="HIGH"),
        sa.Column("assigned_to", sa.String(length=100), nullable=False),
        sa.Column("service_provider", sa.String(length=100), nullable=True),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("completed_date", sa.Date(), nullable=True),
        sa.Column("duration_hours", sa.Float(), nullable=True),
        sa.Column("cost_inr", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["diagnosis_id"], ["diagnoses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_orders_plant_id", "work_orders", ["plant_id"])
    op.create_index("ix_work_orders_diagnosis_id", "work_orders", ["diagnosis_id"])
    op.create_index("ix_work_orders_priority", "work_orders", ["priority"])
    op.create_index("ix_work_orders_status", "work_orders", ["status"])
    op.create_index("ix_work_orders_plant_status", "work_orders", ["plant_id", "status"])


def downgrade() -> None:
    op.drop_table("work_orders")
    op.drop_table("alerts")
    op.drop_table("diagnoses")
    op.drop_table("telemetries")
    op.drop_table("inverters")
    op.drop_table("plants")
