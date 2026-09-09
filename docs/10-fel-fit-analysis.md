# Fellista: `fit-analysis/`

Alla fel i analysverktyget. Berör tre filer: **`fit-analysis/fit-analysis.js`**,
**`fit-analysis/index.html`** och **`fit-analysis/sample-workout.json`**.

Detta verktyg innehåller repots mest originella idé — att beräkna NP och TSS över **flera
fönsterlängder samtidigt**, vilket förvandlar TSS från ett tal till ett spektrum som mäter
variabilitetens tidsskala. Det är också verktyget med flest fel, och de två allvarligaste
felen i hela repot.

**Inget är åtgärdat.** Siffrorna är uppmätta genom att köra koden.

## Feltyper

| Typ | Innebörd |
|---|---|
| **Modellfel** | Måttet är olämpligt eller feltillämpat. Koden gör precis vad den ska. |
| **Implementationsfel** | Modellen är rätt, men koden gör inte det den avser. Ren buggfix. |
| **Heuristikfel** | En gissningsregel om data är fel formulerad. Varken ren bugg eller modell — ett antagande som inte håller. |
| **Begreppsfel** | Beräkningen rätt, men presenteras som något den inte är. |
| **Designfel** | Datastrukturen är fel formad för sitt syfte. |

## Översikt

| ID | Fel | Fil och rad | Typ | Storlek |
|---|---|---|---|---|
| **FA-1** | Frihjulning bokförs som sensorbortfall | `fit-analysis.js:13, 800` | **Heuristikfel** | +2 till +54 % TSS |
| **FA-2** | Täckningskravet slår ut hela analysen | `fit-analysis.js:14, 837` | **Implementationsfel** | alla värden `N/A` |
| **FA-3** | TSS-ackumuleringen planar aldrig ut | `fit-analysis.js:907–930` | **Modellfel** | 1,6–3,7× för stort tillskott |
| **FA-4** | Fönsternamnen antyder energisystem | `fit-analysis.js:19–50` | **Begreppsfel** | rätt siffra, fel innebörd |
| **FA-5** | Etiketten `30m TSS` gäller 30 sekunder | `index.html:121` | **Implementationsfel** | ren etikettbugg |
| **FA-6** | Passchemat anger absoluta watt | `sample-workout.json`, `js:1852–1868` | **Designfel** | pass ej portabla |
| **FA-7** | Egendefinierade fönster kolliderar | `fit-analysis.js:1370` | **Implementationsfel** | fönster visar fel värde |
| **FA-8** | Oanropbar `Base TSS`-kodväg | `fit-analysis.js:755, 858` | **Implementationsfel** | saknad funktion, färdig kod |
| **FA-9** | Konfigurationsblocket finns i två exemplar | `fit-analysis.js:19–50` och `1387–1418` | **Implementationsfel** | framtida divergens |

---

## FA-1 — Frihjulning bokförs som sensorbortfall

**Rad 13:** `MIN_POWER_DROPOUT: 30,`
**Rad 800:** `cleaned.push({ ...current, p: CONFIG.MIN_POWER_DROPOUT });`

### Vad koden gör

Varje nollvärde granskas:

- Har den positiv effekt **både före och efter** → interpoleras som medel av grannarna.
- I **alla andra fall** → ersätts med **30 W**.

Regeln träffar därför hela sammanhängande serier, eftersom första nollan ser en nolla framför
sig, de mellersta nollor åt båda håll, och sista en nolla bakom sig:

```
in:  200, 0, 200        ->  200, 200, 200        (interpolerat — rimligt)
in:  200, 0, 0, 0, 200  ->  200, 30, 30, 30, 200 (allt golvat)
```

### Varför det är fel

Detta är ett **heuristikfel**: ett antagande om vad data betyder, och antagandet är fel.

Sammanhängande nollor på cykel är nästan alltid **frihjulning** — utförsbackar, kurvor,
rullning i klunga, rödljus. Det är korrekt uppmätt data som säger att atleten inte
producerade någon effekt. Koden tolkar det som mätfel och uppfinner 30 W som aldrig
trampades.

Antagandet stämmer bara för *isolerade* nollor, och just dem hanterar koden redan rätt via
interpoleringen. Golvet på 30 W tillämpas alltså på precis de fall där heuristiken inte
gäller.

**Uppmätt.** 45 min, 250 W när atleten trampar, X sekunder frihjulning per minut, FTP 200:

| Frihjul/min | Verklig medeleffekt | Rapporterad NP (600 s) | Verklig TSS | Rapporterad TSS | Fel |
|---|---|---|---|---|---|
| 0 s | 250,0 W | 250 W | 117,2 | 117,1 | 0 % |
| 5 s | 229,2 W | 231,7 W | 98,5 | 100,6 | **+2,2 %** |
| 10 s | 208,3 W | 213,3 W | 81,4 | 85,3 | **+4,8 %** |
| 15 s | 187,5 W | 195,0 W | 65,9 | 71,3 | **+8,2 %** |
| 20 s | 166,7 W | 176,7 W | 52,1 | 58,5 | **+12,3 %** |
| 25 s | 145,8 W | 158,3 W | 39,9 | 47,0 | **+17,9 %** |
| 30 s | 125,0 W | 140,0 W | 29,3 | 36,7 | **+25,3 %** |
| 40 s | 83,3 W | 103,3 W | 13,0 | 20,0 | **+53,6 %** |

### Varför det är repots allvarligaste fel

**Felet växer med frihjulningen.** Trainerpass (noll frihjulning) mäts rätt; kuperade
landsvägspass och MTB blåses upp 10–25 %. Det betyder att felet **inte kan kalibreras bort** —
det förvränger jämförelsen *mellan* pass, vilket är hela poängen med TSS. Ett konstant fel
hade varit ofarligt; ett fel som varierar med passtyp är det inte.

Kvadreringen i TSS-formeln fördubblar dessutom effektfelet: +5,8 % i NP blir +12 % i TSS.

### Åtgärd

**Den pedagogiska poängen: lösningen är inte att välja ett bättre golvvärde.** 15 W eller
5 W vore lika fel, bara mindre. Poängen är att **noll är data**.

Ta bort golvet. Behåll interpoleringen av isolerade nollor — den är sund och löser det
problem heuristiken faktiskt var till för.

Vill man ändå kunna skilja äkta sensorbortfall från frihjulning krävs en **andra
datakanal**, för det går inte att avgöra ur effektserien ensam:

| Effekt | Kadens | Hastighet | Tolkning |
|---|---|---|---|
| 0 W | > 0 | > 0 | **sensorbortfall** — man trampar men mätaren registrerar inte |
| 0 W | 0 | > 0 | **frihjulning** — äkta nolla |
| 0 W | 0 | 0 | **stillastående** — äkta nolla |

Båda kanalerna finns i FIT-filen men läses aldrig in. Det är den riktiga lösningen, och den
kräver ingen ny fysiologi — bara två fält till från parsern.

---

## FA-2 — Täckningskravet slår ut hela analysen vid gles inspelning

**Rad 14:** `WINDOW_COVERAGE_THRESHOLD: 0.5 // Minimum coverage ratio for window averaging`
**Rad 837:** `if (windowPoints.length >= windowSec * CONFIG.WINDOW_COVERAGE_THRESHOLD) {`

### Vad koden gör

Ett fönster räknas bara om det innehåller minst `fönsterlängd × 0,5` datapunkter.

### Varför det är fel

Läs villkoret noga: `windowPoints.length >= windowSec * 0.5`. Vänsterledet är ett **antal
punkter**, högerledet är **halva fönsterlängden i sekunder**. Det är alltså inte ett
relativt täckningskrav utan ett **absolut krav på samplingsfrekvens: minst 0,5 punkter per
sekund**.

Kommentaren säger "coverage ratio" och konstantnamnet säger `COVERAGE_THRESHOLD` — men en
kvot jämför två storheter av samma slag. Här jämförs punkter med sekunder. **Det är den
klassiska enhetsförväxlingen**, och den är ett rent implementationsfel: den avsedda
modellen (relativ täckning) är rimlig, koden uttrycker bara något annat.

En helt komplett fil som spelats in glesare än varannan sekund uppfyller aldrig villkoret —
vilket är precis vad **smart recording** på Garmin- och Wahoo-enheter producerar under jämn
belastning.

**Uppmätt.** Samma 40-minuterspass, 600 s-fönster, olika inspelningstäthet:

| Sampling | Punkter | Fönster som räknas | NP (600 s) |
|---|---|---|---|
| 1 Hz | 2400 | 180 | 210 W |
| Var 2:a sekund | 1200 | 180 | 210 W |
| **Var 3:e sekund** | 800 | **0** | **N/A** |
| **Var 4:e sekund** | 600 | **0** | **N/A** |

### Varför det är särskilt otrevligt

Vid gränsen faller det inte gradvis — det faller **helt**. Samtliga fönster kastas, alla
TSS-rutor visar `N/A`, och användaren får ingen förklaring. Filen ser trasig ut trots att
den är felfri. Detta är det enda felet i repot som ger totalt bortfall i stället för en
skev siffra.

### Åtgärd

**Rätt fix beror på vad man vill uppnå, och de två alternativen skiljer sig i ambition:**

**1. Gör kvoten till en riktig kvot.** Jämför mot filens **egen** samplingsfrekvens i
stället för mot en sekund:

```
förväntat antal punkter = fönsterlängd × filens samplingsfrekvens
kräv: faktiskt antal ≥ 0,5 × förväntat
```

Nu betyder tröskeln vad namnet säger — "minst halva fönstret måste vara täckt" — och
fungerar för alla inspelningsfrekvenser.

**2. Resampla till 1 Hz före beräkningen (bättre).** Detta löser problemet vid roten.
Standard-NP är *definierad* på 1-sekundersdata; ett 30-sekunders rullande medelvärde
förutsätter jämnt spridda punkter. Med gles eller ojämn sampling räknar man i praktiken på
något annat än NP, oavsett hur tröskeln formuleras.

Alternativ 2 är vad kommersiella verktyg gör, och det har en extra fördel: efter resampling
blir samtliga fönsterberäkningar jämförbara mellan filer från olika enheter — vilket är en
förutsättning för att fönsterspektrumet (verktygets bästa idé) ska betyda samma sak för
alla pass.

---

## FA-3 — TSS-ackumuleringen planar aldrig ut

**Rad 907–930:** `calculateTSSAccumulation`, särskilt
**rad 926:** `const currentData = powerData.filter(p => p.t <= t);`
**rad 930:** `computeNP_by_time(currentData, ftp, ...)`

### Vad koden gör

Var 30:e sekund körs **hela** NP-beräkningen om från passets början fram till den tidpunkten,
och resultatet ritas som en kurva över tid.

### Varför det är fel

Kurvan är ingen löpande summa — varje punkt är en **fullständig omanpassning över allt som
hittills hänt**. En hård insats tidigt räknas därför om, om och om igen, mot ett växande
underlag, och fortsätter generera TSS-tillskott långt efter att den är över.

Formellt: när effekten efter insatsen är låg beter sig NP över ett prefix med `n` punkter
som `NP ∝ n^(−1/4)`. Då blir

```
TSS = (t/3600) · (NP/FTP)² · 100  ∝  t · t^(−1/2)  =  √t
```

Kurvan växer alltså som **roten ur tiden, för alltid** — även om atleten stannar helt.

**Uppmätt.** 3 min på 450 W, därefter 120 W. 120 W mot FTP 200 motsvarar 18 TSS/timme:

| Period | Verktygets tillskott | Korrekt för perioden | Uppblåsning |
|---|---|---|---|
| 5–15 min | +22,3 | 6,0 | **3,7×** |
| 15–30 min | +23,1 | 9,0 | **2,6×** |
| 30–45 min | +18,4 | 9,0 | **2,0×** |
| 45–60 min | +16,2 | 9,0 | **1,8×** |
| 60–90 min | +28,6 | 18,0 | **1,6×** |

### Varför det är ett modellfel

NP och TSS är definierade för **ett helt pass**, som en sammanfattning i efterhand. De är
inte definierade som funktioner av förfluten tid. Att tillämpa ett helhetsmått på varje
prefix av data är en kategoriförväxling — koden gör exakt det den ska, men måttet betyder
inte det man vill att det ska betyda.

Jämför: medelbetyget för en termin är väldefinierat, men "medelbetyget hittills" efter varje
prov är ett annat mått med andra egenskaper, och det går inte att lägga ihop delarna till
helheten.

### Åtgärd

**Bestäm först vilken fråga kurvan ska svara på.** De två rimliga är olika mått:

**1. "Hur snabbt ackumuleras stress just nu?"** → beräkna TSS **per fönster** i stället för
per prefix. Dela passet i intervall om t.ex. 60 s, räkna TSS för varje intervall isolerat,
och summera. Då blir kurvan en äkta löpande summa: varje minut bidrar med sin egen dos, en
gång, och kurvan planar ut när atleten slutar arbeta. Det är nästan säkert vad som var
avsett.

**2. "Vad är passets NP hittills?"** → behåll omanpassningen, men **rita NP, inte TSS**.
NP-över-prefix är ett meningsfullt mått (det är passets normaliserade effekt så här långt).
Det är multiplikationen med den växande tiden som skapar `√t`-driften.

**Vad som ändå är läsbart i dagens kurva:** dess **lutning**, och framför allt **avståndet
mellan de olika fönstrens kurvor**, som visar *när* i passet variabiliteten kom. De korta
fönstrens kurvor drar ifrån de långa exakt vid intervallblocken. Den informationen är
verklig och överlever felet — det är bara den absoluta nivån som inte går att tolka som
ackumulerad dos.

---

## FA-4 — Fönsternamnen antyder energisystem

**Rad 19–50:** nycklarna `SPRINT` (10 s), `VO2_MAX` (180 s), `THRESHOLD` (600 s),
`STANDARD` (30 s)

### Varför det är fel

Fönsterlängden är ett **lågpassfilter på effektsignalen**. Den väljer vilken *tidsskala av
variabilitet* som mäts — inte vilket energisystem som belastades.

Ett 10-sekundersfönster på ett fullständigt jämnt tempopass ger ändå en siffra i rutan
"TSS (Sprint)": uppmätt **60,7** på ett pass utan en enda sprint. Namnen inbjuder till
slutsatsen *"jag fick 60,7 i sprint-TSS, alltså belastade jag det anaeroba systemet"*. Det
följer inte.

Detta är ett begreppsfel: alla siffror är korrekt uträknade, men etiketterna påstår något
om dem som inte stämmer.

### Vad konstruktionen faktiskt mäter — och varför det är bra

Detta är verktygets bästa idé, och den förtjänar att beskrivas rätt:

- **Kort fönster (10 s)** — topparna överlever utjämningen och slår igenom i `⁴√(medel(x⁴))`.
  NP blir hög.
- **Långt fönster (600 s)** — topparna slätas ut. NP konvergerar mot **medeleffekten**.

Alltså: **avståndet mellan kort och långt fönster mäter hur ojämnt passet var.**

Uppmätt på tre pass med nästan identisk medeleffekt (~175–181 W mot FTP 200):

| Pass | TSS 10 s | TSS 600 s | **Spridning** |
|---|---|---|---|
| Jämnt, 45 min @ 180 W | 60,7 | 60,7 | **0** |
| 4×4 tröskel | 66,3 | 58,2 | **8** |
| Spikigt, 15 s @ 400 / 45 s @ 100 | 125,5 | 57,4 | **68** |

Det jämna och det spikiga passet har samma aeroba dos (~58–61) men det spikiga kostar **mer
än dubbelt** i den korta änden. Konventionell analys — medeleffekt och en enda TSS-siffra —
kan inte skilja dem åt.

### Åtgärd

**Byt namn till neutrala beteckningar**: `TSS@10s`, `TSS@30s`, `TSS@600s`. De påstår
ingenting de inte kan belägga.

**Lägg sedan till den siffra man faktiskt tolkar**: ett variabilitetsindex, alltså
skillnaden mellan kortaste och längsta fönstret, med en läsregel:

| Spridning `TSS@10s − TSS@600s` | Tolkning |
|---|---|
| ≈ 0 | Jämnt distans-/tempopass. Dosen är aerob. |
| 5–20 | Strukturerade långa intervaller. Måttlig variabilitet. |
| > 40 | Kort, hård, intermittent belastning. Anaerob kostnad dominerar. |

Detta är i praktiken en generalisering av Variability Index (`NP/medeleffekt`) från ett tal
till ett **spektrum över tidsskalor** — strikt mer informativt. Att den storheten inte visas
någonstans i gränssnittet, trots att all data för den redan beräknas, är verktygets största
missade möjlighet.

---

## FA-5 — Etiketten `30m TSS (Endurance)` gäller ett 30-**sekunders**fönster

**`fit-analysis/index.html:121`:** `<div class="stat-label">30m TSS (Endurance)</div>`
mot **`fit-analysis.js:44`:** `STANDARD: { seconds: 30, ... }`

### Varför det är fel

`STANDARD` är **30 sekunder** — Coggans standardfönster, och det **enda i uppsättningen som
motsvarar en publicerad definition**. Etiketten läser det som 30 *minuter* och kallar det
"Endurance".

Konfigurationens egen etikett (`TSS (Standard)`, rad 47) är korrekt; den statiska
HTML-etiketten är det inte — och det är den användaren ser, eftersom rutorna byggs från HTML
vid sidladdning.

Ren implementationsbugg: en textsträng som inte stämmer med den konstant den beskriver.

### Varför den lilla buggen spelar roll

Följden är att den **enda ruta vars siffra går att jämföra med andra verktyg** — Strava,
TrainingPeaks, WKO — är den som ser ut att vara något helt annat. Användaren letar efter
"sin TSS" och hittar tre rutor med okända fönsterlängder plus en som påstår sig vara
30-minuters uthållighet.

### Åtgärd

Rätta etiketten till `30s TSS (Standard)` och markera den som **referensvärdet** — det är
den siffra som ska jämföras utåt. Övriga fönster är verktygets egen utvidgning och saknar
motsvarighet någon annanstans.

---

## FA-6 — Passchemat anger absoluta watt

**`fit-analysis/sample-workout.json:9, 14, 18`:** `"targetWatt": 150 / 250 / 100`
**`fit-analysis.js:1852, 1857, 1863, 1868`:** `targetWatt < 1` i valideringen

### Vad koden gör

Alla passmål anges i absoluta watt. Valideringen kräver `targetWatt ≥ 1`.

### Varför det är fel

Passens **mål** är absoluta, men passens **poängsättning** sker mot FTP. Ändrar man FTP
räknas TSS om — men passet skalar inte. Ett pass är därmed knutet till en enskild atlet vid
en enskild tidpunkt.

Exempelpasset visar problemet direkt. `4x4 Threshold` föreskriver 250 W mot verktygets
standard-FTP på 200 W:

```
250 / 200 = 125 % av FTP
```

Det är **VO2max-intensitet, inte tröskel**. Passet motsäger sitt eget namn så snart FTP inte
råkar vara just 250 W.

Detta är ett **designfel i datastrukturen**, inte en bugg: koden hanterar `targetWatt`
felfritt. Fältet är bara fel storhet att lagra.

**Följdproblem:** kravet `targetWatt ≥ 1` gör att **vila på 0 W inte går att uttrycka**.
Frihjulning och stillastående vila — helt vanligt i verkliga intervallpass — måste kodas som
minst 1 W.

### Åtgärd

**Byt till relativa mål:**

```
"targetPercent": 0.95      i stället för      "targetWatt": 250
```

och räkna om till watt vid visning.

Varför detta är rätt och inte bara bekvämt: **TSS är per definition redan normaliserad mot
FTP.** Ett pass som beskrivs relativt får därför en TSS som är *invariant* — samma pass ger
samma planerade TSS för alla atleter, vilket är precis vad man vill när man delar eller
återanvänder pass. Med absoluta watt varierar den planerade dosen med vem som tittar, vilket
gör siffran meningslös som jämförelse.

Tillåt samtidigt `targetPercent: 0` så att äkta vila går att uttrycka. Notera att detta
måste göras **tillsammans med FA-1** — se *Beroenden* nedan.

---

## FA-7 — Egendefinierade TSS-fönster kolliderar

**Rad 1370:** `displayKey: '1Minute',` i `addNewTSSConfig`

### Vad koden gör

Varje nytt fönster får `displayKey: '1Minute'` hårdkodat, oavsett vald fönsterlängd.

### Varför det är fel

`elementId` blir unikt (`tss${newKey}` med tidsstämpel), men **`displayKey` är nyckeln som
resultaten slås upp med**:

```
tssResults.windows[config.displayKey]
```

Två egendefinierade fönster skriver därför till samma post i resultatobjektet. Den andra
skriver över den första, och **båda rutorna visar det sistnämnda fönstrets värde** — med
olika etiketter.

Ett fönster kan alltså tyst visa ett annat fönsters siffra. Ren implementationsbugg: en
identifierare som ska vara unik är konstant.

### Åtgärd

Härled `displayKey` från fönsterlängden, precis som `elementId` härleds från nyckeln:

```
displayKey: `w${newSeconds}`
```

Den bredare lärdomen: **när ett fält är en identifierare måste det genereras, aldrig
hårdkodas.** Att `elementId` genereras men `displayKey` inte gör det tyder på att den ena
raden kopierades från en mall och den andra glömdes.

---

## FA-8 — Oanropbar kodväg för "Base TSS"

**Rad 858:** `if (w === -1) {` i `computeNP_by_time`
**Rad 755:** `if (windowType === 'BASE') {` i `updateTSSElement`

### Vad koden gör

`computeNP_by_time` har en specialgren för fönstervärdet `−1` som räknar TSS ur enkel
medeleffekt. `updateTSSElement` har en fallback-text för fönstertypen `'BASE'`.

### Varför det är fel

Ingen konfiguration använder sentinelvärdet `−1`, och `'BASE'` finns inte bland nycklarna i
`TSS_CONFIGS`. **Båda grenarna är onåbara.** Död kod som ser ut som fungerande funktionalitet.

### Varför det är värt att åtgärda snarare än radera

Storheten grenarna skulle räkna — **TSS ur medeleffekt** — är inte skräp. Den är den rätta
**baslinjen** att jämföra fönsterspektrumet mot.

Tänk igenom varför: NP med ett oändligt långt fönster **är** medeleffekten. Base TSS är
alltså spektrumets naturliga ändpunkt — den nedre asymptoten som alla fönstervärden
konvergerar mot. Utan den saknar spektrumet sin nollpunkt, och variabilitetsindexet i
[FA-4](#fa-4--fönsternamnen-antyder-energisystem) blir svårare att tolka.

### Åtgärd

Lägg till en `BASE`-post i `TSS_CONFIGS` med `seconds: -1`, så att den befintliga koden
faktiskt körs. Det är förmodligen den billigaste förbättringen i hela repot: färdig,
testad logik som bara saknar en konfigurationsrad för att bli synlig.

---

## FA-9 — Konfigurationsblocket finns i två exemplar

**Rad 19–50:** `let TSS_CONFIGS = { ... }`
**Rad 1387–1418:** identiskt block inuti `resetTSSConfigs()`

### Vad koden gör

Standardkonfigurationen för de fyra fönstren är skriven två gånger, ordagrant.

### Varför det är fel

Blocken måste hållas synkade för hand. Ändrar man fönsterlängd, färg eller etikett på ett
ställe men inte det andra beter sig verktyget **olika före och efter att användaren tryckt
"reset"** — ett fel som är svårt att upptäcka eftersom det bara uppträder efter en
användarhandling.

Det förvärrar också [FA-4](#fa-4--fönsternamnen-antyder-energisystem): namnbytet måste göras
på två ställen.

### Åtgärd

Bryt ut standardkonfigurationen till en egen konstant och låt både initieringen och
`resetTSSConfigs()` läsa från den. Kopiera vid tilldelning så att `reset` verkligen
återställer i stället för att dela referens.

Principen: **en standardinställning ska ha exakt en definition.** Att "reset" behöver samma
data som initieringen är ett argument för att dela källan, inte för att duplicera den.

---

## Beroenden mellan felen

**FA-1 → FA-6.** Båda förbjuder 0 W, från olika håll. Tar man bort `targetWatt ≥ 1` i
valideringen utan att samtidigt ta bort 30 W-golvet får planerade vilopass **ändå** 30 W i
beräkningen — man har då gjort en ändring som ser ut att fungera men inte gör någon skillnad
i utfallet. De hör ihop och bör åtgärdas tillsammans.

**FA-4 → FA-8 → FA-9.** Namnbytet (FA-4) bör göras samtidigt som `BASE`-posten läggs till
(FA-8), eftersom båda rör samma konfigurationsblock — och blocket är duplicerat (FA-9), så
FA-9 bör göras **först** för att slippa göra allt två gånger.

**FA-2 står ensam** och är billigast att verifiera: ladda upp en fil inspelad med smart
recording och se att samtliga TSS-rutor blir `N/A`.

**Rekommenderad ordning:** FA-2 och FA-1 först (de förvanskar siffror som används), sedan
FA-9 → FA-4 → FA-8 som ett paket (konfigurationen), sedan FA-5 och FA-7 (rena buggar), sist
FA-3 och FA-6 (kräver att man bestämmer vad måttet respektive schemat ska betyda).

---

## Sammanfattning: modell mot implementation

| | Fel |
|---|---|
| **Modellfel** — kräver att man ändrar vad som räknas | FA-3 (helhetsmått tillämpat på prefix) |
| **Heuristikfel** — antagandet om data håller inte | FA-1 (noll tolkas som bortfall) |
| **Implementationsfel** — ren buggfix | FA-2 (enhetsförväxling), FA-5 (etikett), FA-7 (konstant identifierare), FA-8 (död kod), FA-9 (duplicerad konfiguration) |
| **Begreppsfel** | FA-4 (fönsternamn) |
| **Designfel** | FA-6 (absoluta watt i schemat) |

**Det viktigaste att förstå:** grundkedjan är korrekt. Rullande medelvärde → fjärde
potensen → medel → fjärde roten → `TSS = (t/3600)·(NP/FTP)²·100` är exakt Coggans
definition, algebraiskt riktigt implementerad. Och generaliseringen — fönsterlängden som fri
parameter — är repots bästa idé.

Fem av nio fel är **rena buggfixar** som inte rör modellen alls. Det allvarligaste felet
(FA-1) är inte heller ett modellfel utan ett felaktigt antagande om vad nollor i data
betyder. Bara ett fel (FA-3) kräver att man tänker om vad måttet ska mäta.

Med andra ord: verktyget är närmare rätt än fellistans längd antyder. Det som saknas mest
är inte korrigeringar utan **att göra den goda idén synlig** — variabilitetsindexet i FA-4
finns redan uträknat, men visas ingenstans.

## Koppling till övriga verktyg

Passchemat (FA-6) uttrycker samma familj av pass som [`wbal/`](09-fel-wbal.md) har som
hårdkodade mallar — det ena i data, det andra i kod, utan att veta om varandra. Att låta
intervalloptimeraren generera passfiler i detta schema är den uppenbara sammankopplingen,
och den skulle ge `wbal/` något det saknar helt: en väg från föreskrivet pass till
uppföljning mot verkligt utfall.
