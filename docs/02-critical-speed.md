# Critical Speed-modellen (`running/`)

## 1. Modellen  **[Etablerad]**

Löpningens motsvarighet till Critical Power. Samma tvåparametersstruktur, men uttryckt i
distans istället för arbete (Hughson m.fl. 1984; Jones & Vanhatalo 2017):

| Form | Uttryck | Enhet |
|---|---|---|
| Distans vs tid | `d = CS · t + D′` | linjär — **lutning = CS, y-skärning = D′** |
| Hastighet vs tid | `v(t) = CS + D′ / t` | hyperbolisk |

- **CS (Critical Speed)** — den högsta hastighet som kan hållas i princip obegränsat.
- **D′** — den distans som kan tillryggaläggas *ovanför* CS innan förrådet är tomt.
  Mäts i **meter**, vilket är modellens elegans: den anaeroba reserven blir en sträcka.

Verktyget visar båda formerna sida vid sida, av samma skäl som i effektverktyget: linjen
är läsbar, hyperbeln är intuitiv.

## 2. Skattning ur två lopp  **[Etablerad]**

```
CS = (d₂ − d₁) / (t₂ − t₁)
D′ = d₁ − CS · t₁
```

Med defaultvärdena (1000 m på 3:00 och 5000 m på 20:00):

| Parameter | Värde |
|---|---|
| CS | 3,922 m/s = **14,12 km/h** = 4:15/km |
| D′ | **294 m** |

Verktyget kontrollerar `t₁ ≠ t₂` och att alla värden är positiva — mer robust än
effektverktyget. Samma grundbegränsning gäller ändå: två punkter, exakt en lösning,
ingen residual, ingen konfidens.

**Giltighetsdomän: samma som CP-modellen, ~2–15 min.** Defaultvärdena (3 min och 20 min)
sträcker sig något utanför i den övre änden — ett 5000 m-lopp på 20 minuter ligger nära
gränsen för var CS-modellen fortfarande beter sig.

## 3. Loppprediktion  **[Etablerad modell, riskabel användning]**

Modellen inverteras till `t = (d − D′) / CS` och verktyget rullar ut sju distanser.
Med defaultvärdena:

| Distans | Predikterad tid | Tempo |
|---|---|---|
| 800 m | 2:09 | 2:41/km |
| 1500 m | 5:08 | 3:25/km |
| 3 km | 11:30 | 3:50/km |
| 5 km | 20:00 | 4:00/km ← *indata* |
| 10 km | 41:15 | 4:07/km |
| Halvmaraton | 1:28:25 | 4:11/km |
| Maraton | **2:58:05** | 4:13/km |

De två ytterdistanserna är systematiskt fel, i motsatta riktningar, och båda felen följer
direkt av modellens form:

**Kort ände (800 m, 1500 m).** `v(t) = CS + D′/t` går mot **oändligheten** när `t → 0`.
Modellen har ingen övre hastighetsgräns och kan därför per definition inte beskriva
sprintdistanser. D′ skattat ur 3–20-minutersinsatser fångar dessutom inte den
neuromuskulära kapacitet som avgör 800 m. Prediktionen 2:09 på 800 m från en atlet
som sprang 1000 m på 3:00 är därför en extrapolation utanför modellen, inte en prognos.

**Lång ände (halvmaraton, maraton).** Modellen låter tempot närma sig CS **uppifrån** —
den predikterade maratonhastigheten är alltid *snabbare* än CS. Verkligheten är den
omvända: maraton springs **under** CS, eftersom substrattillgång, värmereglering och
muskelskada begränsar långt innan den aeroba kapaciteten gör det. Ingen av dessa
mekanismer finns i modellen. Maratonprediktionen är därför **strukturellt** för snabb,
inte bara osäker: 2:58 ur ett 20-minuters 5 km är optimistiskt med god marginal, och
felet växer ju längre distansen är.

**Praktisk läsregel:** litar på 3 km–10 km. Behandla 800 m/1500 m som "minst så snabbt"
och halvmaraton/maraton som "aldrig snabbare än så här".

## 4. "Maximal distans (1 h)"  **[Egen – rimlig]**

```
d(3600) = CS · 3600 + D′
```

Med defaultvärdena: **14 412 m**.

Detta är den rakaste och mest välbeteende extrapolationen i hela repot — till skillnad från
motsvarande areaberäkning i effektverktyget ([01](01-critical-power.md) §4) använder den
den linjära formen direkt och är därmed fysiologiskt tolkbar: *"så långt hinner du på en
timme om du ligger på CS och tömmer D′."*

Den ligger ändå utanför anpassningsdomänen (1 h ≫ 20 min) och ärver därför den
optimistiska bias som beskrivs ovan. Läs den som ett tak, inte som en prognos.

## 5. Vad D′ är bra till

D′ i meter är underskattat som styrmått, och verktyget utnyttjar det inte. Storheten säger
direkt hur mycket **taktiskt spelrum** en löpare har: ett D′ på 294 m betyder att en
rusning, en uppförsbacke eller en spurt kostar ur ett förråd på knappt 300 meter, som
sedan måste betalas tillbaka genom att springa under CS.

Det är exakt samma resonemang som W′bal-verktyget gör för cykel
([04](04-wbal-och-intervalldesign.md)) — men löpverktyget har ingen motsvarighet till
det. Ett `D′bal` över ett lopp, med samma återhämtningsdynamik, vore den naturliga
fortsättningen och skulle knyta ihop de två halvorna av repot.
