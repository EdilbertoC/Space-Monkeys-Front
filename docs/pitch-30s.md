<!-- SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README. -->

# 30-second pitch video

Format taken from a past Space Apps finalist: one voice over a screen recording of the product, captions burned in, about 80 words in 30 seconds. Every claim below is in `docs/methodology.md` or comes from the API.

## Script (82 words)

| Time | Voice | Screen |
|---|---|---|
| 0:00–0:07 | Hi, we're Space Monkeys. Satellites have watched Brazil burn since 2000, but MODIS and VIIRS count fire differently: switch sensors and the record doubles in 2012. | **MODIS vs VIIRS**, Brazil. Let the chart settle; the dashed VIIRS line jumps, the white harmonized line does not. |
| 0:07–0:12 | We built OrbitBurn: one harmonized fire record, in MODIS units, from 2000 to today. | **Burning calendar**, Pantanal, year 2020. The heatmap lights up from July to October. |
| 0:12–0:22 | Pick an area and the year a decision took effect. OrbitBurn tells you if fire is rising or falling, and how it changed, against all of Brazil. | **Trend in an area**, start on Brazil. Switch the area to Pantanal, then set the decision year to 2021. The sentence at the top changes to the new finding. |
| 0:22–0:30 | Built on open NASA data, honest about uncertainty, for the people who manage the land. | Point at the shaded 2022+ years, then open **How the record is built**. End on the title card. |

Title card (last 2 seconds): **OrbitBurn** · Space Monkeys · NASA Space Apps Challenge 2026.

## Links for the take

Open each one before recording so the API has the data cached.

1. `http://localhost:8443/?view=Historical%20Analysis&area=BR`
2. `http://localhost:8443/?view=Burning%20Calendar&area=Pantanal` (2020 is the default year; scroll until the heatmap fills the screen)
3. `http://localhost:8443/?view=Territory&area=BR`, then Pantanal and 2021 by hand
4. The "How the record is built" button, top right

## Recording

- Browser window at 1280×720, page zoom 125%, nothing else on screen.
- Windows: Win+Alt+R starts and stops the Xbox Game Bar recording of the active window. OBS works too.
- Record the voice separately on a phone in a quiet room, then lay it over the screen recording; it is easier than talking while clicking.
- Captions: `docs/pitch-30s.srt`. YouTube accepts it as a subtitle file; most editors (CapCut, Clipchamp, DaVinci) can burn it in.
- The forecast page is not in the take: the local API has no FIRMS key, so it has no forecast.

## Claims and where they come from

- "Since 2000": MODIS Terra from 2000-11-01 (`/history/meta`).
- "The record doubles in 2012": methodology, section 1 ("a naive record ... more than doubles in 2012").
- "MODIS units, 2000 to today": the harmonized series (`/history/*`, `series=harmonized`).
- "Rising or falling ... against all of Brazil": the Trend in an area page (Theil–Sen trend, before/after a chosen year, reference area).
- "Honest about uncertainty": 95% intervals, p-values, the MODIS drift years shaded on the chart.
