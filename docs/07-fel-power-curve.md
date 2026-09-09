# Fellista: `power-curve/`

Alla fel i Critical Power-verktyget. Berör en enda fil: **`power-curve/index.html`**,
och fyra av sex fel sitter inom sju rader (120–126).

**Inget är åtgärdat.** Siffrorna är uppmätta genom att köra koden, inte uppskattade.

## Feltyper som används i detta dokument

| Typ | Innebörd |
|---|---|
| **Modellfel** | Modellen är olämplig eller feltolkad. Koden gör precis vad den ska — det är *vad* den räknar som är fel. Går inte att fixa med bättre kod. |
| **Implementationsfel** | Modellen är rätt, men koden gör inte det den avser. Ren buggfix. |
| **Begreppsfel** | Beräkningen är korrekt, men resultatet presenteras som något det inte är. Namn- eller etikettfråga. |
| **Metodgräns** | Inget fel — en gräns för vad metoden kan leverera. Kan inte åtgärdas, bara synliggöras. |

## Översikt

| ID | Fel | Rad | Typ | Storlek |
|---|---|---|---|---|
| **PC-1** | "Area under kurvan" är ingen energi | 126, 144–145 | **Modellfel** | +12,3 %, plus godtycklig `t₀` |
| **PC-2** | `PP` är inte en peak power | 122, 53, 140 | **Modellfel** + begreppsfel | kosmetiskt |
| **PC-3** | Lika testtider ger `Infinity` | 120 | **Implementationsfel** | totalhaveri i kantfall |
| **PC-4** | Negativ HIE visas utan varning | 121 | **Implementationsfel** | missad diagnostik |
| **PC-5** | Tvåpunktsmetoden förstärker mätfel | 120–121 | **Metodgräns** | 13 % fel i HIE vid 5 W mätfel |
| **PC-6** | Föråldrade hårdkodade exempelvärden | 53, 66–67, 96–97 | **Implementationsfel** | vilseledande vid första anblick |

---

## PC-1 — "Area under kurvan" är ingen energi

**Rad 126:** `const area = CP * (T - t0) + Wprime * Math.log(T / t0);`
**Rad 144–145:** visar resultatet som *Area (0-1h)* och *≈ 273W avg*

### Vad koden gör

Integrerar effektkurvan `P(t) = TP + HIE/t` från 1 sekund till 3600 sekunder och
presenterar summan som *"total energi som kan produceras"*.

### Varför det är fel

**Integralen är rätt uträknad.** Felet ligger i vad man tror att den betyder — därför är
det ett modellfel, inte en bugg.

**Skäl 1: kurvan är en envelopp, inte ett förlopp.** Varje punkt på en
power–duration-kurva är en **separat maximal insats**. Punkten vid 5 minuter säger "om du
kör allt du har i 5 minuter orkar du X watt". Punkten vid 20 minuter säger samma sak för
20 minuter. De två kan inte utföras i samma pass — kör du 5-minuterspunkten maximalt är du
tom och kan inte sedan leverera 20-minuterspunkten.

Att integrera kurvan summerar alltså arbeten som **utesluter varandra**. Det är som att
summera din maxvikt i marklyft, knäböj och bänkpress och kalla det "total styrka" — talet
går att räkna fram, men motsvarar ingenting du kan göra.

Det maximala arbete som faktiskt kan utföras på en timme ges direkt av modellens linjära
form: `W(3600) = TP·3600 + HIE`.

| Storhet (defaultvärden: TP 200 W, HIE 12,6 kJ) | Värde |
|---|---|
| Integralen (det verktyget visar) | **823 kJ** |
| `TP·3600 + HIE` (fysiologiskt korrekt) | **733 kJ** |
| Överskattning | **+12,3 %** |

**Skäl 2: talet beror på en godtycklig undre gräns.** Termen `HIE·ln(T/t₀)` divergerar när
`t₀ → 0`. Koden väljer `t₀ = 1 s` utan motivering, och resultatet vandrar med det valet:

| `t₀` | Area |
|---|---|
| 0,1 s | 852 kJ |
| **1 s** | **823 kJ** |
| 5 s | 802 kJ |
| 30 s | 774 kJ |

En fysiologisk storhet får inte röra sig 10 % beroende på var man godtyckligt börjar
integrera. Att den gör det är ett bevis på att den inte mäter något verkligt.

### Åtgärd

**Byt storhet, inte formel.** Poängen är att förstå *varför* den linjära formen är den
rätta: modellen säger `W(t) = TP·t + HIE`, alltså "arbetet du klarar på tiden t". Det är
redan svaret på frågan "hur mycket orkar jag på en timme" — sätt bara in `t = 3600`. Ingen
integration behövs, eftersom modellen redan är formulerad i arbete.

Ersätt rutan med `TP·3600 + HIE`, döp den *"Maximalt arbete på 1 h"*. Den blir entydig,
oberoende av godtyckliga gränser, och skiljer sig ändå tillräckligt mellan atleter för att
vara intressant.

Vill man behålla integralen måste den döpas om till vad den är — ett formmått på kurvan —
och då bör `t₀` sättas till modellens giltighetsgräns (~120 s) snarare än 1 s, eftersom
kurvan under den gränsen ändå inte beskriver verkligheten.

---

## PC-2 — `PP (Peak Power)` är inte en peak power

**Rad 122:** `const PP = Math.max(P1, P2);`
**Rad 53, 140:** rutan `ppValue`

### Vad koden gör

Sätter PP till den högsta av de två inmatade effekterna.

### Varför det är fel

Termerna **PP / HIE / TP** kommer från Xerts trekomponentssignatur. Där är **PP en
självständigt anpassad tredje parameter** som böjer kurvan vid mycket korta durationer, så
att `P(t)` går mot ett ändligt maxvärde i stället för mot oändligheten när `t → 0`.

Verktyget använder bara **tvåparametersmodellen**. I den finns ingen PP — kurvan
divergerar per definition. Rutan visar därför inte en modellparameter utan bara den
största siffran användaren skrev in. Med defaultvärdena blir PP = 260 W, vilket är en
**3,5-minuterseffekt**. En verklig peak power för samma atlet ligger typiskt kring
800–1200 W.

Det är ett modellfel eftersom det inte går att räkna fram PP ur två punkter — informationen
finns helt enkelt inte i indata. Ingen kodändring kan skapa den.

**Omfattning:** rent kosmetiskt. PP läses aldrig av någon annan beräkning, påverkar ingen
kurva och exporteras inte. Felet är att en ruta bär ett namn den inte förtjänar, bredvid
tre rutor som gör det.

### Åtgärd

Två vägar, beroende på ambition:

**Billig väg — var ärlig.** Döp om rutan till *"Högsta testeffekt"*. Då stämmer den, och
signaturen presenteras som vad den är: en tvåparametersmodell.

**Dyr väg — mät faktiskt PP.** Inför Mortons treparametersmodell:

```
P(t) = CP + W′ / (t + W′/(Pmax − CP))
```

Den ger en ändlig `Pmax` vid `t = 0`. Men den kräver **minst tre testpunkter**, varav en
mycket kort (5–15 s), och en icke-linjär anpassning — man kan inte längre lösa ut
parametrarna exakt med algebra. Det är en verklig utbyggnad av verktyget, inte en fix.

---

## PC-3 — Lika testtider ger `Infinity` utan felmeddelande

**Rad 120:** `const CP = (P1 * t1 - P2 * t2) / (t1 - t2);`

### Vad koden gör

Nämnaren `t₁ − t₂` kontrolleras aldrig.

### Varför det är fel

Med två insatser på samma tid blir `TP = Infinity` och `HIE = −Infinity`. Gränssnittet
skriver ut **`InfinityW`** och **`-InfinitykJ`** i signaturrutorna och ritar tomma grafer.

Rent implementationsfel: modellen är helt korrekt, den är bara odefinierad i den punkten,
och koden kontrollerar inte det. Löpverktyget har motsvarande kontroll (`t1 === t2` på
`running/index.html:367`) — den saknas bara här.

Kantfallet är inte konstruerat. Två insatser på samma tid är precis vad man matar in när
man vill jämföra "hur mycket bättre är 280 W än 260 W på 5 minuter" — en naturlig sak att
prova.

### Åtgärd

Kontrollera `t₁ ≠ t₂` innan beräkningen och visa ett begripligt meddelande. Kopiera
mönstret från `running/index.html:367`, som redan gör detta rätt.

Den pedagogiska poängen bakom kontrollen: modellen behöver **två skilda punkter på
tidsaxeln** för att kunna bestämma en lutning. Två punkter på samma tid definierar ingen
linje. Felmeddelandet bör säga just det — "testerna måste ha olika längd" — inte
"ogiltigt värde".

---

## PC-4 — Negativ HIE visas som ett giltigt resultat

**Rad 121:** `const Wprime = (P1 - CP) * t1;`

### Vad koden gör

Räknar ut HIE och visar det, oavsett tecken.

### Varför det är fel

Om testpunkterna är fysiologiskt inkonsekventa — den **korta** insatsen gav *lägre* totalt
arbete än den långa — blir HIE negativt. Exempel: 240 W @ 210 s mot 250 W @ 630 s ger
`TP = 255 W` och **`HIE = −3150 J`**.

Ett negativt anaerobt förråd är meningslöst: det påstår att du orkar *mindre* än ditt
uthålliga tak. Men det visas utan varning, med tre värdesiffror, precis som ett giltigt
resultat.

Implementationsfel, inte modellfel — modellen upptäcker tillståndet alldeles utmärkt, koden
låter bara bli att reagera på det.

### Åtgärd

**Detta är det mest värdefulla felet att åtgärda i hela verktyget**, för negativ HIE är
inte bara skräp — det är modellens enda inbyggda kvalitetskontroll.

Negativt HIE betyder nästan alltid att **minst en av insatserna inte var maximal**: antingen
sparade atleten sig i det korta testet, eller pressade sig ovanligt hårt i det långa. Det är
exakt den information man behöver för att veta att testet ska göras om.

Visa därför inte bara ett fel, utan en tolkning: *"Negativ HIE — testpunkterna är
inkonsekventa. Den korta insatsen gav mindre totalt arbete än den långa, vilket betyder att
minst ett av testerna inte var maximalt."* Ett verktyg som förklarar varför data är dålig är
mer värt än ett som bara vägrar räkna.

---

## PC-5 — Tvåpunktsmetoden förstärker mätfel, och det syns inte

**Rad 120–121:** hela skattningen
*(samma gäller `running/index.html:373–375` — se [08 — Fel i running](08-fel-running.md).)*

### Vad koden gör

Löser ut TP och HIE exakt ur två punkter.

### Varför det är en gräns snarare än ett fel

Två punkter ger **exakt en lösning, alltid**. Det finns ingen residual, ingen
konfidensskattning, och ingen möjlighet att upptäcka att en insats var dålig. Standard-
protokoll använder 3–5 insatser och minsta kvadratanpassning just av det skälet.

Förstärkningen är mätbar. Punkt 1 hålls fast vid 260 W @ 210 s; punkt 2 väljs så att
modellen ger exakt TP = 200 W och HIE = 12,6 kJ. Sedan läggs **5 W mätfel** på punkt 2:

| t₂ | Separation | TP-svängning | HIE-svängning |
|---|---|---|---|
| 630 s | 420 s | +7,5 W | −1,6 kJ |
| 420 s | 210 s | +10,0 W | −2,1 kJ |
| 330 s | 120 s | +13,8 W | −2,9 kJ |
| 270 s | 60 s | +22,5 W | −4,7 kJ |
| 240 s | 30 s | **+40,0 W** | **−8,4 kJ** |

Även vid verktygets **väl valda** defaultseparation på 420 s flyttar 5 W fel på en testpunkt
tröskeleffekten 7,5 W och det anaeroba förrådet 1,6 kJ — **13 % av HIE**. Ligger testerna
närmare varandra i tid blir skattningen snabbt oanvändbar.

Varför förstärkningen uppstår: TP är **lutningen** mellan två punkter i arbete–tid-planet.
Ju närmare punkterna ligger varandra på tidsaxeln, desto mer svänger lutningen av en liten
vertikal störning. Det är samma geometri som gör att man siktar med ett långt sikte, inte
ett kort.

### Åtgärd

Detta går inte att "fixa" — det är metodens natur. Men det går att **synliggöra**, och det
är minst lika viktigt:

1. **Varna vid för liten separation.** Under ~180 s mellan testtiderna är skattningen
   opålitlig. Säg det.
2. **Visa känsligheten.** Räkna om TP och HIE med ±5 W på varje punkt och visa spannet:
   *"TP 200 W (±8 W)"*. Då förstår användaren att den tredje värdesiffran är fiktion.
3. **Tillåt fler punkter.** Med 3–5 insatser och minsta kvadratanpassning får man både en
   stabilare skattning och en residual som avslöjar dåliga tester. Det är den riktiga
   lösningen, och den kräver ingen ny fysiologi — bara en linjär regression i stället för
   en algebraisk lösning.

---

## PC-6 — Föråldrade hårdkodade exempelvärden

**Rad 53, 66–67:** `400W`, `982kJ`, `≈ 273W avg` som statisk HTML
**Rad 96–97:** exempeltexten `400W @ 30s` och `280W @ 300s`

### Vad koden gör

Rutorna innehåller hårdkodade platshållarvärden som skrivs över först när `calculateCurve()`
körts. De motsvarar inte de faktiska defaultvärdena (som ger TP 200 W, HIE 12,6 kJ,
area 823 kJ).

### Varför det är fel

Två problem, varav det andra är det allvarliga:

**(a)** Platshållarna är inkonsekventa med indata. Om skriptet av någon anledning inte kör
visas siffror som ser trovärdiga ut men inte hör ihop med något.

**(b) Exempeltexten lär ut fel testprotokoll.** Den nämner **30 s** och 300 s som
testpunkter. 30 sekunder ligger **utanför CP-modellens giltighetsdomän** (~2–15 min) och
skulle ge en systematiskt uppblåst HIE, eftersom en 30-sekundersinsats domineras av
neuromuskulär effekt som modellen inte beskriver.

Verktygets faktiska defaultvärden (210 s och 630 s) är **väl valda och ligger mitt i den
giltiga domänen**. Exempeltexten motsäger alltså den goda praxis koden själv använder.

### Åtgärd

Låt exempeltexten spegla defaultvärdena, och skriv ut varför de är valda: *"Använd två
maximala insatser mellan 3 och 12 minuter, med minst 3 minuters skillnad i längd."* Det är
en rad text som lär användaren mer om modellen än hela resten av gränssnittet.

---

## Sammanfattning: modell mot implementation

| | Fel |
|---|---|
| **Modellfel** — kan inte kodas bort | PC-1 (integralen mäter fel sak), PC-2 (PP finns inte i en tvåparametersmodell) |
| **Implementationsfel** — ren buggfix | PC-3 (nollkontroll), PC-4 (varning saknas), PC-6 (platshållare och exempeltext) |
| **Metodgräns** — kan bara synliggöras | PC-5 (tvåpunktsförstärkning) |

**Det viktigaste att förstå:** verktygets *beräkningar* är korrekta. `TP` och `HIE` löses
rätt ur ekvationerna, båda kurvformerna är rätt implementerade, och defaultvärdena är
välvalda. Felen sitter i **vad som räknas fram utöver det** (PC-1, PC-2) och i **vad som
inte sägs** (PC-4, PC-5, PC-6).

Ett verktyg som räknar rätt men tiger om osäkerheten inbjuder till övertro. Fyra av sex
åtgärder ovan handlar därför om att **säga mer**, inte att räkna annorlunda.

## Koppling till övriga verktyg

`TP` och `HIE` från detta verktyg är **exakt** de `CP` och `W′` som
[`wbal/`](09-fel-wbal.md) efterfrågar. Att verktygen inte delar värden är en av orsakerna
till felet [WB-5](09-fel-wbal.md) (CP och FTP behandlas som samma sak). Ett gemensamt
signaturvärde skulle åtgärda båda.
