# XC MTB fact-check (section 2 of research/2026-10-18.md), 2026-10-18

## READ FIRST: nothing on this sheet is confirmed against an original page

No page could be opened in this session. Every WebFetch failed with DNS errors (pinkbike.com, bike-magazin.de, blisterreview.com, specialized.com, bikeradar.com, velomotion.net), and curl through the proxy got `403 connect_rejected` for every host, including example.com. The environment's network policy blocks outbound page access. Only WebSearch worked, and it returns search-engine summaries, which are the same kind of source the original ⚠ figures came from.

What that means for each status below:
- **No figure is marked "confirmed (page X)".** None could honestly be.
- **unconfirmed – corroborated** means two or more independent search summaries agree, naming the outlet whose page they summarise. This is likely right, but it still needs someone to open the page before it goes to print.
- **unconfirmed – conflict** means the summaries disagree. Both values are given.
- **likely wrong** means the summaries consistently contradict the note. The old value and the probable correction are both given, and the correction is still unconfirmed.
- **unconfirmed – n/f** means nothing relevant was found.

Fix: allow the hosts above in the environment's network settings (Network access, then Allowed domains or a broader level) and re-run this check.

---

## 1. Specialized S-Works Epic 9 (priority)

### Launch
| Item | Note said | Finding | Status |
|---|---|---|---|
| Launch date | late Apr 2026 | One summary gives **28 April 2026**. Singletrack World and Velomotion URLs are dated 2026/04. | unconfirmed – corroborated for April. The 28 April day comes from a single summary that doesn't name its outlet. |
| Model year | – | Retail/Specialized listings call it the **2027** S-Works Epic 9 | unconfirmed – corroborated |
| Range replaced | Epic 8 | One summary says it replaces the Epic 8, Epic EVO and Epic World Cup | unconfirmed (single summary, outlet not named) |

### S-Works build spec (summaries of Specialized US page and retailers)
| Item | Note said | Finding | Status |
|---|---|---|---|
| Drivetrain | "XX (T-Type ⚠ or XX SL)" | **SRAM XX SL Eagle Transmission**, Quarq XX SL power-meter crank, 34T, CeramicSpeed BB | unconfirmed – corroborated (Specialized + retailer summaries). Resolves the ⚠ in favour of XX SL. |
| Suspension | SID/SIDLuxe Ultimate FA | **RockShox SID Ultimate Flight Attendant / SIDLuxe Ultimate Flight Attendant**, 120 mm | unconfirmed – corroborated |
| Wheels | Roval Control World Cup | **Roval Control World Cup** front and rear, 28.5 mm inner width | unconfirmed – corroborated |
| Tyres | – | Conflict. Retailers list **Specialized Fast Trak**, Specialized's page lists **Air Trak**, NOBL bike check shows Fast Trak front / Air Trak rear. All 29x2.35, Flex Lite casing, T5/T7. | unconfirmed – conflict |
| Cockpit | – | Roval Control II integrated (2027 listing) | unconfirmed |
| Tyre clearance | – | **29 x 2.4"** (S-Works frameset listing). Pinkbike says rear clearance "significantly increased", with no mm figure. | unconfirmed (single retail-listing summary) |

### Prices
| Build | Note said | Finding | Status |
|---|---|---|---|
| S-Works Epic 9 | $15,249.99 / €14,499 ⚠ (BIKE: €14,999) | **US $15,249.99** (Specialized/Bikerumor/Contender), **€14,499** (Pinkbike + Velomotion summaries), AUD 22,500 (Pinkbike) | unconfirmed – corroborated. €14,499 is backed by two outlets. No summary showed BIKE quoting €14,999, so treat €14,999 as unsupported. |
| S-Works Epic 9 £ | – | **£12,499** (single summary, "full builds … up to £12,499 for the S-Works") | unconfirmed (single summary) |
| S-Works Epic 9 Ultralight LTD | (not separated in note) | **US $14,499.99–$14,500 / €13,999** (Pinkbike, Velomotion, Specialized US). Singletrack World reportedly said $15,250, which probably confuses it with the S-Works price. | unconfirmed – corroborated. Note the UL LTD is *cheaper* than the standard S-Works. |
| S-Works Epic 9 LTD "Built for Legends" | – | **€15,500**, limited to **119** units (BIKE headline). A Specialized listing summary gives 9.66 kg. | unconfirmed – corroborated (BIKE headline in search results) |
| S-Works frameset | – | **£5,999** (Specialized UK + Specialized Concept Store) | unconfirmed – corroborated. No USD/EUR found. |
| Pro | – | **US $11,999.99 (Pinkbike $12,000) / €9,499** / AUD 15,500 | unconfirmed – corroborated |
| Expert | – | **US $7,499.99 (Pinkbike $7,500) / €6,999** / AUD 11,000 | unconfirmed – corroborated |
| Comp | – | **US $5,699.99**, added after launch (Singletracks) | unconfirmed (single summary). Not part of the April launch range. |
| Sport | – | **US $4,699.99**, added after launch (Singletracks) | unconfirmed (single summary) |
| UK entry price | – | "from £4,299" (single summary) | unconfirmed |

### Weights
| Item | Note said | Finding | Status |
|---|---|---|---|
| Frame | 1,589 g (M) incl. shock & hardware | **1,589 g, size M, incl. shock, seat collar, axle, hardware** (Velomotion, Specialized UK, Contender, Pinkbike) | unconfirmed – corroborated (strong) |
| Saving vs Epic 8 | "frame 206 g lighter" | **Likely wrong as worded.** The per-part frame savings (front triangle −110, rear triangle −37, seat tube −17, pivot −15) add up to **−179 g**, and one summary says "179 g lighter than the Epic 8". Bikerumor's "**206 g**" is for the "total system" (frame + suspension/hardware). | likely wrong: "frame 206 g" → frame −179 g / system −206 g. Unconfirmed. |
| UL LTD complete (claimed) | 8.66 kg | Conflict. **8.66 kg** (Velomotion "from 8.66 kg, M"; Flow says incl. dropper), **8.56 kg** (Specialized US page summary, 18 lb 14 oz), **~8.5 kg** (Singletrack, road.cc, BikeRadar-type headlines). BIKE headline says "from 8.3 kg" and its text "from 8.39 kg". | unconfirmed – conflict. Publish "around 8.5 kg claimed" only after checking specialized.com. |
| S-Works complete measured | 10.1 kg XL (Pinkbike) | **22.3 lb / 10.1 kg, XL S-Works** (Pinkbike summary). Bike Mag's XL S-Works was 26 lb *with pedals*. | unconfirmed – corroborated for the Pinkbike figure (one outlet, two summaries) |
| Pro claimed | – | 22.9 lb / 10.4 kg (Pinkbike) | unconfirmed |
| Expert claimed | – | 24.1 lb / 10.9 kg (Pinkbike) | unconfirmed |

### Travel and geometry
| Item | Note said | Finding | Status |
|---|---|---|---|
| Travel | 120/120 | 120/120 | unconfirmed – corroborated |
| Head angle | – | **65.9° low / 66.3° high** (flip chip; BikeRadar, retailer geo table) | unconfirmed – corroborated |
| Seat angle | – | **76°** all sizes (official geo-table summary). Pinkbike says it is "+0.5° in low mode" vs Epic 8, which may just be a relative statement. | unconfirmed – conflict/unclear |
| Reach | – | **M 450 mm** low, S 420 mm (BikeRadar, which says it's similar to Epic 8). Singletracks says M reach is 17 mm longer and HA 0.9° steeper than Epic 8. | unconfirmed – conflict on the Epic 8 comparison. The 450 mm M figure itself has a single source. |
| Chainstay | – | 435 mm S/M, 438 L, 442 XL | unconfirmed |

### Key changes vs Epic 8
| Item | Note / brief | Finding | Status |
|---|---|---|---|
| Brain dropped | "Brain dropped?" | **Wrong as an Epic 9 change.** Brain was already dropped on the **Epic 8** (2024), the first Epic without Brain since 2002. Both use Flight Attendant on S-Works. | likely wrong (as an Epic 9 change). I'm confident of this from coverage of the 2024 Epic 8, but it is unconfirmed on a page this session. |
| Suspension layout / flex stays | – | Epic 8 used FSR-derived layout with one-piece rear triangle and **flex stays**. Bikerumor describes the Epic 9 with an "updated swing link" shock setup and claims **11% less suspension friction**. Whether Epic 9 keeps flex stays is **unclear**: one summary lists flex stays among features, another implies a different design. | unconfirmed – conflict |
| Storage | – | Conflict. Internal SWAT storage removed, external "SWAT Box" offered (Velomotion, Bikerumor). | unconfirmed |
| Mudflap | – | Integrated mudflap at chainstay/seat-tube junction (Pinkbike) | unconfirmed |
| Claim | – | Specialized calls it the "lightest production full-suspension XC frame/bike"; frame 129 g lighter than closest competitor | unconfirmed (manufacturer claim via summaries) |

### Review verdicts (paraphrased from search summaries. Must be checked against the articles before quoting.)
- **Pinkbike (First Ride):** headline frames it as "unapologetically race-focused". I couldn't get the body verdict.
- **Bikerumor:** an excellent successor to the Epic 8 in almost every respect. Price is the only real drawback.
- **Singletracks:** more race-focused than previous short-travel Epics but slightly plusher than the Epic 8. It reaches its limits on steep descents.
- **BIKE (Epic 9 Expert test):** the Expert is the pick of the range, a world-class XC bike at a mid-range price.
- Blister is only a First Look with no verdict. No Escape Collective, BikeRadar review or Vital MTB verdict was found.

### 2026 race results on the Epic 9
| Claim | Finding | Status |
|---|---|---|
| Frei won XCO + XCC at YongPyong | **Confirmed in summaries:** XCO (first elite WC win, +26 s, mud) and the Friday XCC (Pinkbike results, Brujula) | unconfirmed – corroborated |
| Frei won XCO + XCC at Les Gets | **XCO win** (about 2 s ahead of Rissveds). In the **XCC she was 2nd** (20:38) per the Pinkbike results summary, though one Pinkbike write-up reportedly calls it a "second perfect weekend". | likely wrong for XCC: "won XCC" → 2nd. Unconfirmed, conflict. |
| Frei won XCO at Lake Placid | **Yes**, sprint win over Martina Berta (both 1:25:59), Samara Maxwell 3rd. Frei also took the **XCC overall** title. Rissveds won the **XCO overall** (11th on the day). Men: Charlie Aldridge won the Lake Placid XCO, Luca Martin won the men's XCO overall. | unconfirmed – corroborated (Brujula, todomountainbike) |
| Bike | Frei rode a custom European-champion-paint **S-Works Epic 9** at Les Gets (Brujula). She is on Specialized all season. | unconfirmed – corroborated |
| 2026 Worlds XCO (Val di Sole) | **Women:** Sina Frei (SUI) 1:27:50, Martina Berta (ITA) +1:07, Nicole Koller (SUI). Date reported as **30 August 2026**. Frei also took XCC bronze and was European XCO + XCC champion. **Men:** Tom Pidcock (GBR) 1:25:26, Charlie Aldridge (GBR) +0:17, Cole Punchard (CAN) +0:31. Van der Poel 30th. (Pinkbike, Cyclingnews, UCI, Escape Collective, FloBikes summaries) | unconfirmed – corroborated. Frei's Worlds win **on an Epic 9** is very likely (Specialized team rider) but no summary states it explicitly. Pidcock does not ride Specialized. |
| Blevins 2025 overall | **Christopher Blevins won both the 2025 XCO and XCC World Cup overalls** (XCO 1,996 pts vs Vidaurre 1,695, Martin 1,546; won the first five XCC rounds, reportedly six in total) for Specialized Factory Racing (UCI, UCI MTB World Series). | unconfirmed – corroborated. "On the Epic 8" fits the timing (Pinkbike 2025 Lake Placid Epic 8 bike check in the original sources), but this session's summaries didn't state it. |

### Epic 8 (for comparison)
| Item | Note said | Finding | Status |
|---|---|---|---|
| Launch | Mar 2024 ⚠ | Released **12 March 2024** (one listing summary). Vital lists it as a 2024 model. | unconfirmed – corroborated for March 2024 |
| S-Works price | $14,499.99 / €14,500 / £12,000 | **$14,500** (Vital, Singletracks), **£12,000** (MBR) | unconfirmed – corroborated for USD/GBP. No € found. |
| S-Works weight | 10.24 kg (M) claimed | **10,240 g / 22 lb 9.2 oz** (Vital product guide). 99spokes says 10.2 kg. Vital doesn't say whether it's claimed or measured, or the size. | unconfirmed. The figure matches, but "claimed, M" isn't verified. |
| Frame | ~1.81 kg incl. shock | Not found. The Epic 9 per-part savings (−179 g) imply ~1,768 g for Epic 8 on the same basis, which is **not** 1.81 kg. | unconfirmed – n/f (the 1.81 kg doubtful) |

---

## 2. Other rows

| Model | Field | Note said | Finding | Status |
|---|---|---|---|---|
| **Santa Cruz Blur 5** | Launch | ~Aug 2026 ⚠ | Radavist launch article image path dated Aug 2026; Tweed Valley "pre-order". Model year 2027 ("Blur 5 CC … 2027"). | unconfirmed – corroborated (Aug 2026) |
| | Travel | 120/120 | 120/120 (Blister First Look) | unconfirmed |
| | Price | $13,399 | Range **$4,899–$13,399** (Blister, Pinkbike). One Canadian Cycling Magazine summary says $17,799 for XX AXS Race FA RSV, which is probably CAD or a different gen. | unconfirmed – conflict. $13,399 is the US top price per two outlets, but the build it belongs to isn't verified. |
| | Weight | n/f | Blister: Blur XTR RSV complete **11.43 kg**. A retailer gives 11.27 kg for the earlier XX AXS TR RSV (may be previous gen). | unconfirmed |
| | Frame | 1.98 kg (M) ⚠ | 1.98 kg claimed appears in a summary of the *2026 Blur Mk4/BikeRadar* coverage. It may belong to the previous gen. | unconfirmed – may be the wrong generation |
| | Head angle | – | 66° (Blister) | unconfirmed |
| | Escape Collective take | – | "chooses user-friendliness over all-out race performance" (headline) | unconfirmed |
| **Scott Spark RC SL MY27** | Launch | Jun 2026 | No date found in summaries | unconfirmed – n/f |
| | Price | $14,999.99 / €12,999 ⚠ / £12,799 | **$14,999.99** (Contender), $15,000/€13,000 (Bikerumor), **€12,999** (Pinkbike, "provisional"), €13,699 (Brujula), **£12,799** (Wheelbase), AUD 16,500 (Flow) | unconfirmed – EUR conflict (€12,999 / €13,000 / €13,699) |
| | Weight | 9.9 kg | **9.9 kg / 21.83 lb is Pinkbike's claimed *starting* range weight**, not necessarily the SL. Brujula measured a World Cup EVO test bike at 10.86 kg (no pedals). | likely mis-labelled: 9.9 kg is the range "from" weight. Unconfirmed. |
| | Frame | 1,427 g HMX-SL (M) w/o shock | **1,427 g HMX-SL** (HMX 1,570 g, HMF 1,793 g); **1,776 g with SIDLuxe FA shock**; ~200 g lighter than predecessor (Pinkbike). R2-Bike says 1,427 g is size S. | unconfirmed – corroborated (size M vs S conflict) |
| | Frameset | – | MSRP €7,999 (R2-Bike) | unconfirmed |
| **Cannondale Scalpel LAB71** | Launch | 2024 | LAB71 full-sus line exists from MY2023 (Scalpel SE LAB71 2023). Current Scalpel gen reviewed by Blister as 2024. | unconfirmed |
| | Price | $14,000 (2024 launch) | $14,000 is the MSRP of the **2023 Scalpel SE LAB71** (Bicycle Blue Book). The 2025 Scalpel LAB71 Team is $14,699 (99spokes). €11,999 (one review). | likely mis-attributed: $14,000 → Scalpel SE LAB71 2023. Current Scalpel LAB71 Team ~$14,699. Unconfirmed. |
| | Weight | 10.4 kg | not found | unconfirmed – n/f |
| | Frame | 1,780 g w/o shock | not found ("Cannondale does not specify frame weight", per one summary) | unconfirmed – n/f |
| **BMC Fourstroke R 01 ONE** | Name | "Fourstroke 01" | Current top model is **Fourstroke R 01 ONE** (MY26, also a MY27 entry) | unconfirmed – corroborated |
| | Price | $14,599 (BMC) vs $13,499 (Vital) ⚠ | BMC store summaries: **USD 12,999 / EUR 12,999**. A retailer had it at $13,499 (now $9,500 on sale). | likely wrong: $14,599 → $12,999 / €12,999 (BMC site, per summary). Unconfirmed. |
| | Suspension | Öhlins RXC34 / TXC2 | **Öhlins RXC34 Carbon / TXC2 Air** | unconfirmed – corroborated |
| | Weight, frameset, launch | 11.0 kg; 3,125 g; n/f | not found | unconfirmed – n/f |
| **Trek Supercaliber SLR 9.9 XX AXS Gen 2** | Launch | 2023/24 | Gen 2 reviewed 2023 (Bike Perfect Aug 2023, BikeRadar Dec 2023). MY2024 is a carry-over. | unconfirmed – corroborated (2023) |
| | Travel | 110/80 | 110 mm SID Ultimate / 80 mm IsoStrut | unconfirmed – corroborated |
| | Price | $11,699 launch; £10,800 | **€11,499** (bike-test, BIKE). No USD or GBP found. | unconfirmed (USD/GBP n/f) |
| | Weight | 9.45 kg claimed; 9.62 kg measured (BikeRadar) | **9.45 kg** (bike-test). BIKE says 9.0 kg. BikeRadar measured weight not found. | unconfirmed – conflict |
| | Frameset | 1.95 kg | not found | unconfirmed – n/f |
| **Orbea Oiz M-LTD (2026)** | Launch | Jun 2026 | No date in summaries ("available at dealers now", BikeRadar 2026 Oiz) | unconfirmed – n/f |
| | Price | $12,127 / €10,499 / £9,999 | **£9,999 / $12,127** (BikeRadar). EUR conflict: **€10,999** (BikeRadar, BIKE) vs €10,499 (Brujula). | likely wrong EUR: €10,499 → €10,999 (two outlets). Unconfirmed. |
| | Spec | XX SL AXS, Oquo MP30LTD | XX SL, Fox Factory, Oquo MP30LTD, OMX frame | unconfirmed – corroborated |
| | Weight | ~9.63 kg | not found | unconfirmed – n/f |
| | Frame | 1,480 g w/o shock (M) | **~1,700 g incl. shock** (Orbea claim via BikeRadar and BIKE). 1,740 g per one retailer. | likely wrong: 1,480 g w/o shock is unsupported. Orbea's claim is ~1,700 g incl. shock. Unconfirmed. |
| **Yeti ASR T5 Ultimate XX SL** | Launch | Mar 2024 | **March 2024** (GearJunkie) | unconfirmed – corroborated |
| | Travel | 120/115 | 120/115 (Vital) | unconfirmed – corroborated |
| | Price | $14,300 (2026) | **$13,900 at 2024 launch**. **$14,300 for MY2026** (Bicycle Blue Book). £13,999 (Wheelbase, MY2025). | unconfirmed – corroborated |
| | Weight / frame | 10.48 kg; 1,448 g | not found | unconfirmed – n/f |

## Official URLs (taken from search results, not opened)
- S-Works Epic 9: https://www.specialized.com/us/en/s-works-epic-9/p/4274030
- S-Works Epic 9 Ultralight LTD: https://www.specialized.com/us/en/s-works-epic-9-ultralight-ltd/p/4291037
- S-Works Epic 9 LTD Built for Legends: https://www.specialized.com/us/en/s-works-epic-9-ltd-built-for-legends/p/4296348
- S-Works Epic 9 frameset (UK): https://www.specialized.com/gb/en/s-works-epic-9-frameset/p/4274035
- Epic 9 Pro: https://www.specialized.com/us/en/epic-9-pro/p/4274031
- Epic 9 Expert: https://www.specialized.com/us/en/epic-9-expert/p/4274033
- BMC Fourstroke R 01 ONE: https://at.bmc-switzerland.com/products/fourstroke-r-01-one-bikes-bmc-26a-000044
- Santa Cruz: https://www.santacruzbicycles.com (no Blur 5 product URL found)
- Scott, Cannondale, Trek, Orbea, Yeti: no official product URL surfaced

## Key secondary URLs to open once access works
- Pinkbike Epic 9: https://www.pinkbike.com/news/first-ride-specialized-epic-9-unapologetically-race-focused.html
- BikeRadar Epic 9: https://www.bikeradar.com/news/2026-specialized-epic-9
- Velomotion Epic 9: https://velomotion.net/2026/04/specialized-epic-9/
- Bikerumor Epic 9: https://bikerumor.com/specializeds-new-epic-9-might-be-the-only-epic-you-need/
- Singletracks Epic 9 Comp/Sport: https://www.singletracks.com/mtb-gear/a-26-5lb-specialized-epic-9-mtb-now-costs-less-than-5k-with-launch-of-more-affordable-builds/
- BIKE Epic 9 LTD €15,500: https://www.bike-magazin.de/en/bicycles/mountain-bike/cross-country-bikes/the-specialized-epic-9-priced-at-15-500-euros-what-s-the-story-behind-this-limited-edition-race-full-suspension-bike/
- Les Gets XCC results: https://www.pinkbike.com/news/results-2026-les-gets-xcc-short-track-world-cup.html
- YongPyong XCC: https://www.pinkbike.com/news/xcc-results-south-korea-xc-world-cup.html
- Lake Placid: https://en.brujulabike.com/sina-frei-wins-by-millimeters-in-lake-placid-and-jenny-rissveds-takes-the-xco-world-cup/
- Worlds 2026: https://www.pinkbike.com/news/results-2026-val-di-sole-elite-xc-world-championships.html ; https://www.cyclingnews.com/pro-cycling/womens-cycling/uci-mountain-bike-world-championships-sina-frei-takes-solo-win-to-claim-elite-womens-olympic-cross-country-world-title/
- Frei Epic 9 (Les Gets paint): https://en.brujulabike.com/the-s-works-epic-9-of-sina-frei-is-dressed-as-the-european-champion-for-les-gets/
- Blevins 2025: https://www.uci.org/article/2025-whoop-uci-mountain-bike-world-series-overall-winners-crowned-in-america/45gOxmbNuXW3XdFKEtZMwR
- Epic 8 (MBR £12,000): https://www.mbr.co.uk/news/specialized-launches-the-epic-8-an-xc-bike-with-rockshox-flight-attendant-and-an-theres-an-evo-version-with-down-country-aspirations-too-436796
- Scott Spark RC (Pinkbike): https://www.pinkbike.com/news/first-ride-scott-spark-rc-not-your-grandads-xc-bike.html
- Orbea Oiz (BikeRadar): https://www.bikeradar.com/news/2026-orbea-oiz
- Blur 5 (Blister): https://blisterreview.com/gear-reviews/santa-cruz-blur-5
- Yeti ASR (GearJunkie): https://gearjunkie.com/?p=512253
