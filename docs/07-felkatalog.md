# Felkatalog

Detaljerad beskrivning av varje fel: vad koden gör, varför det är fel, hur man
återskapar det, och hur stort det är. **Inget är åtgärdat** — det här dokumentet
beskriver bara.

Varje siffra nedan är uppmätt genom att köra repots egen kod, inte uppskattad.

Allvarlighetsgrad:

- **A — förvanskar tyst siffror som används.** Verktyget visar ett tal som ser rimligt
  ut men är fel, utan någon indikation.
- **B — ger felaktiga föreskrifter.** Verktyget rekommenderar träning som inte stämmer.
- **C — rätt siffra, fel namn.** Beräkningen är korrekt men presenteras som något den inte är.
- **D — robusthet och underhåll.** Trasigt i kantfall, eller framtida fällor.

---

## A1 — Frihjulning bokförs som sensorbortfall

**Var:** `cleanPowerData`, konstanten `MIN_POWER_DROPOUT = 30`.

**Vad koden gör.** Varje nollvärde i effektserien granskas:

- Har den positiv effekt **både före och efter** → interpoleras som medel av grannarna.
- I **alla andra fall** → ersätts med **30 W**.

Regeln träffar därför inte bara enstaka glapp. En sammanhängande serie nollor får
alla värden satta till 30 W, eftersom den första nollan ser en nolla framför sig, de
mellersta ser nollor åt båda håll, och den sista ser en nolla bakom sig:

```
in:  200, 0, 200            ->  200, 200, 200      (interpolerat — rimligt)
in:  200, 0, 0, 0, 200      ->  200, 30, 30, 30, 200   (allt golvat)
```

**Varför det är fel.** På cykel är sammanhängande nollor nästan alltid **frihjulning** —
utförsbackar, kurvtagning, rullning i klunga, rödljus. Det är korrekt uppmätt data som
säger att atleten inte producerade någon effekt. Koden behandlar det som mätfel och
uppfinner 30 W som aldrig trampades.

Ett riktigt sensorbortfall och äkta frihjulning kan inte skiljas åt med enbart effektdata.
Det kräver kadens eller hastighet: 0 W **med** kadens är ett bortfall, 0 W **utan** kadens
men med hastighet är frihjulning. Ingen av dessa kanaler läses in, trots att båda finns i
FIT-filen.

**Reproduktion.** 45-minuterspass, 250 W när atleten trampar, X sekunder frihjulning per
minut. FTP 200.

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

**Varför det är värre än det ser ut.** Felet är inte konstant — det växer med hur mycket
atleten frihjular. Ett tempopass på trainer (noll frihjulning) mäts rätt; ett kuperat
landsvägspass eller en MTB-runda blåses upp med 10–25 %. Konsekvensen är att felet
**inte kan kalibreras bort**: det förvränger jämförelsen *mellan* pass, vilket är precis
vad TSS finns till för. Kvadreringen i TSS-formeln fördubblar dessutom effektfelet.

**Vad rätt beteende vore.** Behåll interpoleringen av isolerade nollor — den är sund.
Låt sammanhängande nollor vara nollor. Vill man ändå särskilja bortfall krävs kadens-
eller hastighetsdata.

---

## A2 — Täckningskravet slår ut hela analysen vid gles inspelning

**Var:** `robustWindowAverages`, konstanten `WINDOW_COVERAGE_THRESHOLD = 0.5`.

**Vad koden gör.** Ett fönster räknas bara om det innehåller minst
`fönsterlängd × 0,5` datapunkter.

**Varför det är fel.** Namnet antyder ett *relativt* täckningskrav — "minst halva fönstret
måste vara täckt". Villkoret är i själva verket ett **absolut krav på samplingsfrekvens:
minst 0,5 punkter per sekund**. En fil som är helt komplett men inspelad glesare än var
annan sekund uppfyller det aldrig, oavsett hur väl den täcker passet.

Det är precis vad **smart recording** producerar. Garmin- och Wahoo-enheter i det läget
glesar ut inspelningen kraftigt under jämn belastning — ofta till ett värde var 3–8:e
sekund.

**Reproduktion.** Samma 40-minuterspass, olika inspelningstäthet, 600 s-fönster:

| Sampling | Punkter | Fönster som räknas | NP (600 s) |
|---|---|---|---|
| 1 Hz | 2400 | 180 | 210 W |
| Var 2:a sekund | 1200 | 180 | 210 W |
| **Var 3:e sekund** | 800 | **0** | **N/A** |
| **Var 4:e sekund** | 600 | **0** | **N/A** |

**Konsekvens.** Vid gränsen faller det inte gradvis — det faller **helt**. Samtliga
fönster kastas, alla TSS-rutor visar `N/A`, och användaren får ingen förklaring. Filen
ser trasig ut trots att den är felfri. Detta är det enda felet i katalogen som yttrar sig
som ett totalt bortfall snarare än en förskjuten siffra.

**Vad rätt beteende vore.** Antingen mäta täckning mot filens **egen** samplingsfrekvens
i stället för mot en sekund, eller resampla serien till 1 Hz före beräkningen. Det senare
är vad kommersiella verktyg gör, och det är också vad standard-NP förutsätter.

---

## A3 — TSS-ackumuleringen planar aldrig ut

**Var:** `calculateTSSAccumulation`.

**Vad koden gör.** Var 30:e sekund körs **hela** NP-beräkningen om från passets början
fram till den tidpunkten, och resultatet ritas som en kurva över tid.

**Varför det är fel.** Kurvan är inte en löpande summa av oberoende bidrag — varje punkt
är en fullständig omanpassning över allt som hittills hänt. En hård insats tidigt i passet
räknas därför om, om och om igen, mot ett växande underlag, och fortsätter generera
TSS-tillskott långt efter att den är över.

Formellt: NP över ett prefix med `n` punkter beter sig som `NP ∝ n^(−1/4)` när effekten
efter insatsen är låg. Då blir

```
TSS = (t/3600) · (NP/FTP)² · 100  ∝  t · t^(−1/2)  =  √t
```

Kurvan **växer alltså som roten ur tiden, för alltid** — även om atleten stannar helt.

**Reproduktion.** Pass: 3 minuter på 450 W, därefter 120 W resten av tiden. FTP 200.
120 W mot FTP 200 motsvarar 18 TSS/timme. Jämför verktygets tillskott per period med det:

| Period | Verktygets TSS-tillskott | Korrekt för perioden | Uppblåsning |
|---|---|---|---|
| 5–15 min | +22,3 | 6,0 | **3,7×** |
| 15–30 min | +23,1 | 9,0 | **2,6×** |
| 30–45 min | +18,4 | 9,0 | **2,0×** |
| 45–60 min | +16,2 | 9,0 | **1,8×** |
| 60–90 min | +28,6 | 18,0 | **1,6×** |

Efter den hårda insatsen bokför verktyget alltså 2–4 gånger så mycket träningsdos som
lugnkörningen faktiskt är värd, och konvergerar bara långsamt mot rätt takt.

**Vad som ändå är läsbart.** Kurvans **lutning vid en given tidpunkt**, och framför allt
**avståndet mellan de olika fönstrens kurvor**, som visar *när* i passet variabiliteten
kom. Det är den informationen konstruktionen faktiskt bär. Kurvans absoluta nivå däremot
går inte att tolka som ackumulerad dos.

**Rättelse av tidigare påstående.** I [03](03-normalized-power-och-tss.md) §5 skrev jag
att kurvan kan **sjunka**. Det är fel, och jag har rättat det. Testat på ett extremfall
(30 s på 900 W följt av en timme på 60 W) sjunker kurvan noll gånger av 118 mätpunkter —
och exponenträkningen ovan visar att den aldrig **kan** sjunka. Det verkliga felet är
det motsatta: den slutar aldrig stiga.

---

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

**Var:** `calculateWorkout`, sökintervallet `CP × 1,05` till `CP × 1,50`.

**Vad koden gör.** Söker den effekt som lämnar mål-W′bal vid passets slut. Ligger
lösningen utanför 1,05–1,50 × CP returneras **gränsvärdet**, utan markering.

**Varför det är fel.** Ett gränsvärde betyder "ingen lösning finns i det tillåtna
intervallet". Det presenteras i stället i samma format och med samma auktoritet som ett
äkta svar.

**Reproduktion.** Defaultvärden: CP 200 W, W′ 15 kJ, τ 180 s, mål 30 % kvar (4500 J).
Kolumnen *sant svar* är lösningen med ett vidgat sökintervall (0,5–4 × CP):

| Pass | Föreskrivet | % CP | Slut-W′bal | Sant svar | Bedömning |
|---|---|---|---|---|---|
| 3×8 min | 210 W | 105 % | 4425 J | 210 W (105 %) | klippt, men sammanfaller — ofarligt |
| 4×6 min | 211 W | 105 % | 4219 J | 211 W (105 %) | klippt, men sammanfaller — ofarligt |
| 2×10 min | 210 W | 105 % | 4947 J | 210 W (105 %) | klippt, men sammanfaller — ofarligt |
| **2×15 min** | **210 W** | **105 %** | **−155 J** | **207 W (103 %)** | **fel svar** |

**Precisering av tidigare påstående.** I [04](04-wbal-och-intervalldesign.md) §5a skrev
jag att ett resultat på 105 % generellt betyder "ingen lösning". Det var för hårt
formulerat, och jag har skärpt beskrivningen. Klippningen **biter** bara när den sanna
lösningen ligger *utanför* intervallet, och bland de 20 mallarna gäller det enbart
`2×15 min`. För de tre andra sammanfaller gränsvärdet med det korrekta svaret.

**Varför `2×15 min` ändå är allvarligt.** Vid de föreskrivna 210 W är W′bal **−155 J** när
passet är slut. Negativ W′bal betyder att förrådet tog slut innan passet gjorde det —
atleten kan inte fullfölja. Verktyget rekommenderar alltså ett pass som enligt dess egen
modell är ogenomförbart, och markerar det inte på något sätt.

---

## B2 — Endast sluttillståndet kontrolleras, aldrig bottennivån

**Var:** `calculateWorkout`, som jämför enbart `simulateWorkout(...)`-returvärdet mot målet.

**Vad koden gör.** Simuleringen returnerar W′bal **vid passets slut**. Ingenting registrerar
hur lågt W′bal var som lägst under passet.

**Varför det är fel.** För de flesta mallarna spelar det ingen roll: när arbetsintervallen
är lika långa ligger bottennivån i slutet av sista repetitionen, och slutvärdet **är**
minimum. Men för strukturer där det längsta arbetsblocket ligger i **mitten** — pyramiderna
— inträffar bottennivån mitt i passet, och slutvärdet överskattar då den verkliga reserven.

**Reproduktion, defaultvärden.** De enda två mallar där minimum skiljer sig från slutvärdet:

| Pass | Slut-W′bal | Lägsta W′bal | Skillnad |
|---|---|---|---|
| Pyramid 1-2-3-4-3-2-1 | 4378 J | 3812 J | 566 J = **3,8 % av W′** |
| Pyramid 2-4-6-4-2 | 4583 J | 3771 J | 812 J = **5,4 % av W′** |

Ber man om 30 % kvar får man alltså i praktiken ned till 25 % i botten, utan att det syns.

**När det blir ett riktigt fel.** Sänker användaren τ under ~145 s går bottennivån under
noll medan slutvärdet fortfarande når målet — passet ser ut som en normal, ej klippt
lösning (110–120 % av CP) men är ogenomförbart. En systematisk genomsökning av
CP 150–350 W, W′ 6–30 kJ, τ 60–400 s och mål 10–30 % ger **168 sådana fall**, samtliga i de
två pyramidmallarna, med bottennivåer från −18 J till −4272 J. Exempel:

| CP | W′ | τ | Mål | Föreskrivet | Lägsta W′bal | Slut-W′bal |
|---|---|---|---|---|---|---|
| 180 W | 8 kJ | 60 s | 20 % | 197 W (110 %) | **−158 J** | 1769 J ✓ |
| 180 W | 15 kJ | 60 s | 10 % | 217 W (120 %) | **−2755 J** | 1438 J ✓ |
| 150 W | 10 kJ | 105 s | 10 % | 168 W (112 %) | **−42 J** | 1084 J ✓ |

τ = 60 s är tillåtet i gränssnittet (`min="60"`). Vid defaultvärdet τ = 180 s uppträder
felet inte i den genomsökta parameterrymden.

**Vad rätt beteende vore.** Genomförbarhet är ett villkor på `min(W′bal) > 0` över hela
passet; slutvärdet är ett doseringsmål. Båda behövs — de mäter olika saker.

---

## B3 — Återhämtningsfaktorn sitter på fel storhet

**Var:** `calculateWPrimeRecovery` och `recoveryFactor = (CP − restPower) / CP`.

**Vad koden gör.**

```
återhämtat = (W′ − W′bal) · (1 − e^(−vila/τ)) · återhämtningsfaktor
```

**Vad som är rätt tänkt.** Att vilointensiteten spelar roll är korrekt, och faktorns
ändpunkter stämmer: vila på 0 W ger faktor 1,0, vila på CP ger faktor 0 — ligger man på
CP återhämtar man ingenting. Riktningen är alltså riktig.

**Varför det ändå är fel.** I Skibas modell påverkar vilointensiteten **τ**, alltså
*hastigheten* på återhämtningen. Här multipliceras den i stället på *mängden*, och det
ger en asymptot som inte finns i verkligheten:

> Med återhämtningsfaktor 0,5 kan högst **halva** underskottet någonsin återhämtas,
> hur lång vilan än är.

**Reproduktion.** W′ = 15 kJ, W′bal = 6 kJ (underskott 9 kJ), vila på 0,5 × CP:

| Vilotid | W′bal efter |
|---|---|
| 60 s | 7 276 J |
| 180 s | 8 845 J |
| 600 s | 10 339 J |
| 1 timme | 10 500 J |
| **10 timmar** | **10 500 J** ← taket |

Taket är `W′bal + faktor × underskott` och nås oavsett hur länge man vilar. Efter tio
timmar står förrådet still på 70 % av fullt.

**Konsekvens.** Pass med långa vilor får systematiskt för låg föreskriven effekt, eftersom
modellen vägrar tro på återhämtningen. Det bidrar till att samtliga 20 mallar hamnar på
105–122 % av CP, vilket är för lågt för de korta anaeroba passen — klassiska 30/30-pass
körs väsentligt hårdare än de 119 % av CP verktyget föreslår för `20×30s`.

**Vad rätt beteende vore.** Låt vilointensiteten styra τ (`τ_effektiv = τ / faktor`, eller
Skibas egen anpassning `τ = 546·e^(−0,01·D_CP) + 316`). Då bevaras både riktningen och
den korrekta asymptoten mot fullt förråd.

---

## B4 — CP och FTP behandlas som samma sak

**Var:** inmatningsfältet `CP (Critical Power / FTP)` i `wbal/`.

**Varför det är fel.** De är olika storheter:

- **FTP** definieras protokollmässigt, typiskt 95 % av ett 20-minuterstest.
- **CP** definieras matematiskt som modellens asymptot och ligger typiskt **något över** FTP.

**Konsekvensen är enkelriktad.** Matar man in ett FTP-värde där modellen vill ha CP blir
taket för lågt. Då blir `(P − CP)` för stort i varje arbetsintervall, W′-förbrukningen
överskattas, och binärsökningen kompenserar genom att föreskriva **lägre** effekt. Felet
pekar alltså åt samma håll som B3 och förstärker det.

**Vad som borde användas.** TP från [`power-curve/`](01-critical-power.md) är exakt den CP
modellen efterfrågar. De två verktygen är gjorda för att hänga ihop — det står bara
ingenstans, och inget värde förs över.

---

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

**Var:** `TSS_CONFIGS`-nycklarna `SPRINT` (10 s), `VO2_MAX` (180 s), `THRESHOLD` (600 s).

**Varför det är fel.** Fönsterlängden är ett **lågpassfilter på effektsignalen**. Den
väljer vilken *tidsskala av variabilitet* som mäts — inte vilket energisystem som
belastades. Ett 10-sekundersfönster på ett fullständigt jämnt tempopass ger fortfarande
en siffra i rutan "TSS (Sprint)": i mätningen i
[03](03-normalized-power-och-tss.md) §2 blir den 60,7, på ett pass utan en enda sprint.

Namnen inbjuder till slutsatsen "jag fick 60,7 i sprint-TSS, alltså belastade jag det
anaeroba systemet". Det följer inte.

**Vad rätt beteende vore.** Neutrala namn (`TSS@10s`, `TSS@30s`, `TSS@600s`) plus ett
härlett **variabilitetsindex** — skillnaden mellan kortaste och längsta fönstret — som den
siffra man faktiskt ska tolka. Det är den storheten konstruktionen bär, och den saknas i
gränssnittet.

---

## C3 — Etiketten "30m TSS (Endurance)" gäller ett 30-sekundersfönster

**Var:** statisk etikett i `fit-analysis/index.html` mot `TSS_CONFIGS.STANDARD.seconds = 30`.

`STANDARD` är **30 sekunder** — Coggans standardfönster, och det enda i uppsättningen som
motsvarar en publicerad definition. Etiketten läser det som 30 **minuter** och kallar det
"Endurance". Konfigurationens egen etikett (`TSS (Standard)`) är korrekt; den statiska
HTML-etiketten är det inte, och det är den användaren ser.

Följden är att den **enda rutan vars siffra går att jämföra med andra verktyg** är den som
ser ut att vara något helt annat.

---

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

**Var:** `targetWatt` i passchemat.

Passens **mål** är absoluta watt, men passens **poängsättning** sker mot FTP. Ändrar man
FTP räknas TSS om — men passet skalar inte. Ett pass är därmed knutet till en enskild
atlet vid en enskild tidpunkt.

Exempelpasset visar problemet direkt: `4x4 Threshold` föreskriver 250 W mot verktygets
standard-FTP på 200 W, alltså **125 % av FTP** — VO2max-intensitet, inte tröskel. Passet
motsäger sitt eget namn så snart FTP inte råkar vara just 250 W.

Med relativa mål vore passet korrekt för varje atlet, och den planerade TSS:en invariant —
vilket den bör vara, eftersom TSS per definition redan är normaliserad mot FTP.

Kravet `targetWatt ≥ 1` i valideringen gör dessutom att **vila på 0 W inte går att
uttrycka**. Tillsammans med A1, som ändå hade golvat varje nolla till 30 W, förbjuder
alltså två oberoende mekanismer samma fullt verkliga träningstillstånd.

---

## D5 — Egendefinierade TSS-fönster kolliderar

**Var:** `addNewTSSConfig`.

Varje nytt fönster får `displayKey: '1Minute'` hårdkodat, oavsett vald fönsterlängd.
`elementId` blir unikt, men `displayKey` är nyckeln som resultaten slås upp med. Två
egendefinierade fönster skriver därför till samma post, och **båda rutorna visar det
sistnämnda fönstrets värde** — med olika etiketter. Ett fönster kan alltså tyst visa ett
annat fönsters siffra.

---

## D6 — Oanropbar kodväg för "Base TSS"

`computeNP_by_time` har en specialgren för `fönster === −1` som räknar TSS ur enkel
medeleffekt, och `updateTSSElement` har en fallback-text för fönstertypen `'BASE'`.
Ingen konfiguration använder sentinelvärdet −1, och `'BASE'` finns inte bland nycklarna i
`TSS_CONFIGS`. Båda grenarna är därmed onåbara.

Storheten de skulle räkna — TSS ur medeleffekt — är samtidigt den rätta **baslinjen** att
jämföra fönsterspektrumet mot. Det är alltså funktionalitet som saknas i gränssnittet
trots att koden för den redan finns.

---

## D7 — Mallen `8×(8×20s)` är inte ett genomförbart pass

Tabata-mallen är angiven som 8 set × 8 repetitioner = **64 repetitioner**, med
`calculateWorkoutStats` som räknar fram **51,7 minuter** total tid.

Klassisk tabata är **ett** set om 8×20/10. Åtta set är en mekanisk extrapolation av
mallformatet snarare än ett pass någon skulle köra. Att binärsökningen ändå returnerar ett
snyggt svar (243 W, 122 % av CP) illustrerar B1 och B2: verktyget uttalar sig lika
självsäkert om ett orimligt pass som om ett rimligt.

---

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

| # | Fel | Typ | Storlek |
|---|---|---|---|
| 1 | A1 — frihjulning som bortfall | tyst förvanskning | +2 till +54 % TSS, ojämnt fördelat |
| 2 | A2 — täckningskravet | totalt bortfall | alla värden N/A vid gles inspelning |
| 3 | B2 + B1 — obegränsad bottennivå, tyst klippning | felaktig föreskrift | ogenomförbara pass, omarkerade |
| 4 | A3 — ackumuleringen planar aldrig ut | tyst förvanskning | 1,6–3,7× för högt tillskott |
| 5 | B3 — återhämtningsfaktorns asymptot | felaktig föreskrift | föreskriver systematiskt för lågt |
| 6 | A4 — area som energi | tyst förvanskning | +12,3 %, plus godtycklig `t₀` |
| 7 | B4, D4 — CP/FTP, absoluta watt | begreppsfel | förstärker 5, gör pass icke-portabla |
| 8 | C1–C4 — namn och etiketter | feltolkning | rätt siffra, fel innebörd |
| 9 | D1, D2, D5, D6, D7 | robusthet | kantfall och kvarlämnat |

D3 (tvåpunktsmetodens felförstärkning) står utanför rangordningen: det är ingen bugg utan
en gräns för vad metoden kan leverera, och den gäller allt som byggs ovanpå signaturen.
