# MIR'AAT API

A disaster impact assessment API for Beirut buildings. Simulates blast and earthquake scenarios to identify affected structures and estimate damage severity.

## Overview

MIR'AAT analyzes building data from Beirut to assess disaster impact. Given a disaster location and parameters, it identifies all buildings within the affected radius and classifies damage as **severe** or **mild** based on distance and optional vulnerability factors.

## API Endpoints

### Disaster Simulation

| Endpoint | Description |
|----------|-------------|
| `GET /buildings/affected/blast` | Simulate blast impact |
| `GET /buildings/affected/earthquake` | Simulate earthquake impact |

Both endpoints accept:
- `lon`, `lat` - Epicenter coordinates
- `yield` (blast) or `magnitude` (earthquake) - Disaster intensity
- `includeVulnerability` (optional) - Enable vulnerability-adjusted damage assessment

### Building Lookup

| Endpoint | Description |
|----------|-------------|
| `GET /buildings/:id` | Get building details by ID |
| `GET /buildings?type=` | Query buildings by category (hospital, school, mosque, etc.) |

---

## Damage Radius Equations

### Blast (Hopkinson-Cranz Scaling Law)

The blast radius follows the cube-root scaling law used in explosive damage modeling:

```
cubeRoot = yield^(1/3)

severeRadius = 5 * cubeRoot    (meters)  ~5 psi overpressure
mildRadius   = 20 * cubeRoot   (meters)  ~1 psi overpressure
```

- **Severe zone (~5 psi)**: Structural collapse, complete destruction
- **Mild zone (~1 psi)**: Heavy damage, partial collapse, broken windows

### Earthquake

Radius scales exponentially with magnitude:

```
severeRadius = 10^(0.5 * magnitude - 2.5)   (km)
mildRadius   = 10^(0.5 * magnitude - 1.8)   (km)
```

| Magnitude | Severe Radius | Mild Radius |
|-----------|---------------|-------------|
| 5.0 | ~0.18 km | ~0.79 km |
| 6.0 | ~0.56 km | ~2.51 km |
| 7.0 | ~1.78 km | ~7.94 km |

---

## Vulnerability Model

When `includeVulnerability=true`, each building receives a vulnerability score that adjusts its damage classification. A building with high vulnerability may be classified as **severe** even if it's outside the base severe radius.

### Vulnerability Score Formula

```
vulnerabilityScore = 0.30 * age + 0.25 * height + 0.30 * condition + 0.15 * useType
```

| Factor | Weight | Description |
|--------|--------|-------------|
| Age | 30% | Older buildings are more vulnerable |
| Height | 25% | Taller buildings have higher risk |
| Condition | 30% | Current structural condition |
| Use Type | 15% | Building purpose/usage category |

### Factor Calculations

**Age Score** (0-1):
```
age = currentYear - yearCompleted
ageScore = min(age / 100, 1.0)
```
A 100+ year old building scores 1.0 (maximum vulnerability).

**Height Score** (0-1):
```
heightScore = min(floors / 30, 1.0)
```
A 30+ floor building scores 1.0 (maximum vulnerability).

### Condition Scores

| Building Condition | Score |
|--------------------|-------|
| Evicted Building | 1.0 |
| Old threat of Eviction | 0.9 |
| Old-Bldg-Inhabited | 0.8 |
| Construction on-Hold | 0.6 |
| Cancelled Construction | 0.5 |
| Under Construction | 0.5 |
| Empty Lot | 0.3 |
| Demolished | 0.3 |
| Non-Residential Building | 0.3 |
| Parking Lot | 0.2 |
| Complete Residential | 0.2 |
| Renovated | 0.1 |

### Use Type Scores

| Building Use | Score |
|--------------|-------|
| Run down | 1.0 |
| Building is not available | 0.7 |
| Religious | 0.7 |
| Industrial | 0.6 |
| Silos | 0.6 |
| Recreational | 0.5 |
| Construction Site | 0.5 |
| Residential | 0.4 |
| Commercial | 0.4 |
| Mixed-use | 0.4 |
| Institutional | 0.3 |
| Parking | 0.2 |

### Vulnerability-Adjusted Damage Classification

The severe radius expands or contracts based on building vulnerability:

```
expansionFactor = 1 + (vulnerabilityScore - 0.5)
adjustedSevereRadius = severeRadius * expansionFactor
```

- A building with score 0.7 has its severe threshold expanded by 20%
- A building with score 0.3 has its severe threshold contracted by 20%
- Score 0.5 = no adjustment (baseline)

### Risk Categories

| Risk Level | Vulnerability Score |
|------------|---------------------|
| High Risk | >= 0.7 |
| Medium Risk | 0.4 - 0.69 |
| Low Risk | < 0.4 |

---

## Response Statistics

The API returns comprehensive statistics including:

- **Population Impact**: Estimated affected residents (3.5 persons/apartment)
- **Buildings by Use**: Residential, commercial, industrial, institutional, religious, etc.
- **Buildings by Condition**: Complete, under construction, evicted, demolished, renovated
- **Structural Analysis**: Average floors, max floors, building age distribution
- **Vulnerability Distribution**: High/medium/low risk counts and average scores

---

## Building Types

Available categories for the `/buildings?type=` endpoint:

| Type | Description |
|------|-------------|
| `hospital` | Medical facilities |
| `school` | Primary/secondary schools |
| `university` | Higher education |
| `educational` | All educational facilities |
| `public` | Public institutions |
| `mosque` | Islamic places of worship |
| `church` | Christian places of worship |
| `religious` | All religious buildings |
| `police` | Police stations |
| `embassy` | Foreign embassies |
| `port` | Port facilities |
| `army` | Military zones |

---

## Running the API

```bash
npm install
npm run start:dev
```

Server runs on `http://localhost:3000`
