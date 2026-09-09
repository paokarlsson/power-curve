# Critical Power-modellen (`power-curve/`)

## 1. Modellen  **[Etablerad]**

Tvåparametersmodellen (Monod & Scherrer 1965; Moritz 1981; Hill 1993) uttrycks i två
matematiskt identiska former, och verktyget visar båda samtidigt — vilket är dess pedagogiska
huvudpoäng:

| Form | Uttryck | Vad man ser |
|---|---|---|
| Effekt vs tid | `P(t) = TP + HIE / t` | Hyperbel. Asymptot mot TP. Intuitiv men svårläst. |
| Arbete vs tid | `W(t) = TP × t + HIE` | Rät linje. **Lutning = TP. Y-skärning = HIE.** |

Insikten som verktyget bygger på: *hyperbeln är svår att passa och läsa av för ögat, linjen är
trivial.* All parameterskattning sker därför i den linjära formen. Det är den korrekta
metodiken och den historiska anledningen till att modellen fick fäste.

## 2. Skattning ur två punkter  **[Etablerad]**

Ges två maximala insatser `(P₁, t₁)` och `(P₂, t₂)` är arbetet `W = P × t`, och
tvålinjesystemet löses exakt:

```
TP  = (P₁·t₁ − P₂·t₂) / (t₁ − t₂)
HIE = (P₁ − TP) · t₁
```

Algebran är korrekt. Men två punkter ger **exakt en lösning, alltid** — det finns ingen
residual, ingen konfidens, ingen möjlighet att upptäcka att en av testinsatserna var dålig.
Standardprotokoll använder 3–5 insatser och minsta kvadratanpassning just för att kunna se
när modellen inte passar. Detta är verktygets största metodologiska begränsning, och den är
osynlig i gränssnittet.

**Praktisk konsekvens:** felet i HIE förstärks kraftigt när `t₁` och `t₂` ligger nära varandra
(nämnaren `t₁ − t₂` går mot noll). Testpunkterna måste vara *väl separerade* i tid.

### Giltighetsdomän

Modellen är validerad ungefär i intervallet **2–15 minuter** (rimligt upp till ~20–30 min).
Under ~2 min överskattar den kapaciteten kraftigt (kroppen kan inte tömma W′ obegränsat
snabbt); över ~30 min underskattar den utmattningen (glykogen, värme, muskelskada finns
inte i modellen).

Verktygets defaultvärden — **260 W @ 210 s** och **220 W @ 630 s** (3,5 min och 10,5 min) —
ligger mitt i den giltiga domänen och är väl valda. Den hårdkodade exempeltexten i
gränssnittet nämner däremot 30 s och 300 s; **30 s ligger utanför modellens giltighet** och
skulle ge en systematiskt uppblåst HIE. Defaultvärdena är alltså bättre än exemplet.

Med defaultvärdena: **TP = 200 W, HIE = 12 600 J**.

## 3. "Fitness signature": PP, HIE, TP  **[Egen – problematisk]**

Terminologin PP / HIE / TP är hämtad från Xerts trekomponentssignatur (Peak Power,
High Intensity Energy, Threshold Power). Där är **PP en tredje, oberoende anpassad parameter**
som böjer kurvan vid mycket korta durationer, så att `P(t)` går mot ett ändligt maxvärde
istället för mot oändligheten när `t → 0`.

Verktyget använder bara tvåparametersmodellen och sätter:

```
PP = max(P₁, P₂)
```

Det är inte en modellparameter — det är bara den högsta siffran användaren skrev in.
Med defaultvärdena blir PP = 260 W, vilket är en 3,5-minuterseffekt, inte en peak power.
**PP-rutan bär ett namn den inte förtjänar.** Den påverkar inget annat i verktyget, så
felet är kosmetiskt men vilseledande.

Rätt lösning om PP ska betyda något är Mortons treparametersmodell (1996):

```
P(t) = CP + W′ / (t + W′/(Pmax − CP))
```

som ger en ändlig `Pmax` vid `t = 0` och kräver minst tre testpunkter.

## 4. "Area under kurvan (0–1 h)"  **[Egen – problematisk]**

Verktyget integrerar effektkurvan och presenterar resultatet som
*"total energi som kan produceras"*:

```
Area = ∫₁³⁶⁰⁰ (TP + HIE/t) dt = TP·(T − t₀) + HIE·ln(T/t₀)
```

Integralen är räknad rätt. **Tolkningen är fel**, av två skäl:

**(a) Varje punkt på kurvan är en separat maximal insats.** Kurvan är en *envelopp* över
oberoende prestationer, inte ett förlopp. Att integrera den summerar arbeten som aldrig kan
utföras i samma pass. Det maximala arbete som faktiskt kan utföras på en timme ges direkt
av den linjära formen: `W(3600) = TP·3600 + HIE`.

Med defaultvärdena:

| Storhet | Värde |
|---|---|
| Integralen (det verktyget visar) | **823 kJ** |
| `W(3600) = TP·3600 + HIE` (fysiologiskt korrekt) | **733 kJ** |
| Överskattning | **+12,3 %** |

**(b) Resultatet beror på en godtycklig undre gräns.** Termen `HIE·ln(T/t₀)` divergerar
när `t₀ → 0`. Koden sätter `t₀ = 1 s` utan motivering, och värdet vandrar med det valet:

| `t₀` | Area |
|---|---|
| 0,1 s | 852 kJ |
| **1 s** | **823 kJ** |
| 5 s | 802 kJ |
| 30 s | 774 kJ |

En storhet som ändras med 10 % beroende på var man godtyckligt börjar integrera är ingen
fysiologisk storhet.

**Rekommendation:** ersätt rutan med `TP·3600 + HIE` och kalla den *"maximalt arbete på 1 h"*.
Den är entydig, fysiologiskt tolkbar och skiljer sig ändå tillräckligt mycket mellan atleter
för att vara intressant. Alternativt behåll integralen men döp om den till vad den faktiskt är:
ett formmått på kurvan, inte en energi.

## 5. Robusthet

- `t₁ = t₂` ger division med noll och `TP = ±∞` utan felmeddelande. Löpverktyget har en
  motsvarande kontroll; effektverktyget saknar den.
- Om testpunkterna är fysiologiskt inkonsekventa (t.ex. högre *arbete* på den korta insatsen)
  blir **HIE negativt**, vilket är meningslöst men visas utan varning. Ett negativt HIE är i
  praktiken en användbar signal — det betyder att minst en av insatserna inte var maximal.
- Graferna extrapolerar från `0,5 × kortaste` till `2 × längsta` testtid, alltså utanför
  anpassningsintervallet i båda ändar. Det är rimligt för visualisering, men kurvan är
  minst pålitlig just vid sina ändpunkter — precis där ögat dras.

## 6. Vad parametrarna används till

- **TP** är taket. Det definierar zongränsen mellan hållbart och icke-hållbart arbete och
  är den siffra allt annat normaliseras mot ([03](03-normalized-power-och-tss.md)).
- **HIE (= W′)** är förrådet ovanför taket. Det är det som förbrukas i intervaller och som
  hela intervalloptimeraren är byggd kring ([04](04-wbal-och-intervalldesign.md)).

Notera att `wbal/` kallar samma tak för **"CP (Critical Power / FTP)"** och behandlar CP och
FTP som utbytbara. Det är de inte: FTP definieras protokollmässigt (ofta 95 % av ett
20-minuterstest), CP definieras matematiskt som asymptoten. CP ligger typiskt något **över**
FTP. Att mata in ett FTP-värde där modellen vill ha CP gör att W′-förbrukningen
systematiskt överskattas — se [04](04-wbal-och-intervalldesign.md) §7.
