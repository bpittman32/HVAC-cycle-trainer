/* Standard test points by unit type. id/od: {db,wb} for air, {ewt} for water (°F).
   load: 'full' | 'low' | 'int' | number (% capacity for part-load points). gpm: gpm per ton (optional). */
const A210 = { db: 80, wb: 67 }, A210dry = { db: 80, wb: 57 }, H210 = { db: 70, wb: 60 };
const TESTSETS = {
  'ahri210': { title: 'AHRI 210/240 — unitary air-source (under 65,000 Btu/h)', tests: [
    { k: 'BI', name: 'Break-in run', mode: 'cool', id: A210, od: { db: 95, wb: 75 }, load: 'full', note: 'Optional compressor break-in before testing, up to 20 hours as specified by the manufacturer. Run here at the A conditions.' },
    { k: 'A2', name: 'A / A2 — full capacity', mode: 'cool', id: A210, od: { db: 95, wb: 75 }, load: 'full', note: 'Standard rating point for cooling capacity and EER2.' },
    { k: 'A1', name: 'A1 — low capacity', mode: 'cool', id: A210, od: { db: 95, wb: 75 }, load: 'low', staged: true },
    { k: 'EV', name: 'EV — intermediate speed', mode: 'cool', id: A210, od: { db: 87, wb: 69 }, load: 'int', variable: true },
    { k: 'B2', name: 'B / B2 — full capacity', mode: 'cool', id: A210, od: { db: 82, wb: 65 }, load: 'full', note: 'SEER2 calculation point.' },
    { k: 'B1', name: 'B1 — low capacity', mode: 'cool', id: A210, od: { db: 82, wb: 65 }, load: 'low', staged: true },
    { k: 'C', name: 'C / D — dry coil', mode: 'cool', id: A210dry, od: { db: 82, wb: 58 }, load: 'full', note: 'Steady dry-coil (C) and cyclic (D) tests; indoor wet bulb low enough that no condensate forms.' },
    { k: 'F1', name: 'F1 — low capacity', mode: 'cool', id: A210, od: { db: 67, wb: 53.5 }, load: 'low', staged: true },
    { k: 'G1', name: 'G1 / I1 — dry coil, low capacity', mode: 'cool', id: A210dry, od: { db: 67, wb: 58 }, load: 'low', staged: true },
    { k: 'MAX', name: 'Maximum operating (cooling)', mode: 'cool', id: A210, od: { db: 115, wb: 75 }, load: 'full', note: 'Unit must run without tripping a safety.' },
    { k: 'XMAX', name: 'Extra-high maximum operating (cooling)', mode: 'cool', id: A210, od: { db: 125.6, wb: 75 }, load: 'full' },
    { k: 'LOW', name: 'Low-temperature operation (cooling)', mode: 'cool', id: { db: 67, wb: 57 }, od: { db: 67, wb: 57 }, load: 'full', note: 'Checks the indoor coil does not freeze up.' },
    { k: 'INS', name: 'Insulation efficiency / condensate disposal', mode: 'cool', id: { db: 80, wb: 75 }, od: { db: 80, wb: 75 }, load: 'full' },
    { k: 'H0', name: 'H0 / H01 — 62°F', mode: 'heat', id: H210, od: { db: 62, wb: 56.5 }, load: 'low' },
    { k: 'H1', name: 'H1 / H1C — 47°F', mode: 'heat', id: H210, od: { db: 47, wb: 43 }, load: 'full', note: 'High-temperature heating rating point (capacity and COP at 47°F).' },
    { k: 'H11', name: 'H11 — 47°F, low capacity', mode: 'heat', id: H210, od: { db: 47, wb: 43 }, load: 'low', staged: true },
    { k: 'H2', name: 'H2 — 35°F frost/defrost', mode: 'heat', id: H210, od: { db: 35, wb: 33 }, load: 'full' },
    { k: 'H3', name: 'H3 — 17°F', mode: 'heat', id: H210, od: { db: 17, wb: 15 }, load: 'full', note: 'Low-temperature heating rating point.' },
    { k: 'H4', name: 'H4 — 5°F', mode: 'heat', id: H210, od: { db: 5, wb: 3 }, load: 'full', note: 'Optional cold-climate point.' },
    { k: 'HMAX', name: 'Maximum operating (heating)', mode: 'heat', id: { db: 80, wb: 60 }, od: { db: 75, wb: 65 }, load: 'full' },
  ]},
  'ahri340': { title: 'AHRI 340/360 — commercial unitary (65,000 Btu/h and up)', tests: [
    { k: 'BI', name: 'Break-in run', mode: 'cool', id: A210, od: { db: 95, wb: 75 }, load: 'full', note: 'Optional compressor break-in before testing, up to 20 hours as specified by the manufacturer. Run here at the A conditions.' },
    { k: 'A', name: 'A — full load (EER)', mode: 'cool', id: A210, od: { db: 95, wb: 75 }, load: 'full' },
    { k: 'P75', name: 'IEER 75% load', mode: 'cool', id: A210, od: { db: 81.5, wb: 66 }, load: 75 },
    { k: 'P50', name: 'IEER 50% load', mode: 'cool', id: A210, od: { db: 68, wb: 57 }, load: 50 },
    { k: 'P25', name: 'IEER 25% load', mode: 'cool', id: A210, od: { db: 65, wb: 55 }, load: 25 },
    { k: 'MAX', name: 'Maximum operating (cooling)', mode: 'cool', id: A210, od: { db: 115, wb: 75 }, load: 'full' },
    { k: 'LOW', name: 'Low-temperature operation (cooling)', mode: 'cool', id: { db: 67, wb: 57 }, od: { db: 67, wb: 57 }, load: 'full' },
    { k: 'H1', name: 'H1 — 47°F', mode: 'heat', id: H210, od: { db: 47, wb: 43 }, load: 'full' },
    { k: 'H3', name: 'H3 — 17°F', mode: 'heat', id: H210, od: { db: 17, wb: 15 }, load: 'full' },
    { k: 'HMAX', name: 'Maximum operating (heating)', mode: 'heat', id: { db: 80, wb: 60 }, od: { db: 75, wb: 65 }, load: 'full' },
  ]},
  'iso13256_1': { title: 'ISO 13256-1 — water-to-air heat pump', tests: [
    { k: 'BI', name: 'Break-in run', mode: 'cool', id: { db: 80.6, wb: 66.2 }, od: { ewt: 86 }, load: 'full', note: 'Optional compressor break-in before testing, as specified by the manufacturer. Run here at the water-loop cooling point.' },
    { k: 'WLC', name: 'Water loop (WLHP) cooling — 86°F', mode: 'cool', id: { db: 80.6, wb: 66.2 }, od: { ewt: 86 }, load: 'full' },
    { k: 'WLH', name: 'Water loop (WLHP) heating — 68°F', mode: 'heat', id: { db: 68, wb: 59 }, od: { ewt: 68 }, load: 'full' },
    { k: 'GWC', name: 'Ground water (GWHP) cooling — 59°F', mode: 'cool', id: { db: 80.6, wb: 66.2 }, od: { ewt: 59 }, load: 'full' },
    { k: 'GWH', name: 'Ground water (GWHP) heating — 50°F', mode: 'heat', id: { db: 68, wb: 59 }, od: { ewt: 50 }, load: 'full' },
    { k: 'GLC', name: 'Ground loop (GLHP) cooling — 77°F', mode: 'cool', id: { db: 80.6, wb: 66.2 }, od: { ewt: 77 }, load: 'full' },
    { k: 'GLCP', name: 'Ground loop (GLHP) cooling part load — 68°F', mode: 'cool', id: { db: 80.6, wb: 66.2 }, od: { ewt: 68 }, load: 'low' },
    { k: 'GLH', name: 'Ground loop (GLHP) heating — 32°F', mode: 'heat', id: { db: 68, wb: 59 }, od: { ewt: 32 }, load: 'full', note: 'Ground-loop heating uses antifreeze (brine) at 32°F entering.' },
    { k: 'GLHP', name: 'Ground loop (GLHP) heating part load — 41°F', mode: 'heat', id: { db: 68, wb: 59 }, od: { ewt: 41 }, load: 'low' },
  ]},
  'iso13256_2': { title: 'ISO 13256-2 — water-to-water heat pump', tests: [
    { k: 'BI', name: 'Break-in run', mode: 'cool', id: { ewt: 53.6 }, od: { ewt: 86 }, load: 'full', note: 'Optional compressor break-in, as specified by the manufacturer. Run here at the water-loop cooling point.' },
    { k: 'WLC', name: 'Water loop cooling — load 53.6°F / source 86°F', mode: 'cool', id: { ewt: 53.6 }, od: { ewt: 86 }, load: 'full' },
    { k: 'WLH', name: 'Water loop heating — load 104°F / source 68°F', mode: 'heat', id: { ewt: 104 }, od: { ewt: 68 }, load: 'full' },
    { k: 'GWC', name: 'Ground water cooling — load 53.6°F / source 59°F', mode: 'cool', id: { ewt: 53.6 }, od: { ewt: 59 }, load: 'full' },
    { k: 'GWH', name: 'Ground water heating — load 104°F / source 50°F', mode: 'heat', id: { ewt: 104 }, od: { ewt: 50 }, load: 'full' },
    { k: 'GLC', name: 'Ground loop cooling — load 53.6°F / source 77°F', mode: 'cool', id: { ewt: 53.6 }, od: { ewt: 77 }, load: 'full' },
    { k: 'GLH', name: 'Ground loop heating — load 104°F / source 32°F', mode: 'heat', id: { ewt: 104 }, od: { ewt: 32 }, load: 'full' },
  ]},
  'ahri550wc': { title: 'AHRI 550/590 — water-cooled chiller', tests: [
    { k: 'BI', name: 'Break-in run', mode: 'cool', id: { ewt: 54, gpm: 2.4 }, od: { ewt: 85, gpm: 3 }, load: 'full', note: 'Run at standard rating conditions.' },
    { k: 'STD', name: 'Standard rating — 44°F LWT, 85°F ECWT', mode: 'cool', id: { ewt: 54, gpm: 2.4 }, od: { ewt: 85, gpm: 3 }, load: 'full', note: '54°F entering / 44°F leaving chilled water at 2.4 gpm/ton; 85°F entering condenser water at 3 gpm/ton.' },
    { k: 'P75', name: 'IPLV 75% load — 75°F ECWT', mode: 'cool', id: { ewt: 51.5, gpm: 2.4 }, od: { ewt: 75, gpm: 3 }, load: 75 },
    { k: 'P50', name: 'IPLV 50% load — 65°F ECWT', mode: 'cool', id: { ewt: 49, gpm: 2.4 }, od: { ewt: 65, gpm: 3 }, load: 50 },
    { k: 'P25', name: 'IPLV 25% load — 65°F ECWT', mode: 'cool', id: { ewt: 46.5, gpm: 2.4 }, od: { ewt: 65, gpm: 3 }, load: 25 },
  ]},
  'ahri550ac': { title: 'AHRI 550/590 — air-cooled chiller / air-to-water heat pump', tests: [
    { k: 'BI', name: 'Break-in run', mode: 'cool', id: { ewt: 54, gpm: 2.4 }, od: { db: 95, wb: 75 }, load: 'full', note: 'Run at standard rating conditions.' },
    { k: 'STD', name: 'Standard rating — 44°F LWT, 95°F air', mode: 'cool', id: { ewt: 54, gpm: 2.4 }, od: { db: 95, wb: 75 }, load: 'full', note: '54°F entering / 44°F leaving chilled water at 2.4 gpm/ton; 95°F air entering the condenser.' },
    { k: 'P75', name: 'IPLV 75% load — 80°F air', mode: 'cool', id: { ewt: 51.5, gpm: 2.4 }, od: { db: 80, wb: 67 }, load: 75 },
    { k: 'P50', name: 'IPLV 50% load — 65°F air', mode: 'cool', id: { ewt: 49, gpm: 2.4 }, od: { db: 65, wb: 56 }, load: 50 },
    { k: 'P25', name: 'IPLV 25% load — 55°F air', mode: 'cool', id: { ewt: 46.5, gpm: 2.4 }, od: { db: 55, wb: 48 }, load: 25 },
    { k: 'H47', name: 'Heating — 47°F air, 105°F hot water', mode: 'heat', id: { ewt: 95 }, od: { db: 47, wb: 43 }, load: 'full', note: '95°F entering / about 105°F leaving hot water.' },
    { k: 'H17', name: 'Heating — 17°F air, 105°F hot water', mode: 'heat', id: { ewt: 95 }, od: { db: 17, wb: 15 }, load: 'full' },
  ]},
};
function unitTestSets(idWater, odWater, tons) {
  if (!idWater && !odWater) return [tons > 5.4 ? 'ahri340' : 'ahri210'];
  if (!idWater && odWater) return ['iso13256_1'];
  if (idWater && odWater) return ['iso13256_2', 'ahri550wc'];
  return ['ahri550ac'];
}
