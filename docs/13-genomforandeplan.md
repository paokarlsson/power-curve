# Genomförandeplan — från dokumentation till kod

Fellistorna [07](07-fel-power-curve.md)–[10](10-fel-fit-analysis.md) säger *vad* som är fel.
[12](12-omskrivning-wbal.md) säger i vilken ordning `wbal/` ska rättas.
Detta dokument säger hur **hela** dokumentationen genomförs: hur arbetet delas i
pull requests, hur det delas i commits, och vad "grönt" betyder i ett repo utan byggsteg.

Planen lägger inte till några åtgärder. Varje commit nedan pekar på ett fel-ID eller ett
steg som redan står i [07](07-fel-power-curve.md)–[12](12-omskrivning-wbal.md).

**Beslutsläge: planen körs enligt rekommendationerna.** Nio PR enligt §2, och de fem val som
dokumentationen lämnar öppna är avgjorda i §5. Alternativen står kvar där, men som motiv till
ett fattat beslut — inte som något som ska vägas igen.

---

## 1. De tre frågorna, besvarade först

### Behövs flera PR?

**Ja — nio.** Två skäl, och bara det första är tvingande.

**Tvingande — [12](12-omskrivning-wbal.md) kräver det.** Steg 1–3 sänker föreskriven effekt
med 1–12 W; steg 4 (CP/FTP) höjer varje siffra med exakt 10,5 W. Släpps de ihop tar de ut
varandra och **ingendera går att verifiera**. [12 §Ordning](12-omskrivning-wbal.md) säger
det rakt ut: *"Släpp steg 4 separat."* Det är en releasegräns, inte en granskningspreferens.

**Rekommenderat — verktygen delar ingen kod.** Fyra kataloger, inga korsberoenden, inga
merge-konflikter mellan dem. En PR per verktyg och åtgärdspaket är den naturliga enheten:
den kan granskas, deployas och rullas tillbaka ensam, och den kan verifieras i webbläsaren
av en människa som bara behöver bry sig om ett verktyg.

Minimiindelningen vore fem PR: en per verktyg, plus `wbal/` steg 4 separat. **Beslutat är
nio**, av skäl som står vid varje PR i §4 — plus PR 10, som ligger utanför fellistorna och
har ett eget beslut i §5.

### Ska allt bygga i varje commit?

**Ja, och det är billigare här än i de flesta repon** — men "bygga" måste definieras om,
eftersom [CLAUDE.md](../CLAUDE.md) slår fast att det inte finns något byggsteg och
[pages.yml](../.github/workflows/pages.yml) bara rsync:ar katalogen till `_site`.
**Varje commit deployas som den är.** Ett trasigt mellanläge på `master` är en trasig sajt,
inte ett rött CI-jobb.

Definitionen av grönt, i sin helhet:

| Kontroll | Gäller | Kommando |
|---|---|---|
| Syntax | alla ändrade `.js` | `node --check <fil>` |
| Lint | `wbal/` | `npx eslint script.js && npx jshint script.js` |
| Enhetstester | `wbal/` från PR 1 | `node --test wbal/test/` |
| Sidan laddar | ändrat verktyg | `python3 -m http.server 8000`, öppna, tom konsol |
| Verktyget svarar | ändrat verktyg | mata in defaultvärdena, få en siffra |

Två mönster krävs för att hålla det över hela sekvensen:

1. **Lägg till, koppla in, ta bort — i tre commits.** Ny funktion vid sidan av den gamla,
   sedan byt anropsställe, sedan radera den gamla. Varje mellanläge är körbart, och varje
   commit går att återställa ensam.
2. **Skilj invariant-tester från snapshot-tester.** Invarianterna
   (`min(W′bal) ≤ slut-W′bal`, `min(W′bal) > 0`, asymptoten går mot `W′`) ska hålla i
   *varje* commit. Wattsiffrorna för de 20 mallarna ska bara låsas där
   [12](12-omskrivning-wbal.md) faktiskt har mätt dem: kolumnen "Idag" före PR 2, kolumnen
   "Efter" efter PR 2. **Mellanliggande commits i PR 2 har wattvärden som inte står
   någonstans i dokumentationen** — de är gröna på invarianterna, inte på tabellen. Att låsa
   dem skulle vara att uppfinna facit.

### Varje steg egen commit?

**Ja.** Varje commit nedan är exakt ett fel-ID eller ett numrerat steg ur
[12](12-omskrivning-wbal.md), och commit-meddelandet inleds med det ID:t. Det ger tre saker:
`git log` blir en avprickning mot fellistorna, en enskild åtgärd kan återställas utan att dra
med sig grannen, och den uppmätta effekten i dokumentationen kan tillskrivas rätt ändring.

Undantaget, och det enda: **när en åtgärd ändrar ett tal som ett test låser, ändras testet i
samma commit.** Annars är commiten röd, vilket bryter mot regeln ovan. Det är inte att skriva
om testet tills det passar — det nya värdet kommer ur
[12](12-omskrivning-wbal.md)s mätta tabell, inte ur körningen.

---

## 2. Ordningen mellan PR

```
wbal/          PR 1 ──> PR 2 ──> PR 3
power-curve/   PR 4 ──> PR 5 ──> PR 10
running/       PR 6
fit-analysis/  PR 7 ──> PR 8 ──> PR 9
```

De fyra spåren är oberoende och kan gå parallellt. Inom ett spår är pilarna tvingande.

| PR | Verktyg | Innehåll | Storlek | Beror på |
|---|---|---|---|---|
| 1 | `wbal/` | Bryt ut modellen, lägg till testharness. **Ingen beteendeändring.** | M | — |
| 2 | `wbal/` | Steg 1, 2, 3 och 5 ur [12](12-omskrivning-wbal.md) | L | PR 1 |
| 3 | `wbal/` | Steg 4 — CP skilt från FTP | S | PR 2 |
| 4 | `power-curve/` | PC-1, PC-2, PC-3, PC-4, PC-6 | S | — |
| 5 | `power-curve/` | PC-5 — synliggör tvåpunktsmetodens osäkerhet | S | PR 4 |
| 6 | `running/` | RUN-1, RUN-2, RUN-3, RUN-4 | S | — |
| 7 | `fit-analysis/` | FA-2, FA-1 — de som förvanskar siffror | M | — |
| 8 | `fit-analysis/` | FA-9, FA-4, FA-8, FA-5, FA-7 | M | PR 7 |
| 9 | `fit-analysis/` | FA-6, FA-3 — kräver beslut, se §5 | M | PR 7 |
| 10 | `power-curve/` | [11 §10](11-effekt-duration-protokoll.md) minimivariant. Utbyggnad, inte rättelse. | L | PR 5 |

Tre grupperingar är tvingande och kommer ur dokumentationen, inte ur den här planen:

- **WB-1, WB-2, WB-3, WB-4 i samma release** ([09 §Beroenden](09-fel-wbal.md)): WB-2 utan
  WB-1 ger *sämre* resultat än idag, eftersom gränsvärdet försvinner som varningssignal utan
  att bottennivån börjar kontrolleras.
- **FA-9 → FA-4 → FA-8 som ett paket** ([10 §Beroenden](10-fel-fit-analysis.md)): alla tre rör
  konfigurationsblocket, och FA-9 måste gå först eftersom blocket är duplicerat — annars görs
  allt två gånger.
- **FA-1 före FA-6** ([10 §Beroenden](10-fel-fit-analysis.md)): båda förbjuder 0 W från var
  sitt håll. FA-6 utan FA-1 ser ut att fungera men ändrar ingenting i utfallet. Här löses det
  genom att FA-1 ligger i PR 7 och FA-6 i PR 9 — de behöver inte samma PR, bara den ordningen.

---

## 3. Prioritet, om allt inte görs

[06 §De fem sakerna att fixa först](06-etablerat-vs-eget.md) rangordnar efter påverkan på de
siffror verktygen visar. Översatt till den här indelningen:

| [06](06-etablerat-vs-eget.md) | Fel | PR |
|---|---|---|
| 1 | FA-1 — 30 W-golvet | **PR 7** |
| 2 | FA-2 — täckningskravet | **PR 7** |
| 3 | WB-1/WB-2 — bottennivå och klippning | **PR 2** |
| 4 | WB-3 — återhämtningsfaktorn in i τ | **PR 2** |
| 5 | PC-1 — arean under kurvan | **PR 4** |

**PR 7, PR 2 och PR 4 täcker alla fem.** Görs inget annat är repot ändå av med allt som tyst
förvanskar siffror. PR 1 är förutsättningen för PR 2 och räknas in.

---

## 4. Commits per PR

Varje rad är en commit. "Grönt av" anger vad som verifierar just den commiten, utöver
checklistan i §1.

### PR 1 — `wbal/`: bryt ut modellen och lägg till tester

Förutsättning för PR 2. [12](12-omskrivning-wbal.md) listar åtta regressionstester, och
`wbal/script.js` blandar idag matematik med DOM — funktionerna går inte att anropa utan en
webbläsare. Det måste lösas innan matematiken ändras, annars ändras den overifierat.

| # | Commit | Grönt av |
|---|---|---|
| 1.1 | Flytta mallar, simulering, återhämtning och solver till `wbal/model.js`. `script.js` behåller all DOM-kod och anropar modellen. `index.html` laddar båda. | De 20 mallarna ger identiska watt som kolumnen "Idag" i [12](12-omskrivning-wbal.md) |
| 1.2 | `wbal/test/model.test.js` med `node --test`: kolumnen "Idag" som snapshot, plus invarianterna | Testerna gröna; `npm test` slutar vara `exit 1` |
| 1.3 | CI-jobb som kör lint och `node --test` på push. Rätta samtidigt raden om att CI saknar test i [CLAUDE.md](../CLAUDE.md). | Jobbet grönt på `master`; ett avsiktligt brutet test gör det rött |

`model.js` exponeras för båda hållen med ett `module.exports`-skydd i botten — samma
CommonJS-shim som `fit-analysis/module-loader.js` redan bygger på. Inga nya beroenden:
`node --test` ingår i Node.

Commit 1.3 ligger utanför dokumentationen och utanför nuvarande CI, och är den enda punkten i
planen som ändrar hur repot arbetar snarare än vad det räknar. Den är beslutad — se §5.

### PR 2 — `wbal/`: steg 1, 2, 3 och 5

Kärnan i [12](12-omskrivning-wbal.md). Rör inte tömningsmatematiken, `restPercent`-tabellen,
passtaxonomin eller mål-W′bal-konceptet — [09](09-fel-wbal.md) friskförklarar dem uttryckligen.

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 2.1 | Simuleringen returnerar `{ finalWbal, minWbal }`; `minWbal` spåras genom hela passet och visas i gränssnittet. Ingen ändring av föreskriven effekt. | [WB-1](09-fel-wbal.md), steg 2 | Test 5: båda pyramiderna får `minWbal < finalWbal` strikt — på dagens matematik 4023 J resp. 3787 J mot ett slutvärde runt målets 4500 J |
| 2.2 | Ta bort `recoveryFactor`. Inför `tau = 546·e^(−0,01·D_CP) + 316`. Ta bort τ-fältet ur `index.html:30–34`. | [WB-3](09-fel-wbal.md), [WB-4](09-fel-wbal.md), steg 1 | Test 1: passiv vila **> 98 % av W′ efter 30 min** för CP 150–350 W. Test 2: aktiv vila på 0,5 × CP återvinner > 50 % |
| 2.3 | Sökintervall `0.5·CP` till `4.0·CP`. Solvern returnerar `solved` / `floor_limited` / `out_of_range`; gränssnittet visar de tre olika. | [WB-2](09-fel-wbal.md), steg 3 | Test 4: `2×15 min` får `min(W′bal) > 0`. Test 6: konstruerat fall CP 425 W, W′ 5 kJ, mål 10 % ger `floor_limited`. Test 8: `out_of_range` visas aldrig som en vanlig rekommendation |
| 2.4 | Ta bort mallen `8×(8×20s)` — 64 repetitioner, 52 min; klassisk tabata är **ett** set. | [WB-6](09-fel-wbal.md), steg 5 | 19 mallar kvar; snapshot-raden borttagen |
| 2.5 | Uppdatera snapshot till kolumnen "Efter" i [12](12-omskrivning-wbal.md) och lägg till svepet. | steg 5 | Test 3 och 7: `min(W′bal) > 0` för alla mallar och över svepet CP 150–350 W, W′ 6–30 kJ, mål 10–30 % |

Två saker att inte bli överraskad av, båda uppmätta i
[12 §5](12-omskrivning-wbal.md):

- **17 av 20 mallar sjunker**, de korta anaeroba mest (−7 till −12 W). Det är den avsedda
  effekten, inte en regression. Planens ursprungliga förväntan var den motsatta och är
  uttryckligen tillbakadragen — **stiger** de korta passen i stället ligger
  återhämtningsfaktorn kvar någonstans.
- **`2×15 min` byter karaktär**: från 210 W som är ett klippt gränsvärde med slut-W′bal
  −155 J, till 208 W som är en riktig lösning.

Commit 2.1 och 2.2 kan inte låsas mot tabellen — se §1. `minWbal` från 2.1 mäts däremot på
dagens matematik i [12](12-omskrivning-wbal.md)s `min`-kolumn, och de värdena gäller exakt
fram till 2.2.

### PR 3 — `wbal/`: steg 4, CP skilt från FTP

Egen release. Nettoeffekten blir annars ungefär noll för de korta passen
(−7 W från τ, +10,5 W från CP) och **båda ändringarna blir osynliga i utfallet**.

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 3.1 | Döp om fältet `index.html:17` till `CP (Critical Power)`. Explicit FTP-inmatning konverteras med `CP ≈ FTP / 0,95` och märks som uppskattad. | [WB-5](09-fel-wbal.md) | Test: FTP 200 W inmatat ger exakt samma siffror som CP 210,5 W |
| 3.2 | Uppdatera snapshot: varje mall +10,5 W vid FTP-inmatning. | [WB-5](09-fel-wbal.md) | Förskjutningen är **identisk för alla mallar** — ett enda tal, inte 19 |

### PR 4 — `power-curve/`: de fem billiga

Fem oberoende commits i en 346-raders fil. Ingen av dem rör beräkningen av TP eller HIE.

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 4.1 | Kontrollera `t₁ ≠ t₂` före `rad 120` och visa *"testerna måste ha olika längd"*. Mönstret finns i `running/index.html:367`. | [PC-3](07-fel-power-curve.md) | Två lika tider ger ett meddelande, inte `Infinity` |
| 4.2 | Negativ HIE visas med tolkning: *"minst ett av testerna var inte maximalt"*, inte som ett giltigt resultat. | [PC-4](07-fel-power-curve.md) | 300 W @ 300 s + 280 W @ 60 s ger meddelandet |
| 4.3 | Ersätt rutan `Area (0-1h)` (`rad 65–67, 126, 144–145`) med `TP·3600 + HIE`, döpt *"Maximalt arbete på 1 h"*. | [PC-1](07-fel-power-curve.md) | Siffran sjunker ~12,3 % och slutar bero på `t₀` |
| 4.4 | Döp om `PP (Peak Power)` till *"Högsta testeffekt"* (`rad 53, 140`). Billiga vägen — den dyra är PR 10. | [PC-2](07-fel-power-curve.md) | Etiketten stämmer med `Math.max(P1, P2)` |
| 4.5 | Låt exempeltexten (`rad 53, 66–67, 92–97`) följa defaultvärdena, och skriv ut domänregeln: *"två maximala insatser mellan 3 och 12 minuter, minst 3 minuters skillnad"*. | [PC-6](07-fel-power-curve.md) | Ingen hårdkodad siffra kvar som inte kommer ur inmatningen |

Commit 4.5 förutsätter 4.3 — `982kJ` i exempeltexten är arean, och rutan finns inte längre.

### PR 5 — `power-curve/`: PC-5, gör osäkerheten synlig

[PC-5](07-fel-power-curve.md) går inte att fixa, bara synliggöra. Punkt 3 i åtgärden
(minstakvadratanpassning) är PR 10.

| # | Commit | Grönt av |
|---|---|---|
| 5.1 | Varna när testtiderna ligger närmare än ~180 s | Varningen tänds vid 300 s och 400 s, släcks vid 180 s och 600 s |
| 5.2 | Visa känsligheten: räkna om TP och HIE med ±5 W på varje punkt och visa spannet, *"TP 200 W (±8 W)"* | Spannet växer när separationen krymper |

### PR 6 — `running/`: fyra fel, en mekanism

Alla fyra åtgärdas med samma grepp — märk ut var modellen gäller och var den inte gör det.
[08](08-fel-running.md) är repots friskaste kod: **noll implementationsfel**, alla fyra är
modellens giltighetsgränser.

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 6.1 | Inför domänmarkering i prediktionstabellen (`rad 415–421, 429`): innanför ~2–15 min normalt, utanför gråmarkerat | — | Markeringen syns, inga tal ändras |
| 6.2 | Märk långa distanser: *"utanför modellens giltighet — läs som ett tak, aldrig som en prognos"* | [RUN-1](08-fel-running.md) | Maraton 2:58 ur ett 20-min 5 km visas fortfarande, men märkt |
| 6.3 | Märk 800 m och 1500 m som *"minst så snabbt"* | [RUN-2](08-fel-running.md) | Samma markering, undre änden |
| 6.4 | Märk `Maximal distans (1 h)` (`rad 383`) som ett tak, alternativt räkna den på 20 eller 30 min | [RUN-4](08-fel-running.md) | Rutan har en storhet som ligger i eller nära domänen |
| 6.5 | Varning vid för liten separation mellan loppen, plus känslighetsspann — samma som 5.1 och 5.2 | [RUN-3](08-fel-running.md) | Varningen tänds för två närliggande lopp |

Att ta bort de långa prediktionerna vore sämre än att märka dem — *"användaren vill ha dem,
och ett markerat värde lär ut mer än inget värde"* ([08](08-fel-running.md)).

### PR 7 — `fit-analysis/`: de två som förvanskar siffror

[06](06-etablerat-vs-eget.md)s plats 1 och 2. Störst numerisk påverkan i hela repot.

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 7.1 | Gör täckningskravet till en riktig kvot: jämför mot filens egen samplingsfrekvens i stället för mot en sekund (`fit-analysis.js:14, 837`) | [FA-2](10-fel-fit-analysis.md) | En fil inspelad med smart recording ger siffror i stället för `N/A` i samtliga rutor |
| 7.2 | Ta bort 30 W-golvet (`fit-analysis.js:13, 800`). **Behåll interpoleringen av isolerade nollor** — den är sund och löser det problem heuristiken faktiskt var till för. | [FA-1](10-fel-fit-analysis.md) | TSS sjunker på ett pass med frihjulning; ett pass utan nollor är oförändrat |

Båda felen har en dyrare fortsättning, och båda är **uppskjutna till efter PR 9** — de hör
inte hemma i 7.1 och 7.2, som ska vara en kvotfix och en ren borttagning:

- **FA-2:** resampla till 1 Hz före beräkningen. Enligt [10](10-fel-fit-analysis.md) den
  bättre lösningen och det kommersiella verktyg gör, men den rör varje fönsterberäkning i
  filen. Se §5.
- **FA-1:** läs kadens och hastighet ur FIT-filen och skilj äkta sensorbortfall från
  frihjulning. Båda kanalerna finns i filen men läses aldrig in. Det är den riktiga
  lösningen på heuristikfelet — 7.2 tar bort det felaktiga golvet, den här punkten ersätter
  gissningen med data.

### PR 8 — `fit-analysis/`: konfigurationspaketet och de rena buggarna

Ordningen inom PR:en är tvingande enligt [10 §Beroenden](10-fel-fit-analysis.md).

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 8.1 | Bryt ut standardkonfigurationen till en konstant; både initieringen (`rad 19–50`) och `resetTSSConfigs()` (`rad 1387–1418`) läser från den, med kopiering vid tilldelning | [FA-9](10-fel-fit-analysis.md) | `reset` återställer i stället för att dela referens; blocket finns på ett ställe |
| 8.2 | Byt `SPRINT`/`VO2_MAX`/`THRESHOLD`/`STANDARD` mot `TSS@10s`, `TSS@30s`, `TSS@180s`, `TSS@600s` | [FA-4](10-fel-fit-analysis.md) | Inget namn påstår något om energisystem |
| 8.3 | Lägg till variabilitetsindexet `TSS@10s − TSS@600s` med läsregeln ur [10](10-fel-fit-analysis.md) | [FA-4](10-fel-fit-analysis.md) | Ett jämnt distanspass ger ≈ 0, ett intervallpass > 40 |
| 8.4 | Lägg till en `BASE`-post med `seconds: -1` i konfigurationen | [FA-8](10-fel-fit-analysis.md) | Kodvägen på `rad 755` och `858` körs; `Base TSS` visas |
| 8.5 | Rätta etiketten `30m TSS (Endurance)` till `30s TSS (Standard)` (`index.html:121`) och märk den som referensvärdet | [FA-5](10-fel-fit-analysis.md) | Etiketten matchar `seconds: 30` |
| 8.6 | Härled `displayKey: \`w${newSeconds}\`` i `addNewTSSConfig` (`rad 1370`) | [FA-7](10-fel-fit-analysis.md) | Två egendefinierade fönster visar var sitt värde |

8.3 är den enda commiten i hela planen som lägger till en siffra i gränssnittet i stället för
att rätta en. [10](10-fel-fit-analysis.md) kallar frånvaron *"verktygets största missade
möjlighet"* — all data finns redan beräknad.

### PR 9 — `fit-analysis/`: de två som kräver beslut

| # | Commit | Åtgärdar | Grönt av |
|---|---|---|---|
| 9.1 | `targetPercent` i stället för `targetWatt` i passchemat; räkna om till watt vid visning. Tillåt `targetPercent: 0`. Uppdatera `sample-workout.json` och valideringen (`rad 1852–1868`). | [FA-6](10-fel-fit-analysis.md) | Samma pass ger samma planerade TSS oavsett FTP; ett vilosteg går att uttrycka |
| 9.2 | TSS-ackumuleringen (`rad 907–930`) — per fönster i stället för per prefix, **eller** rita NP i stället för TSS. Se §5. | [FA-3](10-fel-fit-analysis.md) | Kurvan planar ut när atleten slutar arbeta |

9.1 kräver att 7.2 redan är släppt — annars får planerade vilopass ändå 30 W i beräkningen,
och ändringen ser ut att fungera utan att göra någon skillnad.

### PR 10 — `power-curve/`: minimivarianten ur [11](11-effekt-duration-protokoll.md)

[11](11-effekt-duration-protokoll.md) är märkt som en **alternativ implementation**, inte som
en fellista. Hela dokumentet — tre domäner, sex testpunkter, tre testpass — är en utbyggnad
av verktyget, och [11 §8](11-effekt-duration-protokoll.md) underkänner dessutom sin egen
durability-gren: den producerar `P(60 min)/CP` runt 95–97 % medan dokumentet självt anger
86–94 % som det band siffran ska hamna i.

**Beslutat: bygg bara [§10 Minimivarianten](11-effekt-duration-protokoll.md).** Den är
tre punkter i 2–15 min, minstakvadratanpassning och en residual — allt som behövs för zoner
och intervallplanering, och exakt punkt 3 i [PC-5](07-fel-power-curve.md)s åtgärd. Resten av
[11](11-effekt-duration-protokoll.md) — Morton-grenen, durability-grenen, Pass B och C —
byggs inte.

| # | Commit | Grönt av |
|---|---|---|
| 10.1 | Tillåt 3–5 testpunkter i stället för 2 | Två punkter fungerar fortfarande, som specialfall |
| 10.2 | Anpassa `P` mot `1/t` med minsta kvadrat i stället för algebra | Exemplets tre punkter ger CP 245,1 W och W′ 15 550 J |
| 10.3 | Visa residualer i **watt** per punkt, plus 8-wattsregeln | Residualer −1,4 / +3,1 / −1,7 W; ett 5-minuterstest 17 W för lågt utlöser regeln |
| 10.4 | Heldragen kurva i anpassat intervall, streckad utanför | Extrapolationen är visuellt skild från anpassningen |

Det löser [PC-3](07-fel-power-curve.md) strukturellt (ingen `t₁ − t₂` i någon nämnare),
[PC-5](07-fel-power-curve.md) på riktigt, och ger [PC-4](07-fel-power-curve.md) en
uttrycklig tolkning. 10.2 gör 4.1 överflödig — behåll kontrollen ändå, den kostar inget.

**Varför Morton-grenen inte ingår, trots att den skulle göra `Pmax` till en riktig peak
power:** ett `W′` anpassat med treparametersformen blir 23 % större och betyder något annat
än tvåparameterns `W′` ([11 §7](11-effekt-duration-protokoll.md)). Det får inte matas rakt in
i `wbal/`, som förutsätter tvåparameterdefinitionen — det vore samma tysta enhetsbyte som
[WB-5](09-fel-wbal.md) handlar om, i en ny förklädnad. Skulle grenen ändå byggas senare är
det den frågan som måste lösas först, inte anpassningen.

---

## 5. Besluten

Fem ställen där dokumentationen anger flera möjliga åtgärder och inte väljer. **Samtliga är
avgjorda enligt rekommendationen.** Alternativen står kvar i tabellen för att motivet ska gå
att granska — inte för att vägas igen.

| Var | Alternativ | Beslut |
|---|---|---|
| **FA-2** (7.1) | Riktig kvot mot filens samplingsfrekvens, eller resampling till 1 Hz | **Kvoten.** Den är liten och rättar felet. Resampling är rätt på sikt — NP är *definierad* på 1 Hz-data — men rör varje fönsterberäkning i filen och får en egen PR sist i `fit-analysis/`-spåret, efter PR 9 |
| **FA-3** (9.2) | TSS per fönster, eller rita NP över prefix | **TSS per fönster.** [10](10-fel-fit-analysis.md): *"Det är nästan säkert vad som var avsett"* |
| **PC-2** (4.4) | Döp om rutan, eller mät faktisk `Pmax` med Morton | **Döp om**, i 4.4. Mätningen kräver ett 10-sekunderstest, och Morton-grenen byggs inte alls — se raden nedan |
| **[11](11-effekt-duration-protokoll.md)** (PR 10) | Hela protokollet, minimivarianten, eller ingenting | **Minimivarianten.** Hela protokollet kostar tre testpass och en gren som dokumentet självt underkänner ([11 §8](11-effekt-duration-protokoll.md)) |
| **CI-jobbet** (1.3) | Med eller utan | **Med.** Se nedan |

**1.3 är beslutet med en kostnad.** Ett CI-jobb som kör lint och `node --test` går emot
*"Det finns inget build- eller teststeg i CI"* i [CLAUDE.md](../CLAUDE.md), och den raden
måste då rättas i samma commit. Skälet att ta den kostnaden: kravet *"allt ska bygga i varje
commit"* är annars kontrollerbart bara för den som skrev commiten, och varje commit här
deployas direkt till Pages. Jobbet kostar ett 20-raders workflow och noll nya beroenden —
`node --test` ingår i Node, och eslint och jshint finns redan i `wbal/node_modules/`.

Två saker som beslutet **inte** omfattar: det införs inget byggsteg, och det läggs inga
tester på de tre verktyg som är enfilade HTML-sidor. Endast `wbal/`, som ändå måste brytas
isär i PR 1 för att [12](12-omskrivning-wbal.md)s åtta regressionstester ska gå att köra.

---

## 6. Utanför planen

Tre saker som står i dokumentationen men inte är fel, och inte ligger i någon PR ovan:

- **`D′bal` för löpning** ([08](08-fel-running.md), [02 §5](02-critical-speed.md)) —
  uttryckligen *"saknad funktion, inte ett fel"*.
- **Formutveckling över tid** — CTL/ATL/TSB, Banister ([06](06-etablerat-vs-eget.md)).
  Ett nytt lager ovanpå [03](03-normalized-power-och-tss.md), inte en rättelse.
- **Delad signatur mellan verktygen** ([06](06-etablerat-vs-eget.md)) — TP från
  `power-curve/` är precis den CP `wbal/` vill ha. PR 3 gör kopplingen *begriplig* genom att
  skilja CP från FTP, men bygger ingen överföring. Det bryter dessutom mot *"håll varje
  verktyg självständigt"* i [CLAUDE.md](../CLAUDE.md) och kräver ett eget beslut.

Samtliga tre är utbyggnader. Planen ovan rättar det som är fel; den bygger ingenting nytt
utom variabilitetsindexet (8.3), som är en siffra ur data som redan beräknas.
