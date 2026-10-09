# SolarMind Geo Photo AI - Computer Vision Integration Guide 📷🤖

This document describes the architecture of the **Geo Photo AI** inspection pipeline and outlines the exact step-by-step process for integrating a real, trained computer-vision model (e.g. YOLOv8, PyTorch, ONNX Runtime, or Hugging Face ViT) for automated solar module defect detection.

---

## 1. Architectural Overview

The Geo Photo AI pipeline consists of three decoupled components:

1. **Storage & Validation Layer** (`PhotoStorageService`):
   - Enforces file size limits (default: 10 MB).
   - Validates MIME type (`image/jpeg`, `image/png`, `image/webp`).
   - Uses Pillow (`PIL.Image.open().verify()`) to decode and confirm byte-level image integrity.
   - Strips path-traversal sequences and null bytes from filenames.
   - Generates server-side unique filenames stored in a controlled directory without leaking internal filesystem paths.

2. **Pluggable Vision Interface** (`BaseVisionProvider`):
   - Defines a standard contract for defect detection.
   - Default provider (`UnconfiguredVisionProvider`) returns `status="NOT_CONFIGURED"` without fabricating synthetic detections.
   - Distinguishes visible surface observations from internal electrical faults requiring multimeter / insulation megger testing.

3. **REST API Interface** (`/api/v1/photos/*`):
   - `POST /api/v1/photos/upload-file`: Multipart binary upload with optional GPS coordinates and notes.
   - `GET /api/v1/photos/{id}/status`: Processing status inquiry (`PENDING`, `ANALYZING`, `COMPLETED`, `NOT_CONFIGURED`, `FAILED`).
   - `POST /api/v1/photos/{id}/analyze`: Triggers visual defect detection.
   - `GET /api/v1/photos/{id}/results`: Returns structured visual detections, bounding boxes, severity, and recommendations.
   - `GET /api/v1/photos/{id}/file`: Streams image binary safely with Content-Type headers.

---

## 2. Step-by-Step Guide: Adding a Real Computer Vision Model

### Step 1: Install ML Dependencies
Add the required runtime (e.g., ONNX Runtime or Ultralytics YOLO) to `backend/requirements.txt`:

```bash
pip install ultralytics onnxruntime
```

### Step 2: Implement `BaseVisionProvider`
Create a new provider class in `backend/app/services/vision_pipeline_service.py` (or a dedicated plugin module `backend/app/services/cv_providers/yolo_provider.py`):

```python
import io
from datetime import datetime, timezone
from PIL import Image
from ultralytics import YOLO
from app.services.vision_pipeline_service import BaseVisionProvider
from app.schemas.photo_inspection import VisionAnalysisResult, VisualDetectionItem

class YOLOSolarDefectProvider(BaseVisionProvider):
    def __init__(self, weights_path: str = "models/solar_defect_yolov8.pt"):
        self._weights_path = weights_path
        self._model = None
        self._load_model()

    def _load_model(self):
        try:
            self._model = YOLO(self._weights_path)
        except Exception as exc:
            self._model = None

    @property
    def model_name(self) -> str:
        return "YOLOv8-Solar-Defect-Classifier"

    @property
    def model_version(self) -> str:
        return "1.0.0"

    @property
    def is_configured(self) -> bool:
        return self._model is not None

    def analyze_image(self, image: Image.Image, filename: str) -> VisionAnalysisResult:
        if not self.is_configured:
            return VisionAnalysisResult(
                status="NOT_CONFIGURED",
                summary="Model weights file not found.",
                electrical_testing_required=False,
            )

        # Run inference
        results = self._model(image)
        detections = []
        elec_req = False

        for r in results:
            for box in r.boxes:
                cls_name = r.names[int(box.cls[0])].upper()
                conf = float(box.conf[0])
                coords = box.xyxyn[0].tolist()  # [xmin, ymin, xmax, ymax]

                is_crack = "CRACK" in cls_name
                if is_crack:
                    elec_req = True

                detections.append(
                    VisualDetectionItem(
                        defect_class=cls_name,
                        description=f"Automated detection of {cls_name}",
                        confidence=conf,
                        severity="CRITICAL" if is_crack else "MEDIUM",
                        bounding_box={
                            "xmin": coords[0],
                            "ymin": coords[1],
                            "xmax": coords[2],
                            "ymax": coords[3],
                        },
                        is_visual_observation_only=not is_crack,
                    )
                )

        return VisionAnalysisResult(
            status="COMPLETED",
            model_name=self.model_name,
            model_version=self.model_version,
            detections=detections,
            summary=f"Detected {len(detections)} visual defects.",
            electrical_testing_required=elec_req,
            recommended_actions=["Perform string megger testing"] if elec_req else ["Clean module glass"],
            processed_at=datetime.now(timezone.utc),
        )
```

### Step 3: Register the Provider in Configuration
In `backend/app/core/config.py` or `.env`:

```ini
VISION_MODEL_ENABLED=True
VISION_MODEL_PATH="models/solar_defect_yolov8.pt"
```

And update `VisionPipelineService.get_active_provider()`:

```python
if settings.VISION_MODEL_ENABLED and settings.VISION_MODEL_PATH:
    return YOLOSolarDefectProvider(weights_path=settings.VISION_MODEL_PATH)
```

### Step 4: Validate via Tests
Run the test suite to verify end-to-end integration:

```bash
pytest tests/test_geo_photo_ai.py -v
```

---

## 3. Defect Taxonomy & Safety Distinction

| Defect Class | Visual Presentation | Safety & Electrical Implication |
| :--- | :--- | :--- |
| **`SOILING`** | Dust, bird droppings, pollen layer | Non-hazardous optical attenuation. Requires scheduled water wash. |
| **`SHADING`** | Tree, chimney, or parapet shadow | Optical obstruction causing mismatch loss. Bypass diodes may activate. |
| **`SURFACE_CRACK`** | Glass fracture, cell micro-crack | **High Hazard**: Potential moisture ingress, hot spot, and ground insulation fault ($F24$). Electrical megger testing mandatory. |
| **`HOTSPOT_DISCOLORATION`**| Brown/yellow localized burn mark | Power dissipation in shaded cell. Inspect with thermal camera. |
| **`DELAMINATION`** | EVA browning, backsheet peeling | Long-term insulation degradation. |
| **`VEGETATION`** | Weeds or vine encroachment | Direct shading and physical wire hazard. Pruning required. |
