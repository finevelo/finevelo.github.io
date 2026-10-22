# Task: builders map research for one region

Start a cloud session in the environment **finevelo-research** (full network access) with:

> Run tasks/builders-research.md for region **Nord** (or West / Süd / Ost)

| Region | Federal states | Data file (the only file to edit) | Target total | Extra focus |
|---|---|---|---|---|
| Nord | Schleswig-Holstein (DE-SH), Hamburg (DE-HH), Bremen (DE-HB), Niedersachsen (DE-NI), Mecklenburg-Vorpommern (DE-MV) | `src/data/builders/de-nord.json` | 60–100 | Hamburg, Bremen, Hannover, Kiel, Lübeck, Braunschweig, Osnabrück, Oldenburg, Rostock |
| West | Nordrhein-Westfalen (DE-NW), Rheinland-Pfalz (DE-RP), Saarland (DE-SL), Hessen (DE-HE) | `src/data/builders/de-west.json` | 80–120 | Köln, Düsseldorf, Ruhr area, Bonn, Münster, Aachen, Frankfurt, Wiesbaden, Darmstadt, Kassel, Mainz, Koblenz, Trier, Saarbrücken |
| Süd | Baden-Württemberg (DE-BW), Bayern (DE-BY) | `src/data/builders/de-sued.json` | 100–140 | München, Nürnberg, Augsburg, Regensburg, Rosenheim, Garmisch, Stuttgart, Karlsruhe, Freiburg, Mannheim, Heidelberg, Ulm, Konstanz, Tübingen; frame builders in Stuttgart/Karlsruhe were a gap |
| Ost | Berlin (DE-BE), Brandenburg (DE-BB), Sachsen (DE-SN), Sachsen-Anhalt (DE-ST), Thüringen (DE-TH) | `src/data/builders/de-ost.json` | 60–90 | Berlin (thoroughly), Potsdam, Dresden, Leipzig, Chemnitz, Magdeburg, Halle, Erfurt, Jena. Open follow-ups: Cicli Berlinetta, Light Wolf Studio, Im Windschatten, Il Diavolo |

Work on a new branch and open a PR against main. Do not push to main and do not deploy. Keep the existing entries in your file.

## Only edit your region file
Three other sessions work on the other regions in parallel. Do NOT edit any other data file, the schema or the pages. If the schema needs a change, describe it in the PR.

## Read first
- `src/content.config.ts`: the `builders` schema (fields, enums, refinements)
- your region file: existing entries show the style and quality bar
- `src/pages/builders/index.astro`: the inclusion criteria text

## Two tiers
- `tier: "selection"` (Finevelo Selection, full entry)
  - `type: "builder"`: designs and makes frames or bikes in Germany (custom geometry or small batch).
  - `type: "shop"`: a physical store with a documented custom-build or professional fitting service, AND an authorised dealer of at least one top-tier brand.
- `tier: "dealer"` (High-end dealer, shorter entry; `type` must be `"shop"`): a physical store that meets at least one of these:
  - It is an authorised dealer of at least one top-tier brand:
    - Road and gravel: Pinarello, Colnago, Factor, Cervélo, Specialized flagship/S-Works dealers, Trek Project One, BMC, Scott premium, Wilier, De Rosa, Look, Time, Storck, Lightweight, Moots, Mosaic, Open, 3T, Ridley
    - MTB: Santa Cruz, Yeti, Pivot
    - Direct-sales brands such as Canyon or Rose do not count.
  - It offers fitting with a certified system (Retül, GURU, IDmatch, Bikefitting.com/Smartfit, Specialized Body Geometry Fit).

  Put the brands in `brands` and the fitting systems in `fittingSystems`.
- Not listed in either tier: large multi-brand superstore chains (e.g. Fahrrad XXL, Zweirad Stadler), even if they carry top-tier brands.

## How to research
- **Where to look:**
  - brand dealer locators (Pinarello, Colnago, Factor, Cervélo, the Specialized store finder, Trek Project One retailers, BMC, Scott, Wilier, Look, Storck, Lightweight, Santa Cruz, Yeti …)
  - fitting-system finders (Retül, GURU, IDmatch)
  - each shop's own website
- **Address, postal code, website:** only as published by the business itself on its Impressum or contact page. Put that page's URL in `address.source`. If only a directory lists the address, set street and postalCode to null.
- **Coordinates:**
  - If you can geocode the address reliably, use address-level coordinates and set `precision: "address"`. OpenStreetMap Nominatim is fine: at most 1 request per second, with a User-Agent.
  - Otherwise use the city centre with `precision: "city"`.
  - Points must lie inside Germany; the schema checks this.
- **Every entry:**
  - at least 1 source URL (dealer locator and/or the shop's own website)
  - `checked`: today's date
  - `summary`: at most 400 characters, sober English, no marketing language
  - unknown values: null or an empty array
  - `uncertain`: anything you could not verify
- **Data protection:** no data about private persons, no personal phone numbers, no ratings or reviews.
- **Only active businesses:** the website is live, or the shop appears in a current dealer locator.

## Ids
Ids must be unique across ALL region files. Use a slug of the name; if it could clash, add the city (e.g. `bikestore-xyz-koeln`). Check `src/data/builders/*.json` before adding.

## Done when
- `npm ci && npm run build` passes. The build validates every entry and fails on duplicate ids.
- The PR description includes:
  - counts per federal state and per tier/type
  - the dealer locators used
  - excluded entries and why
  - open uncertainties
