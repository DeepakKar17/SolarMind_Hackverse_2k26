"""Add PVAsset, PhotoInspection, and enhanced fields for all models

Revision ID: 0002_enhance_schema
Revises: 0001_initial_schema
Create Date: 2026-10-09 10:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_enhance_schema"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update Plants Table
    with op.batch_alter_table("plants") as batch_op:
        batch_op.add_column(sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"))

    # 2. Update Inverters Table
    with op.batch_alter_table("inverters") as batch_op:
        batch_op.add_column(sa.Column("firmware_version", sa.String(length=50), nullable=True))

    # 3. Create PVAsset Table
    op.create_table(
        "pv_assets",
        sa.Column("id", sa.String(length=60), nullable=False),
        sa.Column("inverter_id", sa.String(length=50), nullable=False),
        sa.Column("asset_type", sa.String(length=40), nullable=False, server_default="STRING"),
        sa.Column("identifier", sa.String(length=60), nullable=False),
        sa.Column("capacity_kwp", sa.Float(), nullable=True),
        sa.Column("panel_count", sa.Integer(), nullable=True),
        sa.Column("panel_model", sa.String(length=100), nullable=True),
        sa.Column("azimuth_deg", sa.Float(), nullable=True),
        sa.Column("tilt_deg", sa.Float(), nullable=True),
        sa.Column("configuration", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="NORMAL"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["inverter_id"], ["inverters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pv_assets_inverter_id", "pv_assets", ["inverter_id"])
    op.create_index("ix_pv_assets_asset_type", "pv_assets", ["asset_type"])
    op.create_index("ix_pv_assets_identifier", "pv_assets", ["identifier"])
    op.create_index("ix_pv_assets_status", "pv_assets", ["status"])
    op.create_index("ix_pv_assets_inverter_identifier", "pv_assets", ["inverter_id", "identifier"])

    # 4. Update Telemetries Table
    with op.batch_alter_table("telemetries") as batch_op:
        batch_op.add_column(sa.Column("pv_asset_id", sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column("ambient_temp_c", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("data_source", sa.String(length=40), nullable=False, server_default="SIMULATED"))
        batch_op.add_column(sa.Column("data_quality_flag", sa.String(length=40), nullable=False, server_default="VALID"))
        batch_op.create_foreign_key("fk_telemetries_pv_assets", "pv_assets", ["pv_asset_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_telemetries_pv_asset_id", ["pv_asset_id"])
        batch_op.create_index("ix_telemetries_data_source", ["data_source"])
        batch_op.create_index("ix_telemetries_data_quality_flag", ["data_quality_flag"])
        batch_op.create_index("ix_telemetries_asset_time", ["pv_asset_id", "timestamp"])
        batch_op.create_index("ix_telemetries_quality_time", ["data_quality_flag", "timestamp"])

    # 5. Update Diagnoses Table
    with op.batch_alter_table("diagnoses") as batch_op:
        batch_op.add_column(sa.Column("pv_asset_id", sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column("rule_score", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("evidence", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("recommended_action", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False))
        batch_op.create_foreign_key("fk_diagnoses_pv_assets", "pv_assets", ["pv_asset_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_diagnoses_pv_asset_id", ["pv_asset_id"])
        batch_op.create_index("ix_diagnoses_detected_at", ["detected_at"])

    # 6. Update Alerts Table
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.add_column(sa.Column("pv_asset_id", sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column("source", sa.String(length=40), nullable=False, server_default="INVERTER_EVENT"))
        batch_op.add_column(sa.Column("event_timestamp", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False))
        batch_op.create_foreign_key("fk_alerts_pv_assets", "pv_assets", ["pv_asset_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_alerts_pv_asset_id", ["pv_asset_id"])
        batch_op.create_index("ix_alerts_source", ["source"])
        batch_op.create_index("ix_alerts_event_timestamp", ["event_timestamp"])
        batch_op.create_index("ix_alerts_source_time", ["source", "event_timestamp"])

    # 7. Update WorkOrders Table
    with op.batch_alter_table("work_orders") as batch_op:
        batch_op.add_column(sa.Column("inverter_id", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("pv_asset_id", sa.String(length=60), nullable=True))
        batch_op.add_column(sa.Column("instructions", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("due_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("resolution_notes", sa.Text(), nullable=True))
        batch_op.create_foreign_key("fk_work_orders_inverters", "inverters", ["inverter_id"], ["id"], ondelete="SET NULL")
        batch_op.create_foreign_key("fk_work_orders_pv_assets", "pv_assets", ["pv_asset_id"], ["id"], ondelete="SET NULL")
        batch_op.create_index("ix_work_orders_inverter_id", ["inverter_id"])
        batch_op.create_index("ix_work_orders_pv_asset_id", ["pv_asset_id"])
        batch_op.create_index("ix_work_orders_technician_status", ["assigned_to", "status"])

    # 8. Create PhotoInspection Table
    op.create_table(
        "photo_inspections",
        sa.Column("id", sa.String(length=50), nullable=False),
        sa.Column("plant_id", sa.Integer(), nullable=False),
        sa.Column("inverter_id", sa.String(length=50), nullable=True),
        sa.Column("pv_asset_id", sa.String(length=60), nullable=True),
        sa.Column("diagnosis_id", sa.String(length=50), nullable=True),
        sa.Column("image_path", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=50), nullable=False, server_default="image/jpeg"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("gps_accuracy_m", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("processing_status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("analysis_result", sa.JSON(), nullable=True),
        sa.Column("fault_detected", sa.Boolean(), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["diagnosis_id"], ["diagnoses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inverter_id"], ["inverters.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["plant_id"], ["plants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pv_asset_id"], ["pv_assets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_photo_inspections_plant_id", "photo_inspections", ["plant_id"])
    op.create_index("ix_photo_inspections_inverter_id", "photo_inspections", ["inverter_id"])
    op.create_index("ix_photo_inspections_pv_asset_id", "photo_inspections", ["pv_asset_id"])
    op.create_index("ix_photo_inspections_diagnosis_id", "photo_inspections", ["diagnosis_id"])
    op.create_index("ix_photo_inspections_image_path", "photo_inspections", ["image_path"])
    op.create_index("ix_photo_inspections_uploaded_at", "photo_inspections", ["uploaded_at"])
    op.create_index("ix_photo_inspections_processing_status", "photo_inspections", ["processing_status"])
    op.create_index("ix_photo_inspections_plant_status", "photo_inspections", ["plant_id", "processing_status"])


def downgrade() -> None:
    op.drop_table("photo_inspections")
    with op.batch_alter_table("work_orders") as batch_op:
        batch_op.drop_index("ix_work_orders_technician_status")
        batch_op.drop_index("ix_work_orders_pv_asset_id")
        batch_op.drop_index("ix_work_orders_inverter_id")
        batch_op.drop_column("resolution_notes")
        batch_op.drop_column("due_date")
        batch_op.drop_column("instructions")
        batch_op.drop_column("pv_asset_id")
        batch_op.drop_column("inverter_id")
    with op.batch_alter_table("alerts") as batch_op:
        batch_op.drop_index("ix_alerts_source_time")
        batch_op.drop_index("ix_alerts_event_timestamp")
        batch_op.drop_index("ix_alerts_source")
        batch_op.drop_index("ix_alerts_pv_asset_id")
        batch_op.drop_column("event_timestamp")
        batch_op.drop_column("source")
        batch_op.drop_column("pv_asset_id")
    with op.batch_alter_table("diagnoses") as batch_op:
        batch_op.drop_index("ix_diagnoses_detected_at")
        batch_op.drop_index("ix_diagnoses_pv_asset_id")
        batch_op.drop_column("detected_at")
        batch_op.drop_column("recommended_action")
        batch_op.drop_column("evidence")
        batch_op.drop_column("rule_score")
        batch_op.drop_column("pv_asset_id")
    with op.batch_alter_table("telemetries") as batch_op:
        batch_op.drop_index("ix_telemetries_quality_time")
        batch_op.drop_index("ix_telemetries_asset_time")
        batch_op.drop_index("ix_telemetries_data_quality_flag")
        batch_op.drop_index("ix_telemetries_data_source")
        batch_op.drop_index("ix_telemetries_pv_asset_id")
        batch_op.drop_column("data_quality_flag")
        batch_op.drop_column("data_source")
        batch_op.drop_column("ambient_temp_c")
        batch_op.drop_column("pv_asset_id")
    op.drop_table("pv_assets")
    with op.batch_alter_table("inverters") as batch_op:
        batch_op.drop_column("firmware_version")
    with op.batch_alter_table("plants") as batch_op:
        batch_op.drop_column("timezone")
