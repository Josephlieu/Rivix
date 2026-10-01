# 19 — The example tech file Joseph sent (Ontario Parks uniform tender, Attachment 6)

Received 2026-10-01 (placed in the project root; the name on disk is `Attachment6-OPTechPackages-PMU-UniformSupplyManagement-2026_to_be_Schedule8 (1)_1.pdf`). **Not committed** (64 MB; keep out of git). Read by extracting the text of all 723 pages. **I read about 20 pages closely** (cover, contents, notes, and all 14 pages of one garment, men's cargo pants) **and checked the rest by script** (section headings per garment, page counts, keyword counts). **I did not look at the images** (sketches, photos, label artwork) — the PDF renderer isn't installed here — so everything below is from the text only.

## What it is
- A **Government of Ontario tender attachment**: *Ontario Parks Technical Packages — Attachment 6 (to be Schedule 8 to the Agreement) — Ontario Parks Uniform Supply and Management — Uniform Piece Technical Packages (57 Total).* (The group counts I first listed — Accessories 7, Bottoms 7, Tops 22+, Outerwear 13+ — came from the contents page and were not individually verified.) The tender number is still a placeholder (`Tender_#####`) and the wording says "to be Schedule 8", so this is a **draft/pre-tender** document.
- **723 pages, 64 MB, ~678,000 characters of text** (roughly 170k tokens). **57 garments** in 3 groups: Accessories (7), Bottoms (7), Tops (22+), Outerwear (13+) — belts, caps, toque, cargo pants/shorts/skirt, polos, tees, hi-vis tops, quarter-zip sweaters, park-warden shirts, 3-in-1 jackets, coveralls, rain gear, hi-vis vest, soft shells, winter parka. Each has Men / Women / Unisex and Maternity variants.
- It is **both** the kind of **RFP attachment** Joseph wants to upload *and* the kind of **tech pack** the AI should be able to draft. So it answers his "the example tech file we already sent you" and the earlier "sample tech pack files still outstanding" item.
- It is the **buyer's** specification (Ontario Parks), not a RIVIX-format tech pack. The main RFP document (terms, closing date, evaluation, registrations) is **not** included — only this attachment.

## Structure of one garment's tech pack
Read in full on Cargo Pants (men), `OP-M-CARPAN`, pages 67–80, then **checked across the whole file by script** (2026-10-01): the layout below holds for nearly all garments. **Verified numbers:** 56 garment sections found (the cover says 57 — one is unaccounted for, probably merged or mis-tagged; not resolved); 7 to 26 pages per garment, **median 13** (45 of 56 are 12–15 pages). **Exceptions:** the 7 accessories (belts, panel, caps, hat, toque) have **no measurement spec (POM)** and the 2 belts also have **no testing section**; 1 Park Warden style has **no BOM**; the women's cargo skirt runs 26 pages. The sketches, photos and label artwork were never looked at. Layout:
1. **Cover / preview** — style number, name, category, gender, size range, base size, date created, front/back sketches.
2. **Colour & fabric information** — Pantone references, fabric standard, reference image; global colour-approval rules (D65 light booth, ΔE ≤ 1.2, spectrophotometer, L/a/b tolerances).
3. **Product details** — annotated callouts (pockets, closures, bartacks, hem allowance, grip tape, gusset, knee articulation…), plus zoomed detail pages.
4. **Call-out details** — legend for stitch types and construction highlights.
5. **Construction details** — seam types, thread (polyester, 10 SPI), seam allowances, finishing, remarks.
6. **BOM** — fabrics, trims, labels: item, quantity, colour/finish, placement and remarks.
7. **Artwork detail** — logo size/placement (e.g. 1.75" × 1.75" silicone heat transfer, 1 mm).
8. **Measurement diagram + POM spec sheet** — ~39 points of measure, tolerance per point, values per size (XS–2XL), taken flat on the half in inches.
9. **Testing details** — mandatory test list with standards (CGSB, ISO, AATCC, ASTM, CSA Z96), requirements, sample conditioning, test frequency, laundering protocol (25 home washes at 60 °C), labelling.
10. **Label spec** — care label size/placement/fonts, **bilingual English/French** care text, composition, **MADE IN CANADA**.
11. **Packaging** — polybag sizes, bilingual suffocation warning, fold, peel-off strip.

## What it shows about real tenders (useful for the AI screening feature)
*Keyword counts below are plain text searches across the whole file, so they are rough (repeated test tables inflate them), not exact counts of separate requirements.*
Joseph's red-flag list matches this document closely:
- **Canadian-made / geographic:** "MADE IN CANADA" appears ~58 times; bilingual EN/FR labelling (~112 mentions).
- **Certifications / testing:** CGSB standards (~762 mentions), CSA Z96-22 hi-vis classes (~115), ISO (~396), AATCC (~442); a mandatory-test battery per style, one full battery per lot/colour/fabric batch, 25-wash laundering protocol.
- **Colour control:** Pantone TCX references (peacoat, safari, blaze orange, silver…) with ΔE ≤ 1.2 under a calibrated booth — a real cost/capability filter for factories.
- **Sizing:** bottoms XS–2XL, accessories S–XL; **all tops must also be producible in tall sizes**; maternity variants. (Relevant to the rep's size grid: the standard XS–4XL plus custom rows covers it, but "tall" and maternity could become first-class options — ask Joseph.)
- **Draft-state risks:** full-resolution packages only provided *at award*; images and textures here are low-resolution; tender number and schedule numbers are placeholders (the text even says Schedule 4 and Schedule 8 in different places).

## What this means for the AI draft tech file
- The target is an **11-section document** (cover, colour/fabric, product details, call-outs, construction, BOM, artwork, measurements, testing, labels, packaging; simple accessories skip some), much richer than what the app produces now. The current `src/lib/TechPackPDF.tsx` outputs a style overview, fabric analysis, colourway and a few notes with an "AI confidence" figure — **no measurement table with tolerances, no BOM, no construction spec, no testing section, no labels/packaging.**
- The sections an AI can realistically **draft from written specs**: cover info, fabric/colour (from named fabrics and Pantones), BOM, construction and care/label text, packaging, testing list (by garment class and the standards named in the tender). The hard parts are **sketches/callout drawings** and a **trustworthy measurement table**: an AI can propose measurements but they must be checked by a person. Plan for admin review (already required by Joseph) and treat the output as a **draft**, not a finished tech pack.
- Using this file as the example means we can structure the output to match, and use a few of its garments as concrete samples.


## Full visual review (started 2026-10-01) — status and findings so far
**Method.** The first pass above was text-only plus about 20 pages read closely. The user asked for a review of **all** pages, so every page (723) was rendered to an image (macOS PDF library through a small Swift script — nothing installed; the pages are rotated, which broke the first render and was fixed) and split among **8 reviewers**, each viewing every page in its range and cross-checking small text against the extracted text. Per-range notes are kept in [techpack-review/](./techpack-review/). A reviewer's word is not verified by me line by line; the notes say what they could not read.

| Pages | Covers | Status |
|---|---|---|
| 1–66 | front matter + 7 accessories | **done** — [techpack-review/pages-001-066.md](./techpack-review/pages-001-066.md) |
| 67–723 | bottoms, tops, outerwear (about 49 garments) | **NOT reviewed visually — stopped.** Seven reviewers started, were stopped by the user on cost grounds, and all seven then ended on the account's spend limit (resets 4 pm India time). **No usable notes were saved for these pages.** Only the first text-based pass (the cargo-pants garment read in full, plus the whole-file script checks above) covers them. |

**New things the images showed that the text did not:** the tech packs were produced by **Shift Fashion Group** for Ontario Parks (logo on every page); each cover states style no., size range, **base size** (e.g. L for the cargo pants) and gender; the garments are flat technical sketches with front / front-2 / back views.

**Findings from pages 1–66 (front matter + 7 accessories)** — the document is **not clean**, which matters for any AI that learns from it:
- Contents lists 57 garments; section dividers match (Bottoms p66). Global notes: all tops must also be producible in **tall** sizes; some images are low resolution. Pantone table: Peacoat 19-3920, Country Blue 17-3918, Safari 15-1116, Jet Black 19-0303, plus Park Warden patch colours.
- The 7 accessories: men's and women's leather belt (7 pages each), maternity panel (9), OP ball cap (10), ranger hat (10), toque (10), Park Warden cap (9).
- **Missing pages:** both belts have no testing, label or artwork pages (the BOM says "see artwork"); the Park Warden cap has no measurement page; **no garment has a separate call-out legend or construction sketch page** — so the "11-section" layout is an approximation and varies.
- **Errors/copy-paste in the source:** the maternity panel's measurement table is a copied ball-cap table (crown, visor, sweatband) and its label says "100% recycled nylon, hand wash only" though the fabric is cotton/spandex; label size text (6.5 × 3 cm) disagrees with the drawing; fabric compositions on labels are copied from other garments and contradict the BOMs; the ranger hat says snap button on one page and hook-and-loop on another for the brim; every testing page is one identical generic woven-fabric table (even for the knit toque and the waterproof hat) and some test names look shifted against their standards; style numbers differ between pages and the contents.
- **Ranger hat** is the most detailed item: GORE-TEX 2L, taped seams, EVA foam brim, chin cord, waterproof above 20,000 mm — yet no waterproofness test is listed.
- Measurement tables: belts 3 points, caps 6, toque 6, ranger hat 9, tolerances 0.125–0.5.
- **For AI drafting:** headers, BOMs, boilerplate and care text are easy; real measurements, test selection and compliance wording need a human; sketches/artwork need a human or design tool. Lesson: the example is a *flawed* real document — an AI that copies it faithfully would copy its errors, so a **consistency checker** (labels vs BOM, style numbers, size tables vs size range) is a useful feature in its own right.

*Pages 67–723 have **not** had the visual review. Do not rely on this document for those garments beyond the text-based checks. If the full review is wanted later, rerun it more cheaply: one cheaper-model reviewer per garment type, one or two sample garments per type instead of every page, and shorter instructions. The page images can be re-rendered in about a minute.*

## Practical limits this exposes
- **File size:** 64 MB. As far as I know the Supabase free plan caps uploads at 50 MB per file — **verify**; a paid plan or file splitting/compression would be needed for tenders like this.
- **Reading it with AI:** about 170k tokens of text plus images. Screening/summarizing a tender this size needs chunking (per style / per section) and has a real per-tender AI cost. Stated in the estimate as AI usage cost, which is outside the build hours.
- **A tender can contain 57 products.** The supplier-hub design should allow a tender with many line items (a supplier may quote only some of them), not one product per tender.

## Open questions this raises (added to `16-meeting-questions.md` C3)
1. Is this the example he meant, and should the AI-drafted tech file match **this** format (all 11 sections), or a lighter version?
2. Does RIVIX quote on **whole tenders like this (57 styles)** or on selected styles? Can a supplier bid on part of a tender?
3. Does he have the **main RFP** that goes with this attachment (closing date, evaluation, mandatory forms)? Needed to test the screening feature properly.
4. Sizes: are **tall** and **maternity** to be separate options in the order form?
5. File size: tenders this large are expected — okay to plan for storage that allows big files (extra monthly cost)?
