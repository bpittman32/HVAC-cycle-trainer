# Heat Pump Cycle Trainer

A phone-friendly refrigeration cycle simulator for training HVAC test lab technicians without touching live equipment.

It models a split heat pump (cooling and heating) end to end: the compressor, reversing valve, both coils, metering devices, line set, accumulator, fans, safety switches and electrical. Every adjustment ripples through both the refrigerant side and the air side.

## Using it

Open `index.html` in any browser. It is one self-contained file with no install and no server.

## What it covers

- Refrigerants: R-410A, R-454B, R-32, R-407C (large glide), R-404A
- Charge in pounds, tracked by refrigerant mass in every coil and line; sandbox mode sets superheat/subcooling targets directly
- TXV, piston or EEV on each coil; single-speed, two-stage or inverter compressor
- Indoor and outdoor heat exchangers: tube-and-fin or microchannel (air), coaxial, shell-and-tube or brazed plate (water). Any combination works: air-to-air, water-source, air-to-water, water-to-water. The schematic redraws to match.
- Water loops on either side with adjustable flow, entering temperature and fluid (water, propylene or ethylene glycol 20/30/40%), freeze-point warnings
- ECM or PSC blower with duct static
- High/low pressure switches with trips, anti-short-cycle and lockout
- Compressor C/R/S amps, fan and blower amps
- Pressures (psig / inHg) and temperatures at nine ports, air-side psychrometrics, P-h chart

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Built, ready-to-open simulator |
| `src/engine.js` | Cycle model: properties, coils, compressor, metering, charge inventory, solver |
| `src/app.html` | Interface template |
| `src/props.json` | Refrigerant property tables |
| `tools/props.py` | Regenerates `props.json` (Peng-Robinson EOS fitted to PT charts; needs numpy + scipy) |
| `tools/build.py` | Inlines engine and tables into `index.html` |

After editing anything in `src/`, run `python3 tools/build.py`.

## Accuracy

This is a training model, not a design or certification tool. Saturation pressures match published PT charts within about 1–3 psi. Heat exchangers use a moving-boundary effectiveness model.
