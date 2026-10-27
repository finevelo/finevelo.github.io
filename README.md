# Finevelo

Magazin-Website für High-End-Bike-News: Astro (statisch), Inhalte als Markdown im Repo, gedacht für Cloudflare Pages.

## Starten

```
npm install
npm run dev      # http://localhost:4321
npm run build    # statische Seite in dist/
```

## Vorschau online

Jeder Push auf `main` baut per GitHub Actions (`.github/workflows/pages.yml`) eine versteckte Vorschau unter https://www.finevelo.com/ (Domain bei united-domains, DNS: 4× A auf GitHub Pages, www als CNAME auf finevelo.github.io; MX/SPF von united-domains für E-Mail nicht anfassen). Dort gilt `STAGING=1` (noindex auf allen Seiten, robots.txt sperrt alle Crawler); zum Launch entfernen. `BASE_PATH` wird nur gebraucht, wenn die Seite in einem Unterordner liegt (z. B. `/finevelo`).

## Backend und Agent

- **https://www.finevelo.com/admin/**: eigenes Backend im Finevelo-Design (`src/pages/admin/index.astro`, Code in `src/admin/`). Anmeldung mit einem Fine-grained-Token des GitHub-Kontos `finevelo` (nur dieses Repo; Contents, Secrets, Actions: Read and write). Bereiche: Übersicht, Artikel (Liste, Editor mit Live-Vorschau, Bild-Upload mit Zuschnitt auf 1200×675 WebP, Entwurf/Veröffentlichen/Offline nehmen), Quellen & Firmen (`config/sources.json`), Agent (Zeitplan und Regeln in `config/agent.json`, Claude-API-Schlüssel als verschlüsseltes GitHub-Secret `ANTHROPIC_API_KEY`, Läufe, Jetzt ausführen, Probelauf). Speichern = Commit auf `main` = Neubau der Seite.
- **/admin/cms/** (Sveltia CMS): Reserve für die großen Datentabellen (Bike-Datenbank, Guides).
- **Agent** (`scripts/agent/`, Workflow `.github/workflows/agent.yml`): stündlicher Trigger, läuft nur zu den Zeiten aus `config/agent.json`.
  1. Liest die RSS-Feeds der Magazine nur als **Tipp** (Überschrift + kurzer Teaser). Artikelseiten der Magazine werden nie abgerufen.
  2. Bewertet die Tipps mit Claude nach den High-End-Schwellen.
  3. Sucht per Websuche die **Originalquelle** (Pressemitteilung oder Produktseite des Herstellers); Magazine, Händler und Social Media sind ausgeschlossen.
  4. Ruft diese Seiten selbst ab, nur wenn robots.txt (auch für ClaudeBot/anthropic-ai), Content-Signal, Lizenzhinweise, TDMRep und `noai`-Tags es erlauben (`scripts/agent/fetch.mjs`).
  5. Schreibt aus der Originalquelle in eigenen Worten, ein zweiter Durchgang prüft jede Zahl, ein mechanischer Kopier-Check (`scripts/agent/copycheck.mjs`) verwirft übernommene Wortfolgen.
  6. Speichert **immer als Entwurf**. Veröffentlichen geht nur durch einen Menschen im Backend.
  7. **Nachhol-Modus** (`backfill` in `config/agent.json`): Kommt aus den Neuheiten kein Artikel zustande, schreibt der Agent Hintergrundartikel zu High-End-Produkten aus 2025–2026, erst aus der eigenen Bike-Datenbank (nur Herstellerseiten), dann per Websuche. Vorher prüft er, ob es schon einen Artikel gibt (Bike-Verknüpfung, Quell-URLs, Marke + Modell in Titel, Slug und Tags) und merkt sich erledigte Themen in `config/agent-state.json` unter `topics`.
  Redaktionsregeln: `scripts/agent/prompts.mjs`. Bereits bewertete Meldungen: `config/agent-state.json`.

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/content/articles/*.md` | Artikel (Launch Brief, The Edit, Deep Dive, Pro Bike Check) → `/news/<datei>/` |
| `src/data/bikes.json` | Bike-Datenbank → `/bikes/`, `/bikes/<marke>/<modell>/`, Guides, Hub-Tabellen |
| `src/data/wheels.json` | Komponenten-Datenbank Laufräder (Rennrad, Disc); jede Zeile mit Quellen → Guide „Lightest road disc wheelsets“ |
| `src/data/hubs.json` | Komponenten-Datenbank Naben (Centerlock); jede Zeile mit Quellen → Guide „Lightest Centerlock hub sets“ und Tabelle auf `/components/` |
| `src/data/builders/*.json` | Builders map, eine Datei pro Region (`de-nord`, `de-west`, `de-sued`, `de-ost`). Zwei Stufen: `tier: "selection"` (Rahmenbauer + Custom-Shops) und `tier: "dealer"` (High-End-Händler/zertifizierte Fitter). Länderfähig mit `countryCode`/`regionCode`; jede Zeile mit Quellen, IDs dateiübergreifend eindeutig → `/builders/` und `/builders/<slug>/` |
| `src/data/geo/de-states.json` | Bundesländer-Umrisse (Natural Earth 1:10m, gemeinfrei), einmalig erzeugt mit `scripts/build-geo-de.mjs`; die Karte wird beim Build mit d3-geo als statisches SVG gerendert |
| `src/content/guides/*.md` | Evergreen-Hubs; die Rangliste kommt per `dataset` (`bikes`, `hubs` oder `wheels`) und `filter` automatisch aus der Datenbank |
| `src/data/authors.json` | Redaktions-/Autorenprofile |
| `src/site.config.ts` | Name, Tagline, Rubriken, High-End-Schwellen, Navigation |
| `templates/launch-brief.md` | Vorlage für den Writer-Agenten |

In `bikes.json` darf `launchDate` auch nur Monat (`2026-04`) oder Jahr (`2026`) sein, wenn der genaue Tag nicht belegt ist. Jede Zeile führt ihre Quellen in `sources`; `verified: true` erst, wenn Preis und Gewicht auf diesen Seiten geprüft sind. Guides mit `sample: true` stehen auf noindex und zeigen einen Hinweis.

Das Frontmatter wird beim Build gegen `src/content.config.ts` geprüft (z. B. Title-Tag max. 60 Zeichen). Fehlerhafte Agent-Ausgaben brechen also den Build ab, statt live zu gehen.

## SEO eingebaut

- NewsArticle-, BreadcrumbList- und FAQPage-Schema auf Artikeln, Product-Schema auf Modellseiten, ItemList auf Guides
- `sitemap-index.xml`, `news-sitemap.xml` (nur Artikel der letzten 48 h), `rss.xml`, `robots.txt`
- Canonical, Open Graph, `max-image-preview:large` für Discover
- Bilder fest im 16:9-Format (1200×675), damit nichts springt; Schriften selbst gehostet (keine Google-Fonts-Anfragen)

## Bilder

Nur Fotos mit klarer Lizenz: Wikimedia Commons (CC0, CC BY, CC BY-SA, kein NC/ND), Unsplash oder Pexels, oder Pressebilder mit ausdrücklicher Freigabe für redaktionelle Nutzung. Im Frontmatter immer `credit`, `sourceUrl`, `license` und bei Zuschnitt `changes: "cropped"` angeben, dann erscheint der Nachweis automatisch unter dem Bild. Format: WebP, Hero 1200×675.

| Datei | Quelle | Lizenz |
|---|---|---|
| dogma-f-tour-2025-hero.webp | Eric Salard, Wikimedia Commons | CC BY-SA 4.0 |
| dogma-f-previous-gen-2022.webp | F123, Wikimedia Commons | CC BY-SA 4.0 |
| pinarello-dogma-lbl-2025-hero.webp | Hoebele, Wikimedia Commons | CC BY-SA 4.0 |
| wiebes-s-works-crux-gravel-worlds-2025.webp | Hoebele, Wikimedia Commons | CC BY-SA 4.0 |
| gravel-race-hattem-hero.webp | Martijn Veluwenkamp, Unsplash | Unsplash License |
| tarmac-lipowitz-slovenia-2026-hero.webp | Petar Milošević, Wikimedia Commons | CC BY-SA 4.0 |
| xc-world-cup-la-bresse-2012-hero.webp | Sapin88, Wikimedia Commons | CC BY-SA 3.0 |
| giant-road-e-drop-bar-e-bike-hero.webp | Cjp24, Wikimedia Commons | CC BY-SA 4.0 |
| bora-hansgrohe-roval-wheels-2023-hero.webp | Šimisborec, Wikimedia Commons | CC BY-SA 4.0 |
| titanium-gravel-bike-hero.webp | Jeff Dieffenbach, Wikimedia Commons | CC BY 4.0 |
| van-vleuten-world-champion-paint-hero.webp | KOERS. Museum van de Wielersport, Wikimedia Commons | CC0 1.0 |
| dura-ace-di2-rear-derailleur-hero.webp | KOERS. Museum van de Wielersport, Wikimedia Commons | CC0 1.0 |

## Vor dem Launch

- [x] Beispielartikel ersetzt: alle sechs neu geschrieben bzw. umbenannt, dazu der Schaltgruppen-Vergleich
- [ ] **Neue Artikel verifizieren** (stehen noch auf `sample: true`, noindex): Tarmac SL9 vs Dogma F, S-Works Epic 9, Turbo Creo 2, Flagship-Laufräder, Custom-Titan, Limited Editions, Dura-Ace vs Red vs Super Record. Alle Zahlen stammen bisher nur aus Suchmaschinen-Zusammenfassungen, weil die Quellseiten in der Recherche-Session gesperrt waren. Jede Zahl auf der verlinkten Seite prüfen, dann `sample: false`
- [ ] Guides mit `sample: true` (alle Bike-Guides und Laufräder) nach Prüfung der Daten freischalten
- [ ] Dogma-F-Artikel: Hinweis auf den Tarmac SL9 ergänzen (dort steht noch der SL8 als aktueller Rivale)
- [ ] Bike-Daten prüfen und auf `"verified": true` setzen (sonst bleibt die Modellseite noindex); Quellen stehen in `sources`
- [ ] Impressum und Datenschutz mit echten Angaben füllen
- [ ] Newsletter-Formular (`src/components/NewsletterForm.astro`) mit Beehiiv/Buttondown verbinden
- [ ] Analytics (Plausible/Umami) einbinden
- [ ] Builders map: offene Punkte je Eintrag (`uncertain`) prüfen, fehlende Websites/Adressen aus dem Impressum ergänzen, Koordinaten auf Adressebene (`geo.precision: "address"`) setzen
