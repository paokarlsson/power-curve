# Normalized Power och TSS (`fit-analysis/`)

Detta är repots mest originella verktyg. Grunden är etablerad, men generaliseringen ovanpå
den är egen — och den är genuint intressant.

## 1. Grundkedjan  **[Etablerad]**

Coggan & Allens standardkedja för att omvandla en effektfil till en träningsdos:

1. **Rullande 30-sekundersmedelvärde** över effektserien.
   Fysiologisk motivering: de metabola svaren på belastning har en tidskonstant kring
   ~30 s, så kroppen "ser" inte enskilda sekunder utan ett glidande medel.
2. **Upphöj varje fönstermedel till 4**, medelvärdesbilda, dra fjärde roten:
   `NP = ⁴√( medel( fönstermedel⁴ ) )`.
   Exponenten viktar toppar hårdare än dalar — 20 minuter jämnt är inte lika krävande som
   20 minuter med samma medeleffekt men stora svängningar.
3. **Intensity Factor:** `IF = NP / FTP`.
4. **Training Stress Score:** `TSS = (t/3600) × IF² × 100`, alltså 100 per timme på FTP.

Verktyget implementerar `TSS = (duration/3600) × (NP/FTP)² × 100`, vilket är algebraiskt
identiskt med Coggans form. **Korrekt.**

## 2. Generaliseringen: fönsterlängden som fri parameter  **[Egen – rimlig, och den bästa idén i repot]**

Istället för att låsa fönstret vid 30 s beräknar verktyget NP och TSS över **flera
fönsterlängder samtidigt** — som standard 10 s, 30 s, 180 s och 600 s — och visar dem
sida vid sida.

### Varför detta betyder något

Fönstret är ett **lågpassfilter**. Ju längre fönster, desto mer utjämnas variationen:

- **Kort fönster (10 s)** — topparna överlever utjämningen och slår igenom i `⁴√(medel(x⁴))`.
  NP blir hög.
- **Långt fönster (600 s)** — topparna slätas ut mot medelvärdet. NP konvergerar mot
  **medeleffekten**.

Alltså: **avståndet mellan kort och långt fönster är ett direkt mått på hur ojämnt passet
var.** För ett perfekt jämnt pass är alla fönster identiska; för ett spikigt pass spretar de.

Detta är inte dokumenterat någonstans i koden, men det är vad konstruktionen faktiskt
mäter, och det är dess värde.

### Mätning på syntetiska pass

Alla tre passen nedan är ~45 min och har nästan samma **medeleffekt** (~175–181 W) mot
FTP 200 — konventionell analys skulle inte kunna skilja dem åt:

| Pass | NP 10 s | NP 30 s | NP 180 s | NP 600 s | TSS 10 s | TSS 600 s | **Spridning** |
|---|---|---|---|---|---|---|---|
| Jämnt, 45 min @ 180 W | 180 | 180 | 180 | 180 | 60,7 | 60,7 | **0** |
| 4×4 tröskel (passfilen) | 207,5 | 206,5 | 198,3 | 194,3 | 66,3 | 58,2 | **8** |
| Spikigt, 15 s @ 400 / 45 s @ 100 | 258,7 | 201,2 | 175 | 175 | 125,5 | 57,4 | **68** |

Läsningen är omedelbar. Det jämna passet och det spikiga passet har samma
"långtids-TSS" (~58–61) — samma aeroba dos — men det spikiga kostar **mer än dubbelt så
mycket** i den korta änden. Det är kostnaden i den anaeroba kapaciteten, som ett enda
TSS-tal per definition döljer.

### Föreslagen läsregel

| Spridning `TSS(10 s) − TSS(600 s)` | Tolkning |
|---|---|
| ≈ 0 | Jämnt distans-/tempopass. Dosen är aerob. |
| 5–20 | Strukturerade långa intervaller. Måttlig variabilitet. |
| > 40 | Kort, hård, intermittent belastning. Anaerob kostnad dominerar. |

Detta är i praktiken en generalisering av Variability Index (`NP/medeleffekt`) till ett
**spektrum över tidsskalor** istället för ett enda tal — och det är strikt mer informativt.

### Namngivningen är fel

Fönstren heter i koden `SPRINT` (10 s), `VO2_MAX` (180 s) och `THRESHOLD` (600 s). Det
antyder att varje fönster mäter ett energisystem. **Det gör det inte.** Fönstret mäter
tidsskalan för *variabiliteten*, inte vilket system som belastades. Ett 10-sekundersfönster
på ett jämnt tempopass ger fortfarande "TSS (Sprint)" — 60,7 i tabellen ovan — utan att
någon sprint förekommit.

Ärligare namn vore `TSS@10s`, `TSS@30s`, `TSS@600s`, plus ett härlett
**variabilitetsindex** som den siffra man faktiskt tolkar.

## 3. Exponenten som reglage  **[Egen – rimlig]**

Exponent 4 är etablerad och är default. Att exponera den som inställning är en rimlig
utforskande funktion: högre exponent → topparna väger tyngre → NP och TSS stiger för
ojämna pass och är oförändrade för jämna. Exponenten och fönsterlängden är alltså **två
reglage på samma sak** — hur hårt ojämnhet ska straffas — men de verkar på olika sätt:
exponenten viktar *amplitud*, fönstret väljer *tidsskala*.

Byt inte exponent för produktionsanalys: alla jämförelser mot andras TSS-siffror
förutsätter 4.

## 4. Implementationsval som förskjuter siffrorna

Fyra beslut i beräkningen avviker från standard och påverkar resultatet. Ingen av dem
syns i gränssnittet.

### (a) Decimerad fönsterstegning  **[Egen – rimlig, mätt utan effekt]**

Standard-NP flyttar fönstret **en sekund i taget**. Koden använder
`steg = max(1, ⌊fönster/60⌋)`:

| Fönster | Steglängd | NP med kodens steg | NP med 1 s-steg | Skillnad |
|---|---|---|---|---|
| 10 s, 30 s, 60 s | 1 s | — | — | identiskt med standard |
| 180 s | 3 s | 229,32 W | 229,26 W | +0,03 % |
| 600 s | 10 s | 209,83 W | 209,83 W | 0,00 % |
| 1800 s | 30 s | 210,01 W | 210,03 W | −0,01 % |

Mätt på ett realistiskt ojämnt 40-minuterspass är skillnaden under en tiondels procent och
saknar riktning. En sund prestandaoptimering, inte ett fel.

### (b) Täckningskrav 50 %  **[Egen – problematisk]**

Ett fönster räknas bara om det innehåller minst `0,5 × fönsterlängd` datapunkter. Namnet
antyder ett relativt täckningskrav, men villkoret är i praktiken ett **absolut krav på
samplingsfrekvens: minst 0,5 punkter per sekund**.

Vid inspelning glesare än var annan sekund — precis vad *smart recording* på Garmin- och
Wahoo-enheter producerar — kastas **samtliga** fönster och alla TSS-värden blir `N/A`, utan
förklaring. Det faller inte gradvis, det faller helt. Se
[FA-2 i fellistan för fit-analysis](10-fel-fit-analysis.md).

### (c) Fönstret måste rymmas i passet  **[Etablerad praxis]**

`fönster > 0,9 × passlängd` ger "N/A". Ett 10-minutersfönster kräver alltså minst
~11 minuters pass. Vettig spärr som förhindrar meningslösa värden från ett enda fönster.

### (d) Nollhantering: 0 W → 30 W  **[Egen – problematisk]**

Databehandlingen gör två saker med nollor:

- **Isolerad nolla** (positiv effekt före och efter) → interpoleras som medel av grannarna.
  Rimligt: det är sannolikt ett sensorbortfall.
- **Alla andra nollor** → ersätts med `MIN_POWER_DROPOUT = 30 W`.
  **Detta är fel för cykling.** Sammanhängande nollor är nästan alltid **frihjulning** —
  utförsbackar, kurvor, rullning i klunga — inte sensorbortfall. Det är verklig data.

Effekten är inte försumbar. Ett 45-minuterspass med 20 sekunder frihjulning per minut
(en helt normal kriterium- eller MTB-profil), verklig medeleffekt 167 W mot FTP 200:

| | Verkligt | Rapporterat | Fel |
|---|---|---|---|
| Medeleffekt / NP(600 s) | 167 W | 176,7 W | **+5,8 %** |
| TSS | 52,3 | 58,5 | **+12,0 %** |

Kvadreringen i TSS-formeln förstärker felet. **Träningsdosen blir systematiskt uppblåst
för just de pass som har mest frihjulning.** Och eftersom felet är ojämnt fördelat över
åkarens pass går det inte att kompensera med en konstant.

**Rekommendation:** behåll interpoleringen av isolerade nollor, ta bort 30 W-golvet.
Vill man ändå skilja bortfall från frihjulning krävs kadens- eller hastighetsdata —
0 W med kadens > 0 är ett bortfall, 0 W med kadens 0 och hastighet > 0 är frihjulning.

## 5. TSS-ackumulering över tid  **[Egen – rimlig, men missförstås lätt]**

Verktyget ritar TSS som funktion av förfluten tid genom att var 30:e sekund **räkna om hela
NP-beräkningen från passets början** fram till den tidpunkten.

Detta är **inte** en löpande summa. Varje punkt är en fullständig omanpassning över hela
prefixet, och det har en konsekvens som är lätt att missa:

> Kurvan **planar aldrig ut**.

En hård insats tidigt i passet räknas om mot ett allt större underlag och fortsätter
generera TSS-tillskott långt efter att den är över. Formellt beter sig NP över ett prefix
som `NP ∝ n^(−1/4)` när effekten därefter är låg, vilket ger
`TSS ∝ t · t^(−1/2) = √t` — kurvan växer som roten ur tiden, för alltid, även om atleten
stannar helt.

Uppmätt på ett pass med 3 min på 450 W följt av 120 W (= 18 TSS/h) bokför verktyget
**1,6–3,7 gånger** så stort tillskott som lugnkörningen är värd. Se
[FA-3 i fellistan för fit-analysis](10-fel-fit-analysis.md) för
mätserien.

Kurvans absoluta nivå går alltså inte att tolka som ackumulerad dos. Det som *är*
meningsfullt att läsa är **lutningen**: den är stressintensiteten just då. Och med flera fönster ritade samtidigt syns exakt **när** i passet variabiliteten kom —
de korta fönstrens kurvor drar ifrån de långa precis vid intervallblocken. Det är
information som ett sluttal aldrig kan ge.

## 6. Kvarlämnat och inkonsekvent

- **`Base TSS` (`fönster = −1`)** — kodvägen finns och räknar TSS ur enkel medeleffekt,
  men ingen konfiguration använder sentinelvärdet −1, och fallback-texten refererar till
  en fönstertyp `BASE` som inte finns i konfigurationen. Oanropbar kod.
  Storheten den skulle räkna (TSS ur medeleffekt) är däremot den rätta baslinjen att
  jämföra fönsterspektrumet mot, och borde återinföras medvetet.
- **Etikettfel:** gränssnittet skriver `30m TSS (Endurance)` för `STANDARD`-fönstret,
  som är **30 sekunder** — Coggans standard, inte 30 minuter. Konfigurationens egen etikett
  (`TSS (Standard)`) är korrekt; den statiska HTML-etiketten är det inte.
- Nya egendefinierade fönster får alla samma `displayKey` (`'1Minute'`), vilket gör att
  två samtidiga custom-fönster skriver över varandras visning.
