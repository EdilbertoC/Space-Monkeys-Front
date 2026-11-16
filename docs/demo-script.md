<!-- SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README. -->

# Demo video and slides: draft for review

Status: draft. Every number below was read from the API or `docs/methodology.md` of this repository; nothing is invented. Record the demo against the local API (the Discloud site `orbitburn.discloud.app` does not resolve any more). The decision years used are **example dates chosen by the analyst, not claims about any policy.**

## The one-sentence story

Satellites flag hot pixels, not fires, and the two sensors that watched Earth for 25 years count differently. We harmonized them into one record, so an analyst can finally ask: **in this territory, is fire going up or down, and did it change after a decision?**

## Video, about 3 minutes

| Time | Screen | Say |
|---|---|---|
| 0:00 | Slide: a MODIS pixel (1 km) and VIIRS pixels (375 m) over the same fire | A hotspot is a pixel flagged as hot. It is not a fire count and not burned area. |
| 0:20 | Slide: naive MODIS-then-VIIRS series with the 2012 step | VIIRS sees small fires MODIS misses and splits one fire into several pixels. A naive record more than doubles in 2012. That step is the sensors, not the fire. |
| 0:40 | Slide: bridge diagram, MODIS 2012–2021 to VIIRS estimate | MODIS is ending and its orbits are drifting. The years both sensors overlap are the only window to learn the bridge, so we learn it now. Test error on monthly totals: 3.7% for Brazil, 9.8% in the Pantanal. |
| 1:00 | App, Territory, Brazil, no decision | Is fire going up or down? Over Brazil the trend is significant, though only just: the 95% interval ends at −3, barely below zero. |
| 1:25 | Territory, Amazon, 2008 vs Brazil | The Amazon fell 40% in the median year after 2008 (p = 0.001). Brazil as a whole fell 37%. So this drop is not specific to the Amazon, and the reference line shows it. |
| 1:55 | Territory, Pantanal, 2021 vs Brazil | The Pantanal's median year is 28% lower after 2021, while Brazil moved 2%. That looks different from the country, but p = 0.13 and there are only five years after, so we do not call it a result. |
| 2:25 | Point at the shaded 2022+ years and the warning | From 2022 MODIS drifts. Observed MODIS runs 8–15% above our VIIRS-based estimate over Brazil, so recent years can read high. The app marks them instead of hiding it. |
| 2:45 | Slide: "association, not cause" | This shows association. There is no climate data here, so a drop after a decision is a lead, not proof. |
| 2:55 | Slide: open API, Australia | Open API, CSV export and a copyable call per chart. The same method ran on Australia, and the 2012 step disappears there too. |

Numbers behind the table (API `/history/trend`, harmonized series, complete years 2003–2025):

- Brazil: slope −3,301 fire cell-days per year, 95% CI −6,583 to −3, significant.
- Amazon: median year 75,057 before 2019 against 71,567 after (−5%); for 2008, −40% (p = 0.001) against Brazil −37%.
- Pantanal: slope −95 per year, 95% CI −194 to 49, not significant. 2021 split: 3,695 before (18 years), 2,650 after (5 years), −28%, p = 0.127; Brazil −2%. The 2020 total of 9,717 is the record high of the series.

## Slides, 7 slides

1. **Title.** OrbitBurn: one fire record, 2000 to today.
2. **The problem.** A hotspot is not a fire. A naive MODIS-then-VIIRS record more than doubles in 2012, and over Brazil counting what VIIRS sees as if it were MODIS overstates MODIS fire cell-days by 145%.
3. **The method.** Fire-day per 0.1° cell, OR across sensors, LightGBM and U-Net compared on the same split, train 2012–2017, test 2018 on.
4. **The result.** Before and after plot: the step gone. Monthly error 3.7% Brazil.
5. **The question it answers.** Territory page screenshot: trend, decision marker, reference.
6. **What we do not claim.** Association not cause; no climate data; MODIS drift marked; small samples.
7. **Open data.** NASA FIRMS, NOAA, IBGE; API link and repository.

## Before recording, check

- The local API is the `feat/api-gaps` branch (contract 0.7.0). The forecast needs `FIRMS_MAP_KEY`; without it `/forecast/summary` answers 503, so keep the forecast out of the take.
- Use these links so the screen matches the script:
  - `?view=Territory&area=BR`
  - `?view=Territory&area=Amazon&decision=2008&label=Example%20date`
  - `?view=Territory&area=Pantanal&decision=2021&label=Example%20date`
- The 2012 step slide needs the figure from `docs/figures` of the backend repository.
