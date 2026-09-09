# Fellista: `wbal/` och `fit-analysis/`

Alla fel i de två beräkningsverktygen, utbrutna ur [07 — Felkatalog](07-felkatalog.md)
till en fristående arbetslista med fil- och radhänvisningar.

**Varför just dessa två.** Samtliga fel som *tyst förvanskar siffror* eller *ger felaktiga
träningsföreskrifter* sitter här. `power-curve/` och `running/` har bara begrepps- och
robusthetsfel — de ligger kvar i [07](07-felkatalog.md).

Berörda filer:

| Fil | Rader med fel | Fel |
|---|---|---|
| `fit-analysis/fit-analysis.js` | 13, 14, 755, 800, 837, 858, 907–930, 1370, 1852–1868 | A1, A2, A3, C2, D4, D5, D6 |
| `fit-analysis/index.html` | 121 | C3 |
| `fit-analysis/sample-workout.json` | 9, 14, 18 | D4 |
| `wbal/script.js` | 25, 60–61, 77/98/106/125, 162–163, 167–169 | B1, B2, B3, D7 |
| `wbal/index.html` | 17, 33 | B4, B3 |

**Inget är åtgärdat.** Siffrorna är uppmätta genom att köra koden, inte uppskattade.

---

## Prioritetsordning

Båda verktygen sammanvägt, efter hur mycket felet påverkar tal som faktiskt används:

| # | ID | Verktyg | Fel | Storlek |
|---|---|---|---|---|
| 1 | **A1** | fit-analysis | Frihjulning bokförs som sensorbortfall | +2 till +54 % TSS, ojämnt fördelat |
| 2 | **A2** | fit-analysis | Täckningskravet slår ut hela analysen | alla värden `N/A` vid gles inspelning |
| 3 | **B2** | wbal | Bottennivån kontrolleras aldrig | ogenomförbara pass, omarkerade |
| 4 | **B1** | wbal | Binärsökningen klipper tyst | `2×15 min` får fel svar |
| 5 | **A3** | fit-analysis | Ackumuleringen planar aldrig ut | 1,6–3,7× för stort tillskott |
| 6 | **B3** | wbal | Återhämtningsfaktorns asymptot | föreskriver systematiskt för lågt |
| 7 | **B4** | wbal | CP och FTP behandlas som samma | förstärker 6 |
| 8 | **C2** | fit-analysis | Fönsternamn antyder energisystem | rätt siffra, fel innebörd |
| 9 | **C3** | fit-analysis | `30m TSS` gäller ett 30-sekundersfönster | rätt siffra, fel innebörd |
| 10 | **D4** | fit-analysis | Absoluta watt i passchemat | pass ej portabla mellan atleter |
| 11 | **D5** | fit-analysis | Egendefinierade fönster kolliderar | fönster visar annat fönsters värde |
| 12 | **D6** | fit-analysis | Oanropbar `Base TSS`-kodväg | saknad funktion, färdig kod |
| 13 | **D7** | wbal | `8×(8×20s)` är 64 repetitioner | orimlig mall |

---

# `fit-analysis/`

## A1 — Frihjulning bokförs som sensorbortfall

**`fit-analysis/fit-analysis.js:13`** — `MIN_POWER_DROPOUT: 30`
**`fit-analysis/fit-analysis.js:800`** — `cleaned.push({ ...current, p: CONFIG.MIN_POWER_DROPOUT });`

**Vad koden gör.** Nollvärden med positiv effekt *både före och efter* interpoleras. **Alla
andra** nollor sätts till 30 W. Regeln träffar därför hela sammanhängande serier, eftersom
första nollan ser en nolla framför sig, de mellersta nollor åt båda håll, och sista en
nolla bakom sig:

```
in:  200, 0, 200        ->  200, 200, 200        (interpolerat — rimligt)
in:  200, 0, 0, 0, 200  ->  200, 30, 30, 30, 200 (allt golvat)
```

**Varför det är fel.** Sammanhängande nollor på cykel är nästan alltid **frihjulning** —
utförsbackar, kurvor, klunga, rödljus. Det är korrekt uppmätt data. Koden uppfinner 30 W
som aldrig trampades. Bortfall och frihjulning kan inte skiljas åt med enbart effektdata;
det kräver kadens eller hastighet, som finns i FIT-filen men aldrig läses in.

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

**Varför det inte går att kompensera bort.** Felet växer med frihjulningen. Trainerpass
mäts rätt; kuperade landsvägspass och MTB blåses upp 10–25 %. Det förvränger alltså
jämförelsen *mellan* pass, vilket är hela poängen med TSS. Kvadreringen i TSS-formeln
fördubblar effektfelet.

**Rätt beteende.** Behåll interpoleringen av isolerade nollor. Låt sammanhängande nollor
vara nollor.

---

## A2 — Täckningskravet slår ut hela analysen vid gles inspelning

**`fit-analysis/fit-analysis.js:14`** — `WINDOW_COVERAGE_THRESHOLD: 0.5`
**`fit-analysis/fit-analysis.js:837`** — `if (windowPoints.length >= windowSec * CONFIG.WINDOW_COVERAGE_THRESHOLD)`

**Vad koden gör.** Ett fönster räknas bara om det innehåller minst
`fönsterlängd × 0,5` datapunkter.

**Varför det är fel.** Namnet antyder ett *relativt* täckningskrav. Villkoret är i själva
verket ett **absolut krav på samplingsfrekvens: minst 0,5 punkter per sekund**. En helt
komplett fil som spelats in glesare än varannan sekund uppfyller det aldrig — vilket är
precis vad **smart recording** på Garmin- och Wahoo-enheter producerar under jämn
belastning.

**Uppmätt.** Samma 40-minuterspass, 600 s-fönster, olika inspelningstäthet:

| Sampling | Punkter | Fönster som räknas | NP (600 s) |
|---|---|---|---|
| 1 Hz | 2400 | 180 | 210 W |
| Var 2:a sekund | 1200 | 180 | 210 W |
| **Var 3:e sekund** | 800 | **0** | **N/A** |
| **Var 4:e sekund** | 600 | **0** | **N/A** |

**Konsekvens.** Vid gränsen faller det inte gradvis — det faller **helt**. Samtliga fönster
kastas, alla TSS-rutor visar `N/A`, och användaren får ingen förklaring. Filen ser trasig
ut trots att den är felfri. Enda felet i listan som ger totalt bortfall i stället för en
skev siffra.

**Rätt beteende.** Mät täckning mot filens **egen** samplingsfrekvens, eller resampla till
1 Hz före beräkningen. Det senare är vad kommersiella verktyg gör och vad standard-NP
förutsätter.

---

## A3 — TSS-ackumuleringen planar aldrig ut

**`fit-analysis/fit-analysis.js:907–930`** — `calculateTSSAccumulation`, särskilt
rad 926 `const currentData = powerData.filter(p => p.t <= t);` och rad 930 som kör hela
`computeNP_by_time` på nytt.

**Vad koden gör.** Var 30:e sekund körs **hela** NP-beräkningen om från passets början fram
till den tidpunkten.

**Varför det är fel.** Kurvan är ingen löpande summa — varje punkt är en fullständig
omanpassning över allt som hittills hänt. En hård insats tidigt räknas om mot ett växande
underlag och fortsätter generera TSS-tillskott långt efter att den är över. Formellt:
`NP ∝ n^(−1/4)` när effekten därefter är låg, vilket ger

```
TSS = (t/3600)·(NP/FTP)²·100  ∝  t · t^(−1/2)  =  √t
```

Kurvan växer alltså som roten ur tiden, för alltid — även om atleten stannar helt.

**Uppmätt.** 3 min på 450 W, därefter 120 W. 120 W mot FTP 200 = 18 TSS/timme:

| Period | Verktygets tillskott | Korrekt för perioden | Uppblåsning |
|---|---|---|---|
| 5–15 min | +22,3 | 6,0 | **3,7×** |
| 15–30 min | +23,1 | 9,0 | **2,6×** |
| 30–45 min | +18,4 | 9,0 | **2,0×** |
| 45–60 min | +16,2 | 9,0 | **1,8×** |
| 60–90 min | +28,6 | 18,0 | **1,6×** |

**Vad som ändå är läsbart.** Kurvans **lutning**, och framför allt **avståndet mellan de
olika fönstrens kurvor**, som visar *när* i passet variabiliteten kom. Den absoluta nivån
går inte att tolka som ackumulerad dos.

---

## C2 — Fönsternamnen antyder energisystem

**`fit-analysis/fit-analysis.js:19–50`** — `SPRINT` (10 s), `VO2_MAX` (180 s),
`THRESHOLD` (600 s), `STANDARD` (30 s)
**`fit-analysis/fit-analysis.js:1387–1418`** — samma block duplicerat i `resetTSSConfigs`

**Varför det är fel.** Fönsterlängden är ett **lågpassfilter**. Den väljer vilken
*tidsskala av variabilitet* som mäts — inte vilket energisystem som belastades. Ett
10-sekundersfönster på ett fullständigt jämnt tempopass ger ändå en siffra i rutan
"TSS (Sprint)": uppmätt **60,7** på ett pass utan en enda sprint.

Namnen inbjuder till slutsatsen "jag fick 60,7 i sprint-TSS, alltså belastade jag det
anaeroba systemet". Det följer inte.

**Rätt beteende.** Neutrala namn (`TSS@10s`, `TSS@30s`, `TSS@600s`) plus ett härlett
**variabilitetsindex** — skillnaden mellan kortaste och längsta fönstret — som den siffra
man faktiskt tolkar. Det är den storheten konstruktionen bär, och den saknas i
gränssnittet.

**Anmärkning.** Blocket finns i två exemplar (rad 19 och rad 1387) som måste hållas
synkade för hand. En ändring på ett ställe men inte det andra ger olika beteende före och
efter att användaren tryckt "reset".

---

## C3 — Etiketten 30m TSS (Endurance) gäller ett 30-sekundersfönster

**`fit-analysis/index.html:121`** — `<div class="stat-label">30m TSS (Endurance)</div>`
mot **`fit-analysis.js:44`** — `STANDARD: { seconds: 30, ... }`

`STANDARD` är 30 **sekunder** — Coggans standardfönster, och det enda i uppsättningen som
motsvarar en publicerad definition. Etiketten läser det som 30 minuter och kallar det
"Endurance". Konfigurationens egen etikett (`TSS (Standard)`) är korrekt; HTML-etiketten
är det inte, och det är den användaren ser.

Följden: den **enda ruta vars siffra går att jämföra med andra verktyg** är den som ser ut
att vara något helt annat.

---

## D4 — Passchemat anger absoluta watt

**`fit-analysis/sample-workout.json:9, 14, 18`** — `"targetWatt": 150 / 250 / 100`
**`fit-analysis/fit-analysis.js:1852, 1857, 1863, 1868`** — `targetWatt < 1` i valideringen

Passens **mål** är absoluta watt, men passens **poängsättning** sker mot FTP. Ändrar man
FTP räknas TSS om — men passet skalar inte. Ett pass är därmed knutet till en enskild
atlet vid en enskild tidpunkt.

Exempelpasset visar det direkt: `4x4 Threshold` föreskriver 250 W mot standard-FTP 200 W,
alltså **125 % av FTP** — VO2max-intensitet, inte tröskel. Passet motsäger sitt eget namn
så snart FTP inte råkar vara 250 W.

Kravet `targetWatt ≥ 1` gör dessutom att **vila på 0 W inte går att uttrycka**. Tillsammans
med A1, som ändå hade golvat varje nolla till 30 W, förbjuder två oberoende mekanismer
samma fullt verkliga träningstillstånd.

**Rätt beteende.** Relativa mål (`targetPercent: 0.95`), omräknade till watt vid visning.
Då blir planerad TSS invariant mot FTP — vilket den bör vara, eftersom TSS per definition
redan är normaliserad mot FTP.

---

## D5 — Egendefinierade TSS-fönster kolliderar

**`fit-analysis/fit-analysis.js:1370`** — `displayKey: '1Minute',` i `addNewTSSConfig`

Varje nytt fönster får `displayKey: '1Minute'` hårdkodat, oavsett vald fönsterlängd.
`elementId` blir unikt, men `displayKey` är nyckeln som resultaten slås upp med. Två
egendefinierade fönster skriver därför till samma post, och **båda rutorna visar det
sistnämnda fönstrets värde** — med olika etiketter. Ett fönster kan alltså tyst visa ett
annat fönsters siffra.

---

## D6 — Oanropbar kodväg för "Base TSS"

**`fit-analysis/fit-analysis.js:858`** — `if (w === -1) {` i `computeNP_by_time`
**`fit-analysis/fit-analysis.js:755`** — `if (windowType === 'BASE') {` i `updateTSSElement`

Ingen konfiguration använder sentinelvärdet `−1`, och `'BASE'` finns inte bland nycklarna
i `TSS_CONFIGS`. Båda grenarna är onåbara.

Storheten de skulle räkna — TSS ur medeleffekt — är samtidigt den rätta **baslinjen** att
jämföra fönsterspektrumet mot. Det är funktionalitet som saknas i gränssnittet trots att
koden för den redan finns.

---

# `wbal/`

## B2 — Endast sluttillståndet kontrolleras, aldrig bottennivån

**`wbal/script.js:167`** — `const finalWbal = simulateWorkout(...)`
**`wbal/script.js:169`** — `if (Math.abs(finalWbal - targetWbal) < 100)`

**Vad koden gör.** Simuleringen returnerar W′bal **vid passets slut**. Ingenting registrerar
hur lågt W′bal var som lägst under passet.

**Varför det är fel.** För de flesta mallarna spelar det ingen roll: med lika långa
arbetsintervall ligger bottennivån i slutet av sista repetitionen, så slutvärdet *är*
minimum. Men i pyramiderna ligger det längsta arbetsblocket i **mitten**, och då inträffar
bottennivån mitt i passet.

**Uppmätt, defaultvärden** (CP 200 W, W′ 15 kJ, τ 180 s, mål 30 %). De enda två mallar där
minimum skiljer sig från slutvärdet:

| Pass | Slut-W′bal | Lägsta W′bal | Skillnad |
|---|---|---|---|
| Pyramid 1-2-3-4-3-2-1 | 4378 J | 3812 J | 566 J = **3,8 % av W′** |
| Pyramid 2-4-6-4-2 | 4583 J | 3771 J | 812 J = **5,4 % av W′** |

Ber man om 30 % kvar får man alltså ned till ~25 % i botten, utan att det syns.

**När det blir ett riktigt fel.** Sänker användaren τ under ~145 s — tillåtet, gränssnittets
minimum är 60 s — går bottennivån **under noll** medan slutvärdet fortfarande når målet.
Passet ser då ut som en normal, ej klippt lösning på 110–120 % av CP men är ogenomförbart.
Genomsökning av CP 150–350 W, W′ 6–30 kJ, τ 60–400 s, mål 10–30 % ger **168 sådana fall**,
samtliga i de två pyramidmallarna, med bottennivåer från −18 J till −4272 J:

| CP | W′ | τ | Mål | Föreskrivet | Lägsta W′bal | Slut-W′bal |
|---|---|---|---|---|---|---|
| 180 W | 8 kJ | 60 s | 20 % | 197 W (110 %) | **−158 J** | 1769 J ✓ |
| 180 W | 15 kJ | 60 s | 10 % | 217 W (120 %) | **−2755 J** | 1438 J ✓ |
| 150 W | 10 kJ | 105 s | 10 % | 168 W (112 %) | **−42 J** | 1084 J ✓ |

**Rätt beteende.** Genomförbarhet är ett villkor på `min(W′bal) > 0` över hela passet;
slutvärdet är ett doseringsmål. Båda behövs — de mäter olika saker.

---

## B1 — Binärsökningen klipper tyst vid intervallgränserna

**`wbal/script.js:162–163`** — `let minPower = CP * 1.05;` / `let maxPower = CP * 1.50;`

**Vad koden gör.** Ligger lösningen utanför 1,05–1,50 × CP returneras **gränsvärdet**, utan
markering — i samma format och med samma auktoritet som ett äkta svar.

**Uppmätt, defaultvärden.** Kolumnen *sant svar* är lösningen med vidgat sökintervall
(0,5–4 × CP):

| Pass | Föreskrivet | % CP | Slut-W′bal | Sant svar | Bedömning |
|---|---|---|---|---|---|
| 3×8 min | 210 W | 105 % | 4425 J | 210 W (105 %) | klippt, men sammanfaller |
| 4×6 min | 211 W | 105 % | 4219 J | 211 W (105 %) | klippt, men sammanfaller |
| 2×10 min | 210 W | 105 % | 4947 J | 210 W (105 %) | klippt, men sammanfaller |
| **2×15 min** | **210 W** | **105 %** | **−155 J** | **207 W (103 %)** | **fel svar** |

Klippningen **biter** bara när den sanna lösningen ligger utanför intervallet, och bland de
20 mallarna gäller det enbart `2×15 min`. För de tre övriga sammanfaller gränsvärdet med
rätt svar — de är klippta men råkar ha rätt.

**Varför `2×15 min` ändå är allvarligt.** Vid de föreskrivna 210 W landar W′bal på
**−155 J**: förrådet tar slut innan passet gör det, atleten kan inte fullfölja. Verktyget
rekommenderar ett pass som enligt dess egen modell är ogenomförbart, omarkerat.

**Läsregel tills det är åtgärdat.** Exakt 105 % eller 150 % betyder att sökningen tog slut,
inte nödvändigtvis att svaret är fel. Kontrollera separat.

---

## B3 — Återhämtningsfaktorn sitter på fel storhet

**`wbal/script.js:60–61`** — `calculateWPrimeRecovery`, `... * recoveryFactor`
**`wbal/script.js:77, 98, 106, 125`** m.fl. — `const recoveryFactor = (CP - restPower) / CP;`
(samma uttryck upprepat på sex ställen, ett per simuleringsvariant)
**`wbal/index.html:33`** — `<input type="number" id="tau" value="180" min="60" max="600">`

**Vad som är rätt tänkt.** Att vilointensiteten spelar roll är korrekt, och faktorns
ändpunkter stämmer: vila på 0 W ger faktor 1,0, vila på CP ger faktor 0 — ligger man på CP
återhämtar man ingenting.

**Varför det ändå är fel.** I Skibas modell påverkar vilointensiteten **τ**, alltså
*hastigheten*. Här multipliceras den på *mängden*, vilket ger en asymptot som inte finns i
verkligheten:

> Med återhämtningsfaktor 0,5 kan högst **halva** underskottet någonsin återhämtas,
> hur lång vilan än är.

**Uppmätt.** W′ = 15 kJ, W′bal = 6 kJ (underskott 9 kJ), vila på 0,5 × CP:

| Vilotid | W′bal efter |
|---|---|
| 60 s | 7 276 J |
| 180 s | 8 845 J |
| 600 s | 10 339 J |
| 1 timme | 10 500 J |
| **10 timmar** | **10 500 J** ← taket |

Taket är `W′bal + faktor × underskott`. Efter tio timmar står förrådet still på 70 % av
fullt.

**Konsekvens.** Pass med långa vilor får systematiskt för låg föreskriven effekt. Samtliga
20 mallar hamnar på 105–122 % av CP, vilket är för lågt för de korta anaeroba passen —
klassiska 30/30-pass körs väsentligt hårdare än de 119 % verktyget föreslår för `20×30s`.

**τ-defaulten förstärker det.** Skibas anpassning `τ = 546·e^(−0,01·D_CP) + 316` ger
typiskt **300–500+ s**. Verktyget använder 180 s. Att exponera τ är rimligt — den varierar
individuellt och är svår att mäta — men defaultvärdet ligger under det modellen förutsäger,
och `min="60"` öppnar dessutom för B2.

**Rätt beteende.** Låt vilointensiteten styra τ (`τ_effektiv = τ / faktor`, eller Skibas
egen anpassning). Då bevaras både riktningen och den korrekta asymptoten mot fullt förråd.

---

## B4 — CP och FTP behandlas som samma sak

**`wbal/index.html:17`** — `<label for="cp">CP (Critical Power / FTP)</label>`

**Varför det är fel.** De är olika storheter: **FTP** definieras protokollmässigt, typiskt
95 % av ett 20-minuterstest; **CP** definieras matematiskt som modellens asymptot och ligger
typiskt **något över** FTP.

**Konsekvensen är enkelriktad.** Matar man in FTP där modellen vill ha CP blir taket för
lågt. Då blir `(P − CP)` för stort i varje arbetsintervall, W′-förbrukningen överskattas,
och binärsökningen kompenserar med **lägre** föreskriven effekt. Felet pekar åt samma håll
som B3 och förstärker det.

**Vad som borde användas.** TP från `power-curve/` är exakt den CP modellen efterfrågar.
De två verktygen är gjorda för att hänga ihop — det står bara ingenstans, och inget värde
förs över.

---

## D7 — Mallen `8×(8×20s)` är inte ett genomförbart pass

**`wbal/script.js:25`** — `{ name: "8×(8×20s)", sets: 8, reps: 8, work: 20, rest: 10, setRest: 180, ... }`

8 set × 8 repetitioner = **64 repetitioner**, och `calculateWorkoutStats` räknar fram
**51,7 minuter** total tid. Klassisk tabata är **ett** set om 8×20/10.

Att binärsökningen ändå returnerar ett snyggt svar (243 W, 122 % av CP) illustrerar B1 och
B2: verktyget uttalar sig lika självsäkert om ett orimligt pass som om ett rimligt.

---

## Beroenden mellan felen

Tre par måste åtgärdas ihop, annars maskerar de varandra:

- **B3 → B4.** Båda får föreskriven effekt att bli för låg. Rättar man bara den ena
  kvarstår halva biasen och ser ut som ett kvarvarande modellfel.
- **B1 → B2.** Klippningen döljer att bottennivån aldrig kontrolleras: `2×15 min` ser ut
  som ett klippningsfel men är i själva verket ett genomförbarhetsfel. Fixar man bara
  sökintervallet får man ett svar som fortfarande kan vara ogenomförbart.
- **A1 → D4.** Båda förbjuder 0 W. Tar man bort `targetWatt ≥ 1` utan att ta bort
  30 W-golvet får planerade vilopass ändå 30 W i beräkningen.

**A2 står ensam** och är billigast att verifiera: ladda upp en fil inspelad med smart
recording och se att samtliga TSS-rutor blir `N/A`.
