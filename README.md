# Heat Pump Cycle Trainer

A desktop refrigeration cycle simulator for training HVAC test lab technicians without touching live equipment.

It models a split heat pump (cooling and heating) end to end: the compressor, reversing valve, both coils, metering devices, line set, accumulator, fans, safety switches and electrical. Every adjustment ripples through both the refrigerant side and the air side.

## Using it

Open `index.html` in any browser. It is one self-contained file with no install and no server.

## What it covers

- Refrigerants: R-410A, R-454B, R-32, R-407C (large glide), R-404A
- Charge in pounds, tracked by refrigerant mass in every coil and line; sandbox mode sets superheat/subcooling targets directly
- TXV, piston or EEV on each coil
- Refrigerant weights in lb and oz, from empty (0 oz) to 1.8× factory (charge control steps 1 oz; type 7 lb 4 oz, 7 4, 7.25 or 116 oz)
- Suction accumulator fills, holds, drains through its bleed hole and overflows into the compressor in real time, drawn as a vessel with a liquid level
- Floodback: sandbox superheat target down to −15°F (below zero sets how much liquid returns), shown as % liquid back, discharge superheat and a mixture-colored suction line
- Compressor types: scroll (single-speed, two-stage, inverter), digital scroll (15-second pulse unloading), reciprocating, rotary (fixed or inverter) and screw with slide valve (three-phase). Each has its own volumetric and isentropic efficiency curves, shell heat loss and phase-rotation behavior
- Indoor and outdoor heat exchangers: tube-and-fin or microchannel (air), coaxial, shell-and-tube or brazed plate (water). Any combination works: air-to-air, water-source, air-to-water, water-to-water. The schematic redraws to match.
- Water loops on either side, named by role (condenser or evaporator), with adjustable flow, entering temperature and fluid (water, propylene or ethylene glycol 20/30/40%), freeze protection cut-outs and freeze-point warnings
- ECM or PSC blower with duct static
- Standard test points chosen to match the unit: AHRI 210/240 or 340/360 (air-source), ISO 13256-1 (water-to-air), ISO 13256-2 and AHRI 550/590 water-cooled (water-to-water), AHRI 550/590 air-cooled (air-to-water); includes break-in, rating, part-load and maximum/low-temperature operating points
- Issues (faults) an instructor can set and hide: non-condensables, TXV stuck open / stuck partly closed / lost bulb charge / loose bulb / hunting (indoor and outdoor valves), reversing valve stuck in either position or leaking internally, and out-of-phase compressor, outdoor fan and blower on three-phase supply
- Single-phase or three-phase power supply
- High/low pressure switches with trips, anti-short-cycle and lockout
- Compressor C/R/S amps, fan and blower amps
- Pressures (psig / inHg) and temperatures at nine ports, air-side psychrometrics, P-h chart
- Trend charts: every port's pressure and temperature (plus gauge readings) recorded every second of simulated time (last hour kept); chart one point from its readings panel or overlay up to eight on the Trends tab

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Built, ready-to-open simulator |
| `src/engine.js` | Cycle model: properties, coils, compressor, metering, charge inventory, solver |
| `src/app.html` | Interface template |
| `src/props.json` | Refrigerant property tables |
| `src/glossary.js` | Hover explanations for every reading and setting |
| `src/tests.js` | Standard test points for each unit type |
| `src/trends.js` | Trend history and charts |
| `tools/props.py` | Regenerates `props.json` (Peng-Robinson EOS fitted to PT charts; needs numpy + scipy) |
| `tools/build.py` | Inlines engine and tables into `index.html` |

After editing anything in `src/`, run `python3 tools/build.py`.

## Accuracy

This is a training model, not a design or certification tool. Saturation pressures match published PT charts within about 1–3 psi. Heat exchangers use a moving-boundary effectiveness model.

## Version

The version shows at the top of the page (for example `v1.0.0`) and in the event log when the simulator starts. Hover over it for the build date. The number lives in `VERSION` and is stamped in by `tools/build.py`.
