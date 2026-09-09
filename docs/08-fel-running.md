# Fellista: `running/`

Alla fel i Critical Speed-verktyget. Berör en enda fil: **`running/index.html`**.

Detta är repots friskaste verktyg. Det har **inga implementationsfel alls** — beräkningarna
är korrekta, indata valideras, och `t₁ = t₂` kontrolleras (rad 367), vilket effektverktyget
inte gör. Samtliga fel nedan är **modell- eller metodgränser**: koden gör exakt rätt sak,
men modellen används utanför det område där den gäller.

**Inget är åtgärdat.** Siffrorna är uppmätta genom att köra koden.

## Feltyper

| Typ | Innebörd |
|---|---|
| **Modellfel** | Modellen är olämplig för ändamålet. Koden gör precis vad den ska. Går inte att fixa med bättre kod. |
| **Metodgräns** | Inget fel — en gräns för vad metoden kan leverera. Kan bara synliggöras. |

## Översikt

| ID | Fel | Rad | Typ | Storlek |
|---|---|---|---|---|
| **RUN-1** | Långa distanser predikteras strukturellt för snabbt | 420–421, 429 | **Modellfel** | maraton 2:58 ur ett 20-min 5 km |
| **RUN-2** | Korta distanser saknar övre hastighetsgräns | 415–416, 429 | **Modellfel** | `v(t) → ∞` när `t → 0` |
| **RUN-3** | Tvåpunktsmetoden förstärker mätfel | 373–375 | **Metodgräns** | ingen residual, ingen konfidens |
| **RUN-4** | "Maximal distans (1 h)" extrapolerar utanför domänen | 383 | **Modellfel** (mildt) | 3× utanför anpassningsintervallet |

---

## RUN-1 — Långa distanser predikteras strukturellt för snabbt

**Rad 420–421:** posterna `Halvmara` (21097,5 m) och `Mara` (42195 m)
**Rad 429:** `const time = (dist.meters - Dprime) / CS;`

### Vad koden gör

Inverterar modellen `d = CS·t + D′` till `t = (d − D′)/CS` och rullar ut sju distanser upp
till maraton.

### Varför det är fel

**Inversionen är matematiskt korrekt.** Felet är att modellen inte gäller på de
tidsskalorna — därför modellfel, inte bugg.

Se på hastighetsformen: `v(t) = CS + D′/t`. Termen `D′/t` är alltid positiv, alltså är den
predikterade hastigheten **alltid högre än CS**, för alla distanser. Modellen närmar sig CS
**uppifrån** och kommer aldrig under.

Verkligheten är den omvända. Maraton springs **under** CS, eftersom helt andra mekanismer
tar över långt innan den aeroba kapaciteten gör det:

- **Substrattillgång** — glykogendepåerna räcker inte i tre timmar på CS.
- **Värmereglering** — kroppstemperaturen tvingar ner tempot.
- **Muskelskada** — excentrisk belastning under 30 000+ steg försämrar löpekonomin.

**Ingen av dessa mekanismer finns i modellen.** Den känner bara till ett tak och ett förråd.

Konsekvensen är att felet inte är slumpmässig osäkerhet utan en **bias åt ett enda håll**,
och den växer med distansen. Med defaultvärdena (1000 m på 3:00, 5000 m på 20:00 → CS
14,12 km/h, D′ 294 m):

| Distans | Predikterad tid | Tempo | Bedömning |
|---|---|---|---|
| 3 km | 11:30 | 3:50/km | pålitlig |
| 5 km | 20:00 | 4:00/km | *indata* |
| 10 km | 41:15 | 4:07/km | pålitlig |
| Halvmaraton | 1:28:25 | 4:11/km | optimistisk |
| **Maraton** | **2:58:05** | 4:13/km | **klart optimistisk** |

Att maraton predikteras till under tre timmar ur ett 5 km på 20 minuter säger allt: modellen
tror att man kan hålla 4:13/km i tre timmar när man precis har visat 4:00/km i tjugo
minuter.

### Åtgärd

**Modellen kan inte räknas rätt här — den saknar de begränsande mekanismerna.** Tre vägar,
i stigande ambition:

**1. Markera domänen (billigast, störst nytta).** Visa vilka prediktioner som ligger inom
modellens giltighet (~2–15 min) och vilka som inte gör det. Gråa ut eller märk de långa med
*"utanför modellens giltighet — läs som ett tak, aldrig som en prognos"*. Att ta bort dem
helt vore sämre; användaren vill ha dem, och ett markerat värde lär ut mer än inget värde.

**2. Lägg på en empirisk uthållighetsfaktor.** Klassiska formler som Riegels
`T₂ = T₁·(d₂/d₁)^1,06` fångar den avtagande hastigheten över långa distanser rent empiriskt.
Kombinationen — CS-modellen för 2–15 min, Riegel för längre — är vad de flesta praktiska
kalkylatorer gör, och det är ett ärligt erkännande av att en modell inte täcker allt.

**3. Modellera uthållighetsfaktorn explicit.** Låt CS avta med tiden, t.ex. via en
*durability*-parameter. Det är forskningsfront, inte något man bygger in i eftermiddag.

Den pedagogiska poängen: **det är bättre att byta modell utanför domänen än att sträcka en
modell långt bortom där den validerats.** En hyperbel som passar 3–15 minuter perfekt kan
vara helt fel på tre timmar, och att den passar bra i mitten säger ingenting om ändarna.

---

## RUN-2 — Korta distanser saknar övre hastighetsgräns

**Rad 415–416:** posterna `800m` och `1500m`
**Rad 429:** samma inversion

### Vad koden gör

Predikterar 800 m och 1500 m med samma formel.

### Varför det är fel

`v(t) = CS + D′/t` går mot **oändligheten** när `t → 0`. Modellen har alltså ingen övre
hastighetsgräns alls och kan per definition inte beskriva sprintdistanser — enligt den
springer man oändligt fort på en oändligt kort sträcka.

Det är samma strukturella brist som gör att effektverktygets `PP` är meningslös
([PC-2](07-fel-power-curve.md#pc-2--pp-peak-power-är-inte-en-peak-power)): tvåparameters-
modellen har ingen tredje parameter som sätter ett tak vid korta durationer.

Dessutom: `D′` skattat ur insatser på 3–20 minuter fångar inte den **neuromuskulära**
kapacitet som avgör 800 m. Prediktionen 2:09 på 800 m ur en atlet som sprang 1000 m på 3:00
är alltså en extrapolation utanför modellen, inte en prognos — även om siffran råkar se
rimlig ut.

### Åtgärd

Samma logik som RUN-1, spegelvänd: **markera att 800 m och 1500 m ligger utanför
domänen**, och läs dem som "minst så snabbt".

Vill man ha riktiga korta prediktioner krävs en treparametersmodell med en ändlig maxhastighet
(löpningens motsvarighet till Mortons `Pmax`), och den kräver ett kort maximalt test —
typiskt 100–200 m — som tredje datapunkt.

---

## RUN-3 — Tvåpunktsmetoden förstärker mätfel

**Rad 373–375:**
```
const CS = (d2 - d1) / (t2 - t1);
const Dprime = d1 - CS * t1;
```

### Varför det är en gräns snarare än ett fel

Två punkter ger **exakt en lösning, alltid** — ingen residual, ingen konfidens, ingen
möjlighet att upptäcka ett dåligt lopp. Detta är identiskt med
[PC-5](07-fel-power-curve.md#pc-5--tvåpunktsmetoden-förstärker-mätfel-och-det-syns-inte) i
effektverktyget, och den där uppmätta förstärkningen gäller analogt: en liten störning i en
mätpunkt slår igenom kraftigt i lutningen, och desto mer ju närmare punkterna ligger
varandra på tidsaxeln.

CS är **lutningen** i distans–tid-planet. Ju kortare avstånd mellan de två loppens tider,
desto mer svänger lutningen av en liten avvikelse. Samma geometri som gör ett långt sikte
mer precist än ett kort.

Verktygets defaultvärden (180 s och 1200 s) ger god separation. Men inget hindrar användaren
från att mata in två lopp med några minuters skillnad, och då blir skattningen opålitlig
utan att något syns.

### Åtgärd

Precis som PC-5 — synliggör snarare än fixa:

1. **Varna vid för liten separation** mellan de två loppens tider.
2. **Visa känsligheten**: räkna om CS och D′ med några sekunders fel på varje lopp och visa
   spannet, i stället för `14,1 km/h` med tre värdesiffror.
3. **Tillåt fler lopp.** Med 3–5 resultat och minsta kvadratanpassning får man en stabilare
   skattning **och** en residual — och residualen är det egentligen intressanta, för den
   avslöjar när ett av loppen inte var maximalt.

En extra fördel i löpning: de flesta har redan flera loppresultat liggande. Att bara tillåta
två är en onödig begränsning av data som redan finns.

---

## RUN-4 — "Maximal distans (1 h)" extrapolerar utanför domänen

**Rad 383:** `const maxDist1h = CS * 3600 + Dprime;`

### Vad koden gör

Använder den linjära formen direkt för `t = 3600 s`. Med defaultvärdena: **14 412 m**.

### Varför det ändå är den bästa extrapolationen i repot

Detta är rakt motsatsen till effektverktygets areafel
([PC-1](07-fel-power-curve.md#pc-1--area-under-kurvan-är-ingen-energi)). Här används
modellens **linjära form** direkt, precis som den är avsedd, och resultatet är fysiologiskt
tolkbart: *"så långt hinner du på en timme om du ligger på CS och tömmer D′."*

Ingen godtycklig integrationsgräns, ingen summering av oförenliga insatser.

### Varför det ändå är ett problem

En timme är **tre gånger längre** än den övre gränsen för modellens anpassningsintervall
(~20 min), och därmed ärver siffran hela den optimistiska bias som beskrivs i RUN-1. En
löpare med 5 km på 20:00 springer i verkligheten kortare än 14,4 km på en timme.

### Åtgärd

Behåll storheten — den är rätt konstruerad — men märk den som ett **tak**, inte en prognos,
på samma sätt som de långa loppprediktionerna. Alternativt: räkna den för 20 eller 30
minuter i stället, vilket ligger inom eller nära domänen och ger ett tal man faktiskt kan
lita på.

---

## Sammanfattning: modell mot implementation

| | Fel |
|---|---|
| **Modellfel** — kan inte kodas bort | RUN-1 (modellen saknar uthållighetsbegränsning), RUN-2 (ingen övre hastighetsgräns), RUN-4 (extrapolation) |
| **Metodgräns** — kan bara synliggöras | RUN-3 (tvåpunktsförstärkning) |
| **Implementationsfel** | **inga** |

**Det viktigaste att förstå:** det finns ingenting att buggfixa här. Koden är korrekt.
Samtliga fel uppstår i gränssnittet mellan en modell som gäller i 2–15 minuter och ett
gränssnitt som presenterar maratontider med samma självförtroende som 5 km-tider.

**Alla fyra åtgärder är därför samma åtgärd:** visa var modellen gäller. En enda visuell
markering — grönt inom domänen, grått utanför — skulle lösa RUN-1, RUN-2 och RUN-4 på en
gång, och det utan att ta bort ett enda värde från användaren.

## Saknad funktion, inte ett fel

Cykeldelen har full W′bal-dynamik ([`wbal/`](09-fel-wbal.md)); löpdelen har bara den statiska
skattningen. Ett **`D′bal`** — samma återhämtningsmatematik, applicerad på distans i stället
för arbete — vore den naturliga fortsättningen.

`D′` i meter är dessutom ovanligt intuitivt: det säger direkt hur mycket **taktiskt spelrum**
en löpare har. Ett D′ på 294 m betyder att en rusning, en uppförsbacke eller en spurt kostar
ur ett förråd på knappt 300 meter, som sedan måste betalas tillbaka genom att springa under
CS. Det är exakt det resonemang cykelverktyget redan gör — men löpverktyget saknar det.
