---
# Template for the Writer agent. Save as src/content/articles/<brand>-<model>-<year>.md
title: "<Headline, sober, no hype>"
seoTitle: "<Brand Model Year: price, weight, specs>"   # max 60 characters
description: "<Meta description with price and weight>"     # max 170 characters
dek: "<One-sentence standfirst>"
pubDate: 2026-01-01T09:00:00+01:00     # respect embargo times from the source
category: road                          # road | gravel | mtb | e-bike | components | custom
format: launch-brief                    # launch-brief | the-edit | deep-dive | pro-bike-check
author: editorial
bike: <brand>/<model>                   # id in src/data/bikes.json (add the bike there first)
hero:
  src: /images/<file>.webp              # 1200x675 WebP, optional
  alt: "<Model name> in side profile"
  credit: "Photo: <Manufacturer>"
specs:
  price: "$0,000 / €0,000"              # "TBC" if not confirmed by the source
  weight: "0.0 kg (claimed, size)"
  groupset: "<Groupset>"
  availability: "<Available now / from Month>"
  url: "https://<manufacturer>"
source:
  name: "<Manufacturer press release>"
  url: "https://<source>"
tags: []
faq:
  - q: "How much does the <Model> cost?"
    a: "<Answer with price>"
---

<Price and weight in the first paragraph.>

## How much does it cost?

## What's new vs. the previous generation?

| | <New> | <Previous> |
|---|---|---|
| Price | | |
| Weight | | |

## Where it sits in the segment
