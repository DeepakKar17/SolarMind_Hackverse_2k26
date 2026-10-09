# SolarMind Maintenance Workflow & Post-Repair Recovery Verification

The **SolarMind Maintenance Workflow** provides an end-to-end operational lifecycle for photovoltaic plant maintenance. It bridges AI diagnostics, dispatch scheduling, mobile field execution, checklist validation, and quantitative electrical recovery verification.

---

## 1. Architectural Architecture & State Machine

```
              ┌───────────────┐
              │     OPEN      │ <─── Created from Diagnosis / Admin Dispatch
              └───────┬───────┘
                      │ (Admin / Operator assigns Technician)
                      ▼
              ┌───────────────┐
              │   ASSIGNED    │ <─── Technician assigned / acknowledged
              └───────┬───────┘
                      │ (Technician arrives & starts inspection)
                      ▼
              ┌───────────────┐
              │  IN_PROGRESS  │ <─── Field checklist, photos, fault findings
              └───────┬───────┘
                      │ (Technician submits field repair)
                      ▼
 ┌─────────────────────────────────────────┐
 │     COMPLETED_PENDING_VERIFICATION      │
 └────────────────────┬────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │ Post-Repair Recovery Check │
        │ (Physical Baseline Model) │
        └─────────────┬─────────────┘
                      │
      ┌───────────────┴───────────────┐
      │                               │
      ▼ (Recovery Ratio >= 85%)       ▼ (Recovery Ratio < 85% / Inconclusive)
┌───────────┐                 ┌─────────────┐
│ VERIFIED  │                 │ IN_PROGRESS │ (Re-opened for technician re-work)
└─────┬─────┘                 └─────────────┘
      │ (Sign-off & Warranty)
      ▼
┌───────────┐
│  CLOSED   │
└───────────┘
```

### Supported Status Transitions
The state machine strictly enforces legitimate maintenance lifecycle transitions:

| From Status | Permitted Target Statuses | Notes |
|:---|:---|:---|
| `OPEN` / `PENDING` | `ASSIGNED`, `CANCELLED` | Work order awaiting technician assignment. |
| `ASSIGNED` | `IN_PROGRESS`, `OPEN`, `CANCELLED` | Technician unassigns or begins field inspection. |
| `IN_PROGRESS` | `COMPLETED_PENDING_VERIFICATION`, `ASSIGNED`, `CANCELLED` | Field repair completed with checklist, parts, and photos. |
| `COMPLETED_PENDING_VERIFICATION` | `VERIFIED`, `IN_PROGRESS`, `CLOSED`, `CANCELLED` | Awaiting post-repair generation recovery check. |
| `VERIFIED` | `CLOSED`, `IN_PROGRESS`, `CANCELLED` | Confirmed recovery; ready for homeowner sign-off. |
| `CLOSED` | `IN_PROGRESS` | Can only be reopened with explicit audit reasoning. |
| `CANCELLED` | `OPEN` | Cancelled order reactivated. |

---

## 2. Work Order Creation & Recommended Checklists

Work orders can be created directly from an active diagnosis or dispatched manually. When created from a diagnosis:
1. **Diagnosis Linkage**: The associated `Diagnosis` record automatically moves from `ACTIVE` to `INVESTIGATING`.
2. **Context Preservation**: Recommended inspection steps, fault severity, and probable root causes are pre-populated.
3. **Structured Checklist Templates**: Standard safety and diagnostic items are generated based on the fault class:
   - **Isolation & Safety Check**: Turn off DC isolator switch and verify zero DC current with clamp meter.
   - **Visual Thermal Inspection**: Check for discoloration, scorch marks, hot spots, or loose terminal lugs.
   - **Continuity & Open-Circuit Voltage ($V_{oc}$)**: Measure string $V_{oc}$ and compare with healthy adjacent strings.
   - **Component Replacement / Cleaning**: Replace blown fuses, faulty surge protectors, or clean dirty module glass.
   - **Post-Service Isolation & Torque Check**: Torque terminal screws to manufacturer spec and re-engage DC switch.

---

## 3. Technician Field Experience

Technicians interact through mobile-optimized touch endpoints supporting:
- **Assignment Acknowledgement**: Acceptance and travel status updates.
- **Safety Checklist Tracking**: Individual step verification (`id`, `label`, `is_completed`, `notes`).
- **Fault Observations & Root Cause Confirmation**: Qualitative observations recorded on-site.
- **Repair Actions & Parts Inventory**: Quantities and component names recorded (e.g., `["15A 1000V DC Fuse", "MC4 Connector Pair"]`).
- **Before-and-After Photo Linking**: Securely references photo inspection records.
- **Follow-up Flags**: Flags issues requiring additional parts, specialized scaffolding, or warranty RMA.
- **Completion Submission**: Transitions status to `COMPLETED_PENDING_VERIFICATION`.

---

## 4. Post-Repair Electrical Recovery Verification Engine

A technician marking a work order as "Complete" does **not** guarantee the solar system has physically recovered. The SolarMind **Recovery Verification Engine** executes a quantitative comparison:

### 1. Verification Data Window & Daylight Filtering
- Queries all telemetry within the post-repair window (default 4 to 24 hours).
- Filters for **valid daylight hours** where solar elevation $\ge 10^\circ$ and data quality is `VALID`.
- Rejects nocturnal or twilight hours ($< 10^\circ$), flagging `INSUFFICIENT_DATA` if $< 3$ valid daylight samples exist.

### 2. Physical Expected Baseline Calculation
For every valid daylight telemetry sample, the engine computes clear-sky and plane-of-array (POA) expected output:
$$P_{\text{exp}} = P_{\text{installed}} \times \left( \frac{G_{\text{POA}}}{1000} \right) \times \left[ 1 + \gamma (T_{\text{cell}} - 25^\circ\text{C}) \right] \times \eta_{\text{inverter}} \times \eta_{\text{soiling}}$$

### 3. Recovery Classification Matrix

$$\text{Recovery Ratio} = \frac{\bar{P}_{\text{actual, post-repair}}}{\bar{P}_{\text{expected, baseline}}}$$

| Verification Status | Condition | System Action |
|:---|:---|:---|
| **`VERIFIED_FULL_RECOVERY`** | $\text{Recovery Ratio} \ge 85\%$ | Affirmatively verified! Auto-resolves linked `Diagnosis` and marks work order `VERIFIED` (or `CLOSED` if `auto_close_on_success=True`). |
| **`PARTIAL_RECOVERY`** | $55\% \le \text{Recovery Ratio} < 85\%$ and $\bar{P}_{\text{post}} > 1.25 \times \bar{P}_{\text{pre}}$ | Significant electrical improvement over pre-repair baseline, but remains below physical potential. Recommends monitoring next solar noon. |
| **`INCONCLUSIVE`** | $\text{Recovery Ratio} < 55\%$ or $\bar{P}_{\text{post}} \le \bar{P}_{\text{pre}}$ | Generation remains severely depressed. Rejects completion and flags work order for technician reinspection. |
| **`INSUFFICIENT_DATA`** | $< 3$ daylight samples with elevation $\ge 10^\circ$ | Insufficient daylight telemetry in evaluation window. Advises waiting for sunny daylight interval. |

---

## 5. Security, Permissions & Audit History

### Multi-Tenant Access Control
- **Technicians**: Strictly permitted to inspect and update only work orders assigned to them. IDOR attempts against other orders return `403 Forbidden`.
- **Homeowners**: Permitted read-only access to work orders for plants they own.
- **Administrators**: Full authority to create, assign, override status, and execute recovery verifications across all plants.

### Immutable Status History & Audit Logs
Every state transition atomically generates:
1. `WorkOrderStatusHistory`: Captures `from_status`, `to_status`, `changed_by_email`, timestamp, and human-readable transition notes.
2. `AuditEvent`: Security log recording actor identity, client IP, target entity, and payload details.

---

## 6. REST API Reference

| Method | Endpoint | Description | Permitted Roles |
|:---|:---|:---|:---|
| `POST` | `/api/v1/work-orders` | Create work order from diagnosis or manual dispatch | Admin, Operator |
| `GET` | `/api/v1/work-orders` | List work orders with plant, technician, and status filters | Admin, Operator, Technician, Homeowner |
| `GET` | `/api/v1/work-orders/{id}` | Get work order details including checklist and photos | Authorized Users |
| `PATCH` | `/api/v1/work-orders/{id}` | Update work order fields and execute state transitions | Admin, Assigned Technician |
| `POST` | `/api/v1/work-orders/{id}/inspection` | Submit field checklist, fault findings, and repair completion | Assigned Technician, Admin |
| `POST` | `/api/v1/work-orders/{id}/verify` | Trigger quantitative post-repair electrical recovery verification | Admin, Operator |
| `GET` | `/api/v1/work-orders/{id}/history` | Get immutable state transition audit history | Authorized Users |
