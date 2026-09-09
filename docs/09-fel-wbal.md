# Fellista: `wbal/`

Alla fel i intervalloptimeraren. Berör två filer: **`wbal/script.js`** och
**`wbal/index.html`**.

Detta verktyg innehåller repots skarpaste träningsmetodiska idé — att föreskriva
intervalleffekt genom att lösa ut den ur ett mål för återstående W′ i stället för att ange
en procent av FTP — och samtidigt dess allvarligaste modellfel. Båda är värda att förstå,
och de hänger ihop: felen gör att den goda idén levererar för låga effekter.

**Inget är åtgärdat.** Siffrorna är uppmätta genom att köra koden mot dess egna
defaultvärden (CP 200 W, W′ 15 kJ, τ 180 s, mål 30 % kvar).

## Feltyper

| Typ | Innebörd |
|---|---|
| **Modellfel** | Modellen är fel formulerad. Koden gör precis vad den ska. Kräver att man ändrar *vad* som räknas. |
| **Implementationsfel** | Modellen är rätt, men lösningsmetoden eller villkoret är fel. Ren buggfix. |
| **Begreppsfel** | Beräkningen rätt, men indata eller etikett betyder något annat än man tror. |
| **Datafel** | Fel i en mall eller konstant, inte i logiken. |

## Översikt

| ID | Fel | Fil och rad | Typ | Storlek |
|---|---|---|---|---|
| **WB-1** | Bottennivån kontrolleras aldrig | `script.js:167–169` | **Implementationsfel** | ogenomförbara pass, omarkerade |
| **WB-2** | Binärsökningen klipper tyst | `script.js:162–163` | **Implementationsfel** | `2×15 min` får fel svar |
| **WB-3** | Återhämtningsfaktorn sitter på fel storhet | `script.js:60–61, 77, 98, 106, 125` | **Modellfel** | återhämtar aldrig fullt |
| **WB-4** | τ-defaulten är för snabb | `index.html:33` | **Modellparameter** | 180 s mot Skibas 300–500+ s |
| **WB-5** | CP och FTP behandlas som samma sak | `index.html:17` | **Begreppsfel** | förstärker WB-3 |
| **WB-6** | Mallen `8×(8×20s)` är 64 repetitioner | `script.js:25` | **Datafel** | 51,7 min, orimligt pass |

---

## WB-1 — Bottennivån kontrolleras aldrig

**Rad 167:** `const finalWbal = simulateWorkout(template, optimalPower, CP, W_prime, tau, restPower);`
**Rad 169:** `if (Math.abs(finalWbal - targetWbal) < 100) {`

### Vad koden gör

Binärsökningen jämför **enbart W′bal vid passets slut** mot målet. Simuleringen returnerar
bara slutvärdet; hur lågt W′bal var som lägst under passet registreras aldrig.

### Varför det är fel

Detta är ett **implementationsfel, inte ett modellfel** — och skillnaden är viktig.
W′bal-modellen räknar helt korrekt igenom passet och **vet** exakt när förrådet är tomt.
Informationen finns i simuleringen. Den kastas bara bort.

För de flesta mallarna spelar det ingen roll. Med lika långa arbetsintervall vandrar W′bal
stadigt nedåt och når sitt lägsta värde i slutet av sista repetitionen — slutvärdet **är**
minimum. Men i **pyramiderna** ligger det längsta arbetsblocket i mitten, så bottennivån
inträffar mitt i passet och slutvärdet överskattar den verkliga reserven.

**Uppmätt, defaultvärden.** De enda två mallar där minimum skiljer sig från slutvärdet:

| Pass | Slut-W′bal | Lägsta W′bal | Skillnad |
|---|---|---|---|
| Pyramid 1-2-3-4-3-2-1 | 4378 J | 3812 J | 566 J = **3,8 % av W′** |
| Pyramid 2-4-6-4-2 | 4583 J | 3771 J | 812 J = **5,4 % av W′** |

Ber man om 30 % kvar får man alltså ned till ~25 % i botten, utan att det syns.

**När det blir ett riktigt fel.** Sänker användaren τ under ~145 s — fullt tillåtet,
gränssnittets minimum är 60 s — går bottennivån **under noll** medan slutvärdet fortfarande
når målet. Passet ser då ut som en normal, ej klippt lösning på 110–120 % av CP, men är
ogenomförbart. En genomsökning av CP 150–350 W, W′ 6–30 kJ, τ 60–400 s och mål 10–30 % ger
**168 sådana fall**, samtliga i de två pyramidmallarna, med bottennivåer från −18 J till
−4272 J:

| CP | W′ | τ | Mål | Föreskrivet | Lägsta W′bal | Slut-W′bal |
|---|---|---|---|---|---|---|
| 180 W | 8 kJ | 60 s | 20 % | 197 W (110 %) | **−158 J** | 1769 J ✓ |
| 180 W | 15 kJ | 60 s | 10 % | 217 W (120 %) | **−2755 J** | 1438 J ✓ |
| 150 W | 10 kJ | 105 s | 10 % | 168 W (112 %) | **−42 J** | 1084 J ✓ |

### Åtgärd

**Den pedagogiska nyckeln: slutvärdet och bottennivån mäter två helt olika saker, och båda
behövs.**

- **`min(W′bal) > 0` är ett genomförbarhetsvillkor.** Går förrådet under noll kan passet
  inte utföras — punkt. Detta är ett *hårt* villkor: uppfylls det inte finns ingen lösning,
  hur bra slutvärdet än ser ut.
- **Slutvärdet är ett doseringsmål.** Det säger hur hårt passet ska vara, givet att det
  över huvud taget går att genomföra.

Åtgärden är därför inte att byta villkor utan att **lägga till ett**: låt simuleringen
returnera både minimum och slutvärde, avvisa alla kandidater där minimum ≤ 0, och sök
sedan mot slutvärdet bland de återstående.

En sidovinst: när minimum spåras kan gränssnittet visa **var i passet** det är som tuffast.
Det är information en tränare faktiskt vill ha — "det spricker på repetition fem, inte i
slutet" — och den finns redan i simuleringen.

---

## WB-2 — Binärsökningen klipper tyst vid intervallgränserna

**Rad 162–163:**
```
let minPower = CP * 1.05;
let maxPower = CP * 1.50;
```

### Vad koden gör

Söker den effekt som lämnar mål-W′bal vid passets slut, inom 1,05–1,50 × CP. Ligger
lösningen utanför returneras **gränsvärdet**, utan markering, i samma format och med samma
auktoritet som ett äkta svar.

### Varför det är fel

Ett gränsvärde betyder "sökningen tog slut här", inte "detta är svaret". Binärsökning
konvergerar alltid mot *något* — den kan inte i sig upptäcka att lösningen låg utanför
intervallet. Det måste kontrolleras efteråt, och det görs inte.

Implementationsfel: modellen är korrekt, lösaren rapporterar bara inte sin egen
tillförlitlighet.

**Uppmätt.** Kolumnen *sant svar* är lösningen med vidgat sökintervall (0,5–4 × CP):

| Pass | Föreskrivet | % CP | Slut-W′bal | Sant svar | Bedömning |
|---|---|---|---|---|---|
| 3×8 min | 210 W | 105 % | 4425 J | 210 W (105 %) | klippt, men sammanfaller |
| 4×6 min | 211 W | 105 % | 4219 J | 211 W (105 %) | klippt, men sammanfaller |
| 2×10 min | 210 W | 105 % | 4947 J | 210 W (105 %) | klippt, men sammanfaller |
| **2×15 min** | **210 W** | **105 %** | **−155 J** | **207 W (103 %)** | **fel svar** |

Klippningen **biter** bara när den sanna lösningen ligger utanför intervallet, och bland de
20 mallarna gäller det enbart `2×15 min`. För de tre övriga sammanfaller gränsvärdet med
rätt svar — de är klippta men råkar ha rätt. Det gör felet lömskare, inte mildare: tre av
fyra klippta fall ser korrekta ut, vilket inbjuder till att lita på det fjärde.

Vid de föreskrivna 210 W landar `2×15 min` på **−155 J**: förrådet tar slut innan passet
gör det. Verktyget rekommenderar alltså ett pass som enligt dess egen modell är
ogenomförbart.

### Åtgärd

**Två separata saker, som ofta blandas ihop:**

**1. Vidga intervallet.** 1,05–1,50 × CP är för snävt i båda ändar. Korta anaeroba pass
kräver ofta över 150 % av CP; långa tröskelpass kan kräva under 105 %. Ett intervall som
0,8–3,0 × CP täcker allt realistiskt.

**2. Kontrollera konvergensen — detta är det viktiga.** Även med ett vidare intervall måste
lösaren efteråt fråga: *nådde jag faktiskt målet?* Villkoret finns redan i koden
(`Math.abs(finalWbal - targetWbal) < 100`) men används bara för att bryta loopen tidigt,
aldrig för att avgöra om resultatet duger. Kontrollera samma villkor **efter** loopen och
säg ifrån när det inte är uppfyllt.

Den generella lärdomen: **en numerisk lösare måste alltid rapportera om den konvergerade.**
Ett tal utan konvergensstatus är inte ett svar, det är en gissning som råkar ha rätt
antal decimaler.

Åtgärdas WB-2 utan WB-1 får man ett svar som fortfarande kan vara ogenomförbart — se
*Beroenden* nedan.

---

## WB-3 — Återhämtningsfaktorn sitter på fel storhet

**Rad 60–61:**
```
function calculateWPrimeRecovery(W_prime, W_bal, restTime, tau, recoveryFactor) {
    const W_recovered = (W_prime - W_bal) * (1 - Math.exp(-restTime / tau)) * recoveryFactor;
```
**Rad 77, 98, 106, 125** m.fl.: `const recoveryFactor = (CP - restPower) / CP;`
*(samma uttryck upprepat på sex ställen, ett per simuleringsvariant)*

### Vad koden gör

Multiplicerar den återhämtade mängden med en faktor som beror på vilointensiteten.

### Vad som är rätt tänkt

**Att vilointensiteten spelar roll är helt korrekt**, och faktorns ändpunkter stämmer:

- Vila på 0 W → faktor 1,0 (full återhämtning)
- Vila på CP → faktor 0 (ingen återhämtning alls)

Den senare är fysiologiskt riktig: ligger man exakt på CP arbetar man per definition på
gränsen och fyller inte på förrådet. Riktningen är alltså rätt, och tanken är god.

### Varför det ändå är fel

I Skibas modell påverkar vilointensiteten **τ** — alltså *hastigheten* på återhämtningen.
Här multipliceras den i stället på *mängden*. Skillnaden verkar subtil men ändrar
beteendet i grunden:

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

Taket är `W′bal + faktor × underskott`. Efter tio timmars vila står förrådet still på 70 %
av fullt — atleten skulle enligt modellen aldrig bli helt utvilad.

**Detta är ett modellfel**, inte en bugg: koden räknar exakt det uttryck som står skrivet.
Uttrycket är fel formulerat.

### Varför det spelar roll i praktiken

Modellen underskattar återhämtningen, särskilt vid långa vilor. Binärsökningen kompenserar
genom att föreskriva **lägre** effekt. Samtliga 20 mallar hamnar på 105–122 % av CP, vilket
är för lågt för de korta anaeroba passen — klassiska 30/30-pass körs väsentligt hårdare än
de 119 % av CP verktyget föreslår för `20×30s`.

### Åtgärd

**Flytta faktorn från mängden till tidskonstanten:**

```
τ_effektiv = τ / återhämtningsfaktor
```

Varför detta fungerar: en exponentialfunktion `1 − e^(−t/τ)` går alltid mot **1** när
`t → ∞`, oavsett τ. Ändrar man τ ändrar man alltså *hur snabbt* man närmar sig full
återhämtning, aldrig *om* man gör det. Multiplicerar man i stället på mängden kapar man
asymptoten — och det är exakt vad som gått fel.

Detta är en generell princip värd att ta med sig: **när något ska gå långsammare, ändra
tidskonstanten; när något ska bli mindre, ändra amplituden.** Här ville man det första och
gjorde det andra.

Den fullständiga lösningen är Skibas egen anpassning, som gör precis detta:

```
τ = 546 · e^(−0,01 · D_CP) + 316      där D_CP = CP − medeleffekt under vilan
```

Den har fördelen att vara empiriskt anpassad mot verkliga data, inte bara dimensionsriktig.

---

## WB-4 — τ-defaulten är för snabb

**`wbal/index.html:33`:** `<input type="number" id="tau" value="180" min="60" max="600">`

### Vad koden gör

Låter användaren ange τ fritt mellan 60 och 600 sekunder, med **180 s** som default.

### Varför det är ett problem

**Att exponera τ är i sig rimligt** — den varierar kraftigt individuellt och är svår att
mäta, så att låta användaren justera den är ett försvarbart val.

Men Skibas anpassning ger typiskt **300–500+ sekunder** för realistiska vilointensiteter.
Defaultvärdet 180 s ligger alltså klart under vad modellen förutsäger, vilket gör att
verktyget antar snabbare återhämtning än den empiriska grunden stöder — och därmed
föreskriver hårdare pass än W′bal-teorin egentligen tillåter.

Det är intressant att felet pekar **motsatt håll** mot WB-3: en för låg τ gör passen
hårdare, en felplacerad återhämtningsfaktor gör dem lättare. De två maskerar delvis varandra,
vilket är varför de föreskrivna effekterna ser hyfsat rimliga ut trots två fel i
återhämtningsmodellen.

Dessutom: `min="60"` är det som gör [WB-1](#wb-1--bottennivån-kontrolleras-aldrig)
utlösbart, eftersom felet där kräver τ under ~145 s.

### Åtgärd

Detta är ett **kalibreringsval**, inte en bugg — men kalibrering ska vara motiverad.

Sätt defaultvärdet till Skibas anpassade värde för den aktuella vilointensiteten i stället
för ett fast tal. Åtgärdas WB-3 enligt förslaget ovan faller detta ut automatiskt: τ blir
då härledd ur vilointensiteten och behöver inget default alls.

Behåller man τ som fri parameter bör gränssnittet åtminstone skriva ut vad Skibas modell
skulle ha gett, så användaren ser när hen avviker från den och åt vilket håll.

---

## WB-5 — CP och FTP behandlas som samma sak

**`wbal/index.html:17`:** `<label for="cp">CP (Critical Power / FTP)</label>`

### Varför det är fel

De är **olika storheter**, definierade på olika sätt:

- **FTP** definieras protokollmässigt — typiskt 95 % av medeleffekten i ett 20-minuterstest.
  Det är ett *mätrecept*.
- **CP** definieras matematiskt som modellens asymptot: den effekt kurvan planar ut mot.
  Det är en *modellparameter*.

CP ligger typiskt **något över** FTP, eftersom FTP-receptets 95 %-avdrag är just till för att
hamna på en nivå man säkert kan hålla en timme, medan CP är den teoretiska gränsen.

**Konsekvensen är enkelriktad, vilket gör den förutsägbar:**

1. Matar man in FTP där modellen vill ha CP blir taket **för lågt**.
2. Då blir `(P − CP)` **för stort** i varje arbetsintervall.
3. Alltså överskattas W′-förbrukningen.
4. Binärsökningen kompenserar med **lägre** föreskriven effekt.

Felet pekar åt samma håll som WB-3 och förstärker det. Två oberoende fel som båda gör
passen lättare är svårt att upptäcka, eftersom resultatet ser konsekvent ut.

### Åtgärd

**Kort sikt:** ändra etiketten till bara `CP (Critical Power)` och lägg till en förklaring
om att det inte är samma sak som FTP från ett 20-minuterstest. Ett fält som accepterar fel
storhet utan att säga till är värre än ett som kräver rätt.

**Rätt lösning:** hämta värdet från [`power-curve/`](07-fel-power-curve.md). `TP` och `HIE`
därifrån är **exakt** de `CP` och `W′` som denna modell efterfrågar — samma modell, samma
parametrar, samma enheter. De två verktygen är byggda för att hänga ihop; det står bara
ingenstans, och inget värde förs över.

En delad signatur skulle åtgärda WB-5 helt och samtidigt ge effektverktyget ett syfte
bortom att rita två kurvor.

---

## WB-6 — Mallen `8×(8×20s)` är 64 repetitioner

**Rad 25:**
```
{ name: "8×(8×20s)", sets: 8, reps: 8, work: 20, rest: 10, setRest: 180, restPercent: 0.3, type: "anaerobic" }
```

### Vad koden gör

8 set × 8 repetitioner = **64 repetitioner**. `calculateWorkoutStats` räknar fram
**51,7 minuter** total tid.

### Varför det är fel

Klassisk tabata är **ett** set om 8×20/10 — cirka fyra minuter. Åtta set är en mekanisk
extrapolation av mallformatet snarare än ett pass någon skulle köra.

Rent datafel: logiken är korrekt, konstanten är orimlig.

Det illustrerar samtidigt WB-1 och WB-2: binärsökningen returnerar ett snyggt svar
(243 W, 122 % av CP) för ett pass som ingen kan genomföra. **Verktyget uttalar sig lika
självsäkert om ett orimligt pass som om ett rimligt** — det finns ingen rimlighetsprövning
någonstans i kedjan.

### Åtgärd

Sätt `sets: 1`, eller döp om mallen till vad den faktiskt är. Överväg samtidigt en enkel
rimlighetsspärr på total tid — ett intervallpass över ~90 minuter är nästan alltid ett
inmatningsfel.

---

## Beroenden mellan felen

Tre par måste åtgärdas ihop, annars maskerar de varandra:

**WB-2 → WB-1.** Klippningen döljer att bottennivån aldrig kontrolleras. `2×15 min` ser ut
som ett klippningsfel men är i själva verket ett genomförbarhetsfel. **Vidgar man bara
sökintervallet får man ett svar som fortfarande kan vara ogenomförbart** — och nu utan
gränsvärdet som varningssignal, alltså sämre än förut.

**WB-3 → WB-5.** Båda gör föreskriven effekt för låg. Rättar man bara den ena kvarstår halva
biasen och ser ut som ett kvarvarande modellfel i den andra.

**WB-3 ↔ WB-4.** De pekar åt motsatt håll och maskerar delvis varandra. Rättar man WB-3
(asymptoten) utan att samtidigt se över τ blir passen plötsligt märkbart hårdare — vilket
är korrekt enligt modellen, men kommer att upplevas som en regression om man inte vet varför.

**Rekommenderad ordning:** WB-1 och WB-2 först (de är rena buggfixar och gör verktyget
ärligt om vad det inte vet), sedan WB-3 och WB-4 tillsammans (modellen), sist WB-5
(integrationen mot `power-curve/`).

---

## Sammanfattning: modell mot implementation

| | Fel |
|---|---|
| **Modellfel** — kräver att man ändrar vad som räknas | WB-3 (återhämtningens asymptot) |
| **Implementationsfel** — ren buggfix | WB-1 (bottennivån spåras inte), WB-2 (konvergens kontrolleras inte) |
| **Begrepps- och kalibreringsfel** | WB-4 (τ-default), WB-5 (CP mot FTP) |
| **Datafel** | WB-6 (tabata-mallen) |

**Det viktigaste att förstå:** W′bal-modellen i sig är korrekt implementerad. Den linjära
tömningen ovanför CP och den exponentiella återfyllnaden under CP är rätt — asymmetrin som
förklarar varför den femte intervallen alltid är värst finns på plats. Även den styckvisa
beräkningen per segment är matematiskt ekvivalent med den kontinuerliga formen.

Felen sitter i **ett tillägg till modellen** (WB-3), i **hur lösningen söks** (WB-1, WB-2)
och i **vad som matas in** (WB-4, WB-5). Kärnan är sund.

Och kärnidén — *föreskriv effekt ur ett mål för återstående W′ i stället för ur en procent
av FTP* — är repots bästa träningsmetodiska bidrag. Ett procenttal av FTP säger ingenting om
den totala anaeroba kostnaden; två pass på "110 % av FTP" kan vara trivialt olika beroende
på antal repetitioner, längd och vila. Att lösa ut effekten ur ett W′-mål väger in allt det
automatiskt. Felen ovan hindrar den idén från att leverera — de motbevisar den inte.
