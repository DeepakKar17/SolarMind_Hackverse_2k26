# SolarMind Energy Calculations, Baseline Models & SLA Metrics

## 1. Overview & Principles

The SolarMind Analytics Service provides deterministic, standards-compliant mathematical formulations for solar energy yield aggregation, performance evaluation, loss quantification, and maintenance responsiveness.

### Core Calculation Invariants
1. **No Silent Zero Substitution**: Missing telemetry measurements (e.g., solar irradiance, cell temperature) must remain explicitly `null`/`None`. They are never coerced to zero, avoiding skewed statistical baselines.
2. **Interval-Aware Power Integration**: Instantaneous AC power ($P_{\text{ac}}$ in kW) is integrated with exact time differentials ($\Delta t$). It is never treated as static energy without interval weighting.
3. **Strict IEC 61724 Compliance**: Performance Ratio ($PR$) is computed strictly against measured Plane of Array (POA) irradiance. If irradiance is unavailable, $PR$ is flagged as uncalculated (`null`).
4. **Timezone & Time Boundary Discipline**: All calculations operate over explicit UTC boundaries $[t_{\text{start}}, t_{\text{end}}]$ with microsecond precision.
5. **Deduplication & Quality Assurance**: Telemetry records undergo timestamp and inverter deduplication before integration.

---

## 2. Energy Generation: Composite Trapezoidal Integration

### Mathematical Formulation
Given a sequence of $N$ chronological telemetry readings $\{ (t_0, P_0), (t_1, P_1), \dots, (t_{N-1}, P_{N-1}) \}$, where $t_i$ represents the timestamp and $P_i$ represents instantaneous active AC power in kilowatts ($\text{kW}$):

$$\Delta t_i = \text{seconds}(t_i - t_{i-1})$$

The energy contribution $\Delta E_i$ (in kilowatt-hours, $\text{kWh}$) for segment $i$ is calculated using the composite trapezoidal rule:

$$\Delta E_i = \left( \frac{P_{i-1} + P_i}{2} \right) \times \left( \frac{\Delta t_i}{3600} \right)$$

The total actual energy generation $E_{\text{actual}}$ over the evaluation window is:

$$E_{\text{actual}} = \sum_{i=1}^{N-1} \mathbb{I}(\Delta t_i \le \Delta t_{\text{max}}) \cdot \Delta E_i$$

where $\mathbb{I}(\cdot)$ is an indicator function enforcing the maximum allowable gap.

### Gap Clamping Policy
- **Maximum Permissible Sampling Gap ($\Delta t_{\text{max}}$)**: `3600 seconds` (1 hour).
- **Rationale**: When an inverter goes offline or communication fails for hours or days, linearly interpolating power between the last reading and the reconnection point would create artificial phantom generation. Segments where $\Delta t_i > 3600\text{ s}$ are discarded from integration.

---

## 3. Performance Ratio ($PR$) per IEC 61724

The Performance Ratio ($PR$) quantifies overall system efficiency independent of solar irradiation variations.

### Parameters
- $E_{\text{actual}}$: Actual energy generated ($\text{kWh}$).
- $P_{\text{STC}}$: Total plant installed DC capacity under Standard Test Conditions ($\text{kWp}$).
- $H_{\text{POA}}$: Cumulative Plane of Array insolation ($\text{kWh/m}^2$).
- $G_{\text{STC}}$: Reference irradiance at Standard Test Conditions ($1000\text{ W/m}^2 = 1.0\text{ kW/m}^2$).

### Yield Formulations
1. **Final Yield ($Y_f$)**:
   $$Y_f = \frac{E_{\text{actual}}}{P_{\text{STC}}} \quad (\text{hours or kWh/kWp})$$

2. **Reference Yield ($Y_r$)**:
   $$Y_r = \frac{H_{\text{POA}}}{G_{\text{STC}}} = \frac{\bar{G}_{\text{POA}} \times \Delta t_{\text{total}}}{1000.0} \quad (\text{hours})$$
   where $\bar{G}_{\text{POA}}$ is the mean Plane of Array irradiance in $\text{W/m}^2$ and $\Delta t_{\text{total}}$ is total period duration in hours.

3. **Performance Ratio ($PR$)**:
   $$PR = \left( \frac{Y_f}{Y_r} \right) \times 100\%$$

### Handling Missing References
- If $\bar{G}_{\text{POA}}$ is missing, $P_{\text{STC}} \le 0$, or $Y_r = 0$, $PR$ returns `null`.

---

## 4. Expected Generation Baseline

Expected generation $E_{\text{expected}}$ serves as a clear-sky reference baseline:

$$E_{\text{expected}} = P_{\text{STC}} \times \text{PSH}_{\text{expected}} \times \eta_{\text{system}}$$

where:
- $\text{PSH}_{\text{expected}}$: Peak Sun Hours estimated for the given geographic coordinates and period.
- $\eta_{\text{system}}$: Standard system derate factor ($\approx 0.85$ accounting for thermal losses, inverter efficiency, cabling, and soiling).

---

## 5. Energy & Financial Loss Breakdown

### Energy Loss Attribution ($E_{\text{lost}}$)
Fault-attributable lost energy is aggregated from active and resolved AI diagnoses:

$$E_{\text{lost, total}} = \sum_{d \in \mathcal{D}} E_{\text{lost}}(d)$$

where $\mathcal{D}$ is the set of diagnoses within $[t_{\text{start}}, t_{\text{end}}]$. Each incident's lost yield $E_{\text{lost}}(d)$ is determined by string-level current mismatch, voltage degradation, or clipping anomalies.

### Financial Loss Estimation
Financial deficits are computed exclusively when an authorized tariff rate ($T_{\text{rate}}$ in $\text{INR/kWh}$) is configured for the plant:

$$\text{Financial Loss (INR)} = E_{\text{lost}} \times T_{\text{rate}}$$

If no tariff rate is configured on the plant record, `total_financial_loss_inr` returns `null`.

---

## 6. Maintenance SLA Metrics

Actual maintenance timestamps from alerts and diagnoses determine SLA responsiveness:

1. **Mean Time to Acknowledge (MTTA)**:
   $$\text{MTTA} = \frac{1}{|\mathcal{A}_{\text{ack}}|} \sum_{a \in \mathcal{A}_{\text{ack}}} (t_{\text{ack}}(a) - t_{\text{event}}(a)) \quad [\text{hours}]$$
   where $\mathcal{A}_{\text{ack}}$ is the set of acknowledged alerts with valid timestamp pairs.

2. **Mean Time to Resolve (MTTR)**:
   $$\text{MTTR} = \frac{1}{|\mathcal{D}_{\text{res}}|} \sum_{d \in \mathcal{D}_{\text{res}}} (t_{\text{resolved}}(d) - t_{\text{detected}}(d)) \quad [\text{hours}]$$
   where $\mathcal{D}_{\text{res}}$ is the set of resolved diagnoses.

---

## 7. Limitations & Edge Cases

| Scenario | Behavior |
| :--- | :--- |
| **No Telemetry Readings** | Returns `total_actual_generation_kwh = 0.0`, `telemetry_records_count = 0`, `overall_performance_ratio_pct = null`. |
| **Telemetry Gaps > 1h** | Gap interval is omitted from trapezoidal integration to prevent false energy accumulation. |
| **Uncalibrated Pyranometer** | If irradiance values are anomalous ($G < 0$ or $G > 1500\text{ W/m}^2$), values are omitted from PR reference yield. |
| **Nighttime Zero Generation** | Zero AC power during night hours is retained and accurately integrates to $0\text{ kWh}$. |
