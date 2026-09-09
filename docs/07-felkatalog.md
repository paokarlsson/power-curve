# Felkatalog

Översikt över samtliga fel, med fil och rad.

Felen i `wbal/` och `fit-analysis/` — alla som tyst förvanskar siffror eller ger felaktiga
träningsföreskrifter — är utlyfta till en egen arbetslista:
**[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md)**. Här står
de kvar som sammanfattningar med länk. Felen i `power-curve/` och `running/` beskrivs i
sin helhet nedan.

**Inget är åtgärdat** — dokumentet beskriver bara.

Varje siffra nedan är uppmätt genom att köra repots egen kod, inte uppskattad.

Allvarlighetsgrad:

- **A — förvanskar tyst siffror som används.** Verktyget visar ett tal som ser rimligt
  ut men är fel, utan någon indikation.
- **B — ger felaktiga föreskrifter.** Verktyget rekommenderar träning som inte stämmer.
- **C — rätt siffra, fel namn.** Beräkningen är korrekt men presenteras som något den inte är.
- **D — robusthet och underhåll.** Trasigt i kantfall, eller framtida fällor.

---

## A1 — Frihjulning bokförs som sensorbortfall

**`fit-analysis/fit-analysis.js:13, 800`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#a1--frihjulning-bokförs-som-sensorbortfall).

Sammanhängande nollor — alltså frihjulning — golvas till 30 W. Felet växer med hur mycket atleten frihjular: **+2,2 % TSS vid 5 s/min, +12,3 % vid 20 s/min, +53,6 % vid 40 s/min**, och kan därför inte kalibreras bort.

## A2 — Täckningskravet slår ut hela analysen vid gles inspelning

**`fit-analysis/fit-analysis.js:14, 837`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#a2--täckningskravet-slår-ut-hela-analysen-vid-gles-inspelning).

`WINDOW_COVERAGE_THRESHOLD` är ett absolut krav på 0,5 Hz, inte relativ täckning. Vid inspelning glesare än varannan sekund kastas **samtliga** fönster och alla TSS-värden blir `N/A`, utan förklaring.

## A3 — TSS-ackumuleringen planar aldrig ut

**`fit-analysis/fit-analysis.js:907–930`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#a3--tss-ackumuleringen-planar-aldrig-ut).

Full omräkning var 30:e sekund gör att `TSS ∝ √t` — kurvan slutar aldrig stiga. Uppmätt **1,6–3,7× för stort tillskott** efter en hård insats.

## A4 — "Area under kurvan" är ingen energi

**Var:** `calculateCurve` i `power-curve/`, rutan märkt *Area (0-1h)*.

**Vad koden gör.** Integrerar effektkurvan från 1 s till 3600 s och presenterar resultatet
som *"total energi som kan produceras"*:

```
Area = ∫ (TP + HIE/t) dt = TP·(T − t₀) + HIE·ln(T/t₀)
```

**Varför det är fel — två oberoende skäl.**

*(a) Kurvan är en envelopp, inte ett förlopp.* Varje punkt på power–duration-kurvan är
en **separat maximal insats**. Punkten vid 5 minuter och punkten vid 20 minuter kan inte
utföras i samma pass. Att integrera kurvan summerar arbeten som utesluter varandra. Det
maximala arbete som faktiskt kan utföras på en timme ges direkt av den linjära formen,
`W(3600) = TP·3600 + HIE`.

| Storhet (defaultvärden, TP 200 W, HIE 12,6 kJ) | Värde |
|---|---|
| Integralen (det verktyget visar) | **823 kJ** |
| `TP·3600 + HIE` (fysiologiskt korrekt) | **733 kJ** |
| Överskattning | **+12,3 %** |

*(b) Resultatet beror på en godtycklig undre gräns.* Termen `HIE·ln(T/t₀)` divergerar
när `t₀ → 0`. Koden väljer `t₀ = 1 s` utan motivering:

| `t₀` | Area |
|---|---|
| 0,1 s | 852 kJ |
| **1 s** | **823 kJ** |
| 5 s | 802 kJ |
| 30 s | 774 kJ |

Ett tal som rör sig 10 % beroende på var man godtyckligt börjar integrera är ingen
fysiologisk storhet. Underrutan *"≈ 273W avg"* ärver samma fel.

---

## B1 — Binärsökningen klipper tyst vid intervallgränserna

**`wbal/script.js:162–163`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#b1--binärsökningen-klipper-tyst-vid-intervallgränserna).

Sökintervallet 1,05–1,50 × CP returnerar gränsvärdet utan markering. Biter bara för `2×15 min`, som då föreskrivs till 210 W med slut-W′bal **−155 J** — ogenomförbart.

## B2 — Endast sluttillståndet kontrolleras, aldrig bottennivån

**`wbal/script.js:167–169`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#b2--endast-sluttillståndet-kontrolleras-aldrig-bottennivån).

Pyramiderna underskattar djupet med **3,8–5,4 % av W′**. Under τ ≈ 145 s går bottennivån under noll medan slutvärdet når målet — **168 sådana fall** i den genomsökta parameterrymden.

## B3 — Återhämtningsfaktorn sitter på fel storhet

**`wbal/script.js:60–61, 77, 98, 106, 125`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#b3--återhämtningsfaktorn-sitter-på-fel-storhet).

`(CP − restPower)/CP` multipliceras på mängden i stället för att sitta i τ. Ger fel asymptot: med faktor 0,5 återhämtas **aldrig mer än halva underskottet**, oavsett vilotid.

## B4 — CP och FTP behandlas som samma sak

**`wbal/index.html:17`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#b4--cp-och-ftp-behandlas-som-samma-sak).

CP ligger typiskt över FTP. Matar man in FTP blir taket för lågt, W′-förbrukningen överskattas och föreskriven effekt blir för låg — samma riktning som B3.

## C1 — "PP (Peak Power)" är inte en peak power

**Var:** `calculateCurve`, `const PP = Math.max(P1, P2)`.

**Vad koden gör.** Sätter PP till den högsta av de två inmatade effekterna.

**Varför det är fel.** Termerna PP / HIE / TP kommer från Xerts treparameterssignatur, där
**PP är en självständigt anpassad parameter** som böjer kurvan vid mycket korta durationer
så att `P(t)` går mot ett ändligt maxvärde i stället för mot oändligheten när `t → 0`.

Verktyget använder bara tvåparametersmodellen. Där finns ingen PP — kurvan divergerar.
Rutan visar därför inte en modellparameter utan bara den största siffran användaren skrev
in. Med defaultvärdena blir PP = 260 W, vilket är en **3,5-minuterseffekt**, inte en
peak power. En verklig peak power för samma atlet ligger typiskt kring 800–1200 W.

**Omfattning.** Rent kosmetiskt: PP läses aldrig av någon annan beräkning, påverkar ingen
kurva och exporteras inte. Felet är att en ruta bär ett namn den inte förtjänar, bredvid
tre rutor som gör det.

**Vad rätt beteende vore.** Antingen döpa om rutan till vad den är ("högsta testeffekt"),
eller införa Mortons treparametersmodell `P(t) = CP + W′/(t + W′/(Pmax − CP))`, som ger en
äkta Pmax men kräver minst tre testpunkter.

---

## C2 — Fönsternamnen antyder energisystem

**`fit-analysis/fit-analysis.js:19–50, 1387–1418`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#c2--fönsternamnen-antyder-energisystem).

`SPRINT`/`VO2_MAX`/`THRESHOLD` mäter tidsskala för variabilitet, inte energisystem. Ett jämnt tempopass utan en enda sprint ger 60,7 i rutan "TSS (Sprint)".

## C3 — Etiketten "30m TSS (Endurance)" gäller ett 30-sekundersfönster

**`fit-analysis/index.html:121`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#c3--etiketten-30m-tss-endurance-gäller-ett-30-sekundersfönster).

`STANDARD` är 30 **sekunder** — Coggans standard, och den enda ruta vars siffra går att jämföra med andra verktyg. Etiketten läser det som 30 minuter.

## C4 — Maratonprediktionen är strukturellt för snabb

**Var:** `generatePredictions` i `running/`.

**Vad koden gör.** Inverterar CS-modellen: `t = (d − D′) / CS`, för distanser upp till maraton.

**Varför det är fel.** Modellen låter tempot närma sig CS **uppifrån** — den predikterade
maratonhastigheten är alltid *snabbare* än CS. Verkligheten är den omvända: maraton springs
**under** CS, eftersom substrattillgång, värmereglering och muskelskada begränsar långt
innan den aeroba kapaciteten gör det. Ingen av dessa mekanismer finns i modellen.

Felet är alltså inte slumpmässig osäkerhet utan en **strukturell bias åt ett håll**, och den
växer med distansen. Med defaultvärdena (1000 m på 3:00, 5000 m på 20:00) predikteras
maraton till **2:58:05** — ur ett 5 km på 20 minuter.

I den korta änden gäller motsatt problem: `v(t) = CS + D′/t` går mot **oändligheten** när
`t → 0`. Modellen har ingen övre hastighetsgräns och kan per definition inte beskriva
sprintdistanser.

**Läsregel.** Pålitlig 3–10 km. 800 m och 1500 m är extrapolationer utanför modellen.
Halvmaraton och maraton ska läsas som "aldrig snabbare än så här", aldrig som en prognos.

---

## D1 — Lika testtider ger `Infinity` utan felmeddelande

**Var:** `calculateCurve` i `power-curve/`.

Nämnaren `t₁ − t₂` kontrolleras aldrig. Med två insatser på samma tid blir
`TP = Infinity` och `HIE = −Infinity`, och gränssnittet skriver ut `InfinityW` respektive
`-InfinitykJ` i signaturrutorna. Löpverktyget har motsvarande kontroll
(`t1 === t2` avbryter); effektverktyget saknar den.

---

## D2 — Negativ HIE visas som ett giltigt resultat

Om testpunkterna är fysiologiskt inkonsekventa — den korta insatsen gav **lägre** totalt
arbete än den långa — blir HIE negativt. Exempel: 240 W @ 210 s mot 250 W @ 630 s ger
TP = 255 W och **HIE = −3150 J**.

Ett negativt anaerobt förråd är meningslöst, men visas utan varning. Det är samtidigt den
**mest användbara diagnostiska signal modellen kan ge**: den betyder nästan alltid att
minst en av de två insatserna inte var maximal. Att inte visa det är ett missat tillfälle
snarare än bara ett skönhetsfel.

---

## D3 — Tvåpunktsmetoden förstärker mätfel, och det syns inte

**Var:** hela skattningen i både `power-curve/` och `running/`.

Två punkter ger **exakt en lösning, alltid**. Det finns ingen residual, ingen
konfidensskattning och ingen möjlighet att upptäcka att en insats var dålig. Standard-
protokoll använder 3–5 insatser och minsta kvadratanpassning just av det skälet.

Förstärkningen är kvantifierbar. Punkt 1 hålls fast vid 260 W @ 210 s; punkt 2 väljs så att
modellen ger exakt TP = 200 W och HIE = 12,6 kJ. Sedan läggs **5 W mätfel** på punkt 2:

| t₂ | Separation | TP-svängning | HIE-svängning |
|---|---|---|---|
| 630 s | 420 s | +7,5 W | −1,6 kJ |
| 420 s | 210 s | +10,0 W | −2,1 kJ |
| 330 s | 120 s | +13,8 W | −2,9 kJ |
| 270 s | 60 s | +22,5 W | −4,7 kJ |
| 240 s | 30 s | **+40,0 W** | **−8,4 kJ** |

Även vid verktygets **väl valda** defaultseparation på 420 s flyttar 5 W fel på en
testpunkt tröskeleffekten 7,5 W och det anaeroba förrådet 1,6 kJ — **13 % av HIE**.
Ligger testerna närmare varandra i tid blir skattningen snabbt oanvändbar.

Detta är inte en bugg utan en egenskap hos metoden, men den är helt osynlig i
gränssnittet, som presenterar resultatet med tre värdesiffror.

---

## D4 — Passchemat anger absoluta watt

**`fit-analysis/sample-workout.json:9, 14, 18` och `fit-analysis.js:1852–1868`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#d4--passchemat-anger-absoluta-watt).

Mål i absoluta watt men poängsättning mot FTP. Exempelpasset "4x4 Threshold" ligger på 125 % av default-FTP. `targetWatt ≥ 1` gör dessutom 0 W-vila omöjlig att uttrycka.

## D5 — Egendefinierade TSS-fönster kolliderar

**`fit-analysis/fit-analysis.js:1370`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#d5--egendefinierade-tss-fönster-kolliderar).

`displayKey: '1Minute'` är hårdkodat, så två egendefinierade fönster skriver till samma post och båda rutorna visar det sistnämndas värde.

## D6 — Oanropbar kodväg för "Base TSS"

**`fit-analysis/fit-analysis.js:755, 858`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#d6--oanropbar-kodväg-för-base-tss).

Varken sentinelvärdet `−1` eller nyckeln `'BASE'` används av någon konfiguration. Storheten de skulle räkna är samtidigt den saknade baslinjen för fönsterspektrumet.

## D7 — Mallen `8×(8×20s)` är inte ett genomförbart pass

**`wbal/script.js:25`** — full beskrivning, reproduktion och mätserie i
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md#d7--mallen-8820s-är-inte-ett-genomförbart-pass).

8 set × 8 rep = 64 repetitioner, 51,7 minuter. Klassisk tabata är ett set.

## Sådant jag tidigare beskrev som fel, men som inte är det

Två påståenden i den första versionen av dokumentationen höll inte för mätning. De är
rättade i respektive dokument och redovisas här:

**Den decimerade fönsterstegningen är i praktiken effektlös.** `steg = max(1, ⌊fönster/60⌋)`
gör att långa fönster flyttas 3–20 s i taget i stället för 1 s. Jag beskrev det som en
liten systematisk underskattning av NP. Uppmätt på ett realistiskt ojämnt 40-minuterspass:

| Fönster | Steg | NP med kodens steg | NP med 1 s-steg | Skillnad |
|---|---|---|---|---|
| 180 s | 3 s | 229,32 W | 229,26 W | +0,03 % |
| 600 s | 10 s | 209,83 W | 209,83 W | 0,00 % |
| 1200 s | 20 s | 210,01 W | 210,03 W | −0,01 % |

Skillnaden är under en tiondels procent och saknar riktning. Det är en rimlig
prestandaoptimering, inte ett fel.

**TSS-ackumuleringskurvan kan inte sjunka.** Se A3 — jag hade fel om riktningen. Det
verkliga felet är att kurvan aldrig planar ut.

---

## Sammanfattande rangordning

Efter hur mycket felet påverkar siffror som faktiskt används:

| # | Fel | Fil | Typ | Storlek |
|---|---|---|---|---|
| 1 | A1 — frihjulning som bortfall | `fit-analysis.js:13, 800` | tyst förvanskning | +2 till +54 % TSS, ojämnt fördelat |
| 2 | A2 — täckningskravet | `fit-analysis.js:14, 837` | totalt bortfall | alla värden N/A vid gles inspelning |
| 3 | B2 + B1 — obegränsad bottennivå, tyst klippning | `wbal/script.js:162–169` | felaktig föreskrift | ogenomförbara pass, omarkerade |
| 4 | A3 — ackumuleringen planar aldrig ut | `fit-analysis.js:907–930` | tyst förvanskning | 1,6–3,7× för högt tillskott |
| 5 | B3 — återhämtningsfaktorns asymptot | `wbal/script.js:60–61` | felaktig föreskrift | föreskriver systematiskt för lågt |
| 6 | A4 — area som energi | `power-curve/index.html:126` | tyst förvanskning | +12,3 %, plus godtycklig `t₀` |
| 7 | B4, D4 — CP/FTP, absoluta watt | `wbal/index.html:17`, `sample-workout.json` | begreppsfel | förstärker 5, gör pass icke-portabla |
| 8 | C1–C4 — namn och etiketter | fyra filer | feltolkning | rätt siffra, fel innebörd |
| 9 | D1, D2, D5, D6, D7 | fyra filer | robusthet | kantfall och kvarlämnat |

Rad 1–5, 7 (delvis) och de flesta i rad 8–9 är utlyfta till
[08 — Fellista: wbal och fit-analysis](08-fellista-wbal-och-fit-analysis.md).

D3 (tvåpunktsmetodens felförstärkning) står utanför rangordningen: det är ingen bugg utan
en gräns för vad metoden kan leverera, och den gäller allt som byggs ovanpå signaturen.
