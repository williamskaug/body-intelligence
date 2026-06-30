# Training thresholds & zones

Refreshed weekly by the capacity-sync recipe from your wearable's lab-style
estimates. The dawn-agent and race-countdown recipes parse the blocks below to
set workout targets — keep the block shapes and the `Key: value` lines intact
or they stop firing. The raw capacity numbers (VO2max, FTP, predictions) live
in the `capacity_metrics` table; this file holds the derived zones Claude
computes from them.

## Run thresholds

<!-- Filled by capacity-sync from get_lactate_threshold. LTHR drives the HR zones below. -->

- LTHR:
- Threshold pace:
- Updated:

## Run HR zones

<!-- Computed from LTHR using your PRINCIPLES.md zone model (or standard %LTHR). -->

- Z1:
- Z2:
- Z3:
- Z4:
- Z5:

## Bike thresholds

<!-- Filled by capacity-sync from get_cycling_ftp. -->

- FTP:
- Updated:

## Bike power zones

<!-- Computed from FTP (or standard %FTP). Leave blank if you don't ride with power. -->

- Z1:
- Z2:
- Z3:
- Z4:
- Z5:
- Z6:
- Z7:
