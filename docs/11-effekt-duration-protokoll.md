# Effekt–duration: styckvis modell och testprotokoll

**En alternativ implementation av `power-curve/`.** Detta dokument beskriver inte kod som
finns i repot — det beskriver en annan modell för samma sak, och räknar ut vad den skulle
ge. Jämför med [01](01-critical-power.md), som dokumenterar verktyget som det faktiskt är
byggt idag.

Skillnaden i en mening: dagens verktyg passar **en** hyperbel genom **två** punkter och
ritar den från 0,5 × kortaste till 2 × längsta testtid. Denna implementation passar
hyperbeln **bara i mitten**, där den är validerad, och ritar ändarna ur data i stället för
ur modellen.

---

## 1. Modellen — tre domäner

Styckvis, tre grenar. Anpassa bara mitten, rita ändarna från data.

| Domän | Uttryck | Status |
|---|---|---|
| Kort, < 2 min | `P(t) = CP + W′ / (t + W′/(Pmax − CP))` | **[Etablerad]** — Morton 1996 |
| Mitten, 2–15 min | `P(t) = CP + W′/t` | **[Etablerad]** — Monod & Scherrer 1965 |
| Lång, > 20 min | `P(t) = CP · (1 − k·ln(t/T₀)) + W′/t`, `T₀ = 1200 s` | **[Egen – rimlig]** — se §8 |

Parametrar:

| Symbol | Enhet | Betydelse |
|---|---|---|
| `CP` | W | Taket. Zongränsen; allt normaliseras mot denna. |
| `W′` | J | Förrådet ovanför taket (= `HIE` i dagens verktyg). |
| `Pmax` | W | Sprintkapacitet. `P(0) = Pmax` i den korta grenen. |
| `k` | — | Durability. Det enda talet som säger något om långa lopp. |

Mittengrenen är samma tvåparametersmodell som repot redan använder. Det nya är att den
**bara** gäller 2–15 min, och att de två ändarna får egna uttryck i stället för att låta
hyperbeln extrapolera dit den inte håller.

Den korta grenen är Mortons treparametersmodell, alltså den modell som
[01 §3](01-critical-power.md) pekar ut som rätt lösning om `PP` ska betyda något. Här får
den ett värde ur ett faktiskt 10-sekunderstest, inte ur `max(P₁, P₂)`.

---

## 2. Anpassning: `P` mot `1/t`, aldrig `W` mot `t`  **[Etablerad]**

Passa alltid effekt mot inverterad tid. Substituera `x = 1/t`, så blir mittengrenen linjär:

```
P = CP + W′·x

W′ = Σ(xᵢ − x̄)(Pᵢ − P̄) / Σ(xᵢ − x̄)²
CP = P̄ − W′·x̄
```

Skälet att inte passa `W` mot `t` — som är den andra klassiska linjäriseringen, och den
[01](01-critical-power.md) bygger på — är att `W = P·t` har `t` på båda sidor. Det ger
ett falskt högt R², och felen mäts i joule, vilket låter långa tester dominera
anpassningen.

Samma tre mätpunkter, passade på båda sätten:

| Metod | CP | W′ | R² | Residualer |
|---|---|---|---|---|
| `P` mot `1/t` | **245,1 W** | **15 550 J** | 0,993 | −1,4 / +3,1 / −1,7 **W** |
| `W` mot `t` | 242,5 W | 16 415 J | **0,9999** | −658 / +846 / −188 **J** |

R² ser bättre ut i den undre raden, men det är en artefakt: `W` växer med `t` oavsett
atleten, så det mesta av variansen förklaras av att tiden går. Skillnaden i resultat är
inte försumbar — **865 J i W′, 5,6 %**.

Den avgörande praktiska skillnaden är den sista kolumnen. Residualerna blir **watt**, och
watt är direkt tolkbara: "3-minuterstestet låg 3 W över linjen" är en mening en atlet kan
värdera. "Testet låg 846 J över linjen" är det inte.

---

## 3. Protokollet — 6 punkter, 3 pass, 48 h mellan

### PASS A — CP-ankaret

```
12 min max
30 min lätt
3 min max
```

### PASS B — korta änden (dag 3)

```
10 s sprint, stående start, bästa av två
15 min lätt
45 s max
20 min lätt
5 min max
```

### PASS C — durability (dag 6)

```
2,5–3 h jämnt på 0,75 × CP, 60–90 g kolhydrat/h
direkt efter: 5 min max
```

### Punkternas roll  **[Egen – rimlig]**

| Punkt | Pass | Roll |
|---|---|---|
| 3 min | A | Anpassning (mitten) |
| 5 min | B | Anpassning (mitten) |
| 12 min | A | Anpassning (mitten) |
| 10 s | B | Ger `Pmax` direkt. Ingen anpassning. |
| 45 s | B | **Kontrollpunkt. Ingår aldrig i anpassningen.** |
| 5 min trött | C | Ger `k` |

Tre punkter till anpassningen är minimum för att en residual ska existera. Det är exakt
den bristen [01 §2](01-critical-power.md) och [PC-5](07-fel-power-curve.md) beskriver:
två punkter ger alltid en exakt lösning, utan möjlighet att se att ett test var dåligt.

**Att hålla 45-sekunderspunkten utanför anpassningen är protokollets bästa idé.** En punkt
som inte fått påverka modellen kan falsifiera den. Alla andra kvalitetsmått i detta
dokument mäter hur väl modellen passar data den redan sett.

---

## 4. Beräkning — genomräknat exempel

Testvärden:

| Punkt | Effekt |
|---|---|
| 10 s | 850 W |
| 45 s | 480 W |
| 3 min | 330 W |
| 5 min | 300 W |
| 12 min | 265 W |
| 5 min efter 2,5 h | 265 W |

### Steg 1 — CP och W′ ur 3/5/12 min

Anpassning av `P` mot `1/t` över de tre mittpunkterna:

```
CP = 245,1 W
W′ = 15 550 J
residualer: −1,45 / +3,11 / −1,66 W   (max 3,11 W)
```

Max residual 3,11 W < 8 W → passet godkänns.

### Steg 2 — Pmax

```
Pmax = 850 W          (10 s-värdet, ingen anpassning)
```

Tidskonstanten i den korta grenen följer direkt:

```
W′/(Pmax − CP) = 15 550 / (850 − 245,1) = 25,7 s
```

### Steg 3 — kontroll av 45 s

```
P(45) = CP + W′/(45 + 25,7) = 465,0 W
uppmätt: 480 W   →   +3,2 %
```

Under 5 % → **modellen håller i korta änden**. Hade 45-sekunderstestet gett 530 W vore
avvikelsen +14,0 %, och den korta grenen skulle ha degraderats till beskrivande data:
punkterna ritas, men inget läses av mellan dem.

Vad kontrollpunkten faktiskt skyddar mot syns i vad tvåparametersmodellen påstår om samma
durationer:

| Duration | Morton-grenen | `CP + W′/t` | Uppmätt |
|---|---|---|---|
| 45 s | 465 W | 591 W | 480 W |
| 10 s | 681 W | **1 800 W** | 850 W |

Tvåparametersmodellen missar 45-sekunderspunkten med +23 % och divergerar mot oändligheten
när `t → 0`. Det är samma fel som gör att `30 s` i verktygets hårdkodade exempeltext
([PC-6](07-fel-power-curve.md)) systematiskt blåser upp HIE.

### Steg 4 — durability

```
k = (P_fräsch − P_trött) / (P_fräsch · ln(t_pass/T₀))
  = (300 − 265) / (300 · ln(9000/1200))
  = 0,0579
```

### Steg 5 — nyckeltalet

```
P(3600) = CP·(1 − k·ln(3600/1200)) + W′/3600 = 233,8 W
P(60 min) / CP = 95,4 %
```

Jämför med vad mittengrenen skulle ha påstått om den fick extrapolera dit:

| Duration | Lång gren | Mittengrenen extrapolerad |
|---|---|---|
| 30 min | 247,9 W (101,2 % av CP) | 253,7 W (103,5 %) |
| 60 min | **233,8 W (95,4 %)** | 249,4 W (**101,8 %**) |
| 90 min | 226,6 W (92,5 %) | 247,9 W (101,2 %) |

Mittengrenen påstår att atleten kan hålla **mer än CP i en timme**. Det är
tvåparametersmodellens kända övertro på långa tider, och den långa grenen är till just för
att ta bort den. Se dock §8 — den tar inte bort tillräckligt mycket.

---

## 5. Reglerna, och vad de faktiskt fångar

| Regel | Status |
|---|---|
| Under 2 min ingår aldrig i CP-anpassningen | Drar CP uppåt. Kvantifierat i [01 §2](01-critical-power.md). |
| Över 20 min ingår aldrig i CP-anpassningen | Drar CP nedåt. |
| Testpunkter måste vara väl separerade i `1/t` | Samma sak som separation i tid: nämnaren går mot noll. Se [PC-5](07-fel-power-curve.md). |
| Använd aldrig två punkter | Två punkter ⇒ ingen residual ⇒ ingen diagnostik. |
| Max residual > 8 W → gör om passet | Se nedan. |
| `W′ ≤ 0` → minst en insats var inte maximal | Dagens verktyg visar negativ HIE utan varning, [PC-4](07-fel-power-curve.md). |
| Heldraget i anpassat intervall, streckat utanför | Dagens verktyg ritar allt likadant, inklusive extrapolationen. |

### Vad 8-wattsregeln fångar  **[Egen – rimlig]**

Regeln är ett grovt filter, inte ett precisionsinstrument, och dess känslighet beror på
punkternas placering. För punktuppsättningen 3/5/12 min flyttar sig mittpunktens residual
med **0,67 W per watt fel** på 5-minuterstestet:

| 5-min-testet | CP | W′ | Residualer | Max |
|---|---|---|---|---|
| korrekt (300 W) | 245,1 W | 15 550 J | −1,4 / +3,1 / −1,7 | 3,1 W |
| −10 W (290 W) | 241,4 W | 15 657 J | +1,7 / −3,6 / +1,9 | 3,6 W |
| −15 W (285 W) | 239,5 W | 15 710 J | +3,2 / −6,9 / +3,7 | 6,9 W |
| −20 W (280 W) | 237,7 W | 15 763 J | +4,8 / −10,2 / +5,4 | **10,2 W** |

Tröskeln nås alltså först vid ungefär **17 W för lågt** på mittpunkten — ett 5-minuterstest
som missats med nästan 6 %. Ett test som missats med 15 W passerar, och kostar 5,5 W i CP.
Regeln fångar haverier, inte slarv.

Notera också asymmetrin: eftersom baslinjens residual redan ligger på +3,1 W triggar ett
**för högt** 5-minutersvärde redan vid +7 W. Det är en egenskap hos just detta dataset,
inte hos regeln.

---

## 6. Pacing per domän  **[Etablerad tränarpraxis]**

| Duration | Fördelning |
|---|---|
| < 15 s | Allt från start. Ingen fördelning finns att göra. |
| 15 s–2 min | Aggressiv start — driver upp syreupptaget snabbare. |
| 2–15 min | +5 % första 30–45 s, sedan jämnt. |
| > 30 min | Jämnt till svagt fallande. |
| Kuperat | Variera runt CP. |

Den kuperade raden vilar på W′bal-dynamiken: W′ laddas tillbaka 5–7 gånger långsammare än
det töms, och **bara under CP**. Det är samma asymmetri som hela intervalloptimeraren är
byggd kring — se [04 §1](04-wbal-och-intervalldesign.md). Det innebär att
återhämtningsavsnitten i ett kuperat lopp måste ligga meningsfullt under CP för att räknas;
en "vila" på 0,95 × CP återhämtar nästan ingenting.

---

## 7. Skarvarna

Den styckvisa konstruktionen betalar ett pris i grenarnas gränser.

**Vid 20 min är skarven exakt.** Sätt `t = T₀ = 1200 s` i den långa grenen:
`ln(T₀/T₀) = 0`, alltså `P = CP + W′/t` — identiskt med mittengrenen. Kontinuiteten är
inbyggd i valet av `T₀`, inte tillfällig. Med exemplets siffror: 258,02 W från båda hållen.

**Vid 2 min är den det inte.** Morton-grenen och mittengrenen möts inte:

```
Morton:          CP + W′/(120 + 25,7) = 351,8 W
Tvåparameter:    CP + W′/120          = 374,6 W
hopp:            22,9 W (6,5 %)
```

Modellen har alltså ett **språng på 23 W vid 2-minutersgränsen**, och språnget är inget
fel i data — det är skillnaden mellan de två modellformerna, som blir synlig när man
klistrar ihop dem. Tre sätt att hantera det:

**1. Rita språnget.** Det är sant, och det visar var modellen byter regim. Billigast och
minst vilseledande.

**2. Låt Morton-grenen gälla hela vägen upp till 15 min.** Formerna konvergerar när
`t ≫ W′/(Pmax − CP)`, så i den långa änden av anpassningsintervallet är skillnaden liten:

| `t` | Morton | `CP + W′/t` | Skillnad |
|---|---|---|---|
| 2 min | 351,8 W | 374,6 W | 6,50 % |
| 3 min | 320,7 W | 331,5 W | 3,37 % |
| 5 min | 292,8 W | 296,9 W | 1,40 % |
| 12 min | 265,9 W | 266,7 W | **0,28 %** |

Men `CP` och `W′` anpassades med mittengrenens form. Ritas Morton med dem missar kurvan
3-minuterspunkten med 9,4 W medan 12-minuterspunkten träffas inom 0,7 W — språnget har
flyttat från skarven in i residualerna. Alternativet är bara hederligt om Morton-formen
också används i **anpassningen**, med `Pmax` låst från 10-sekunderstestet. Gjort så på
exemplets tre punkter:

```
CP = 240,4 W    (−4,7 W)
W′ = 19 150 J   (+3 600 J, +23 %)
residualer: −0,97 / +1,83 / −0,87 W   (max 1,83 W, mot 3,11 W)
P(45) = 491 W  →  −2,2 % mot uppmätt   (fortfarande inom 5 %)
```

Passformen blir bättre och kontrollpunkten håller fortfarande. Men `W′` växer med 23 %,
och det är ingen mätning som ändrats — det är att `W′` **betyder olika saker** i två- och
treparametersmodellen. Ett `W′` anpassat så får inte matas rakt in i
[`wbal/`](04-wbal-och-intervalldesign.md), som förutsätter tvåparametersdefinitionen. Det
är samma sorts tyst enhetsbyte som [01 §6](01-critical-power.md) beskriver för CP kontra
FTP.

**3. Blenda grenarna över 2–3 min.** Ger en snygg kurva och en parameter som inte betyder
något. Det är den sorts konstruktion detta repo redan har för mycket av.

Alternativ 1 för att läsa av, alternativ 2 med omanpassning om en enda kurva krävs.

**Mellan 15 och 20 min finns ingen gren alls.** Mittengrenen är anpassad till 15 min, den
långa börjar vid 20. Glappet ritas som streckad mittengren — extrapolation, markerad som
extrapolation. Det är precis vad ritregeln föreskriver.

---

## 8. Durability-grenen — vad som inte går ihop  **[Egen – problematisk]**

Begreppet durability är etablerat i litteraturen. Den funktionsform som används här —
ett tak som faller logaritmiskt med `ln(t/T₀)` — är det inte. Den har två problem, och
det andra är mätbart.

### (a) Tidsargumentet är ett annat än mätningen

`k` mäts genom att köra 2,5 h på 0,75 × CP och sedan testa 5 min. Men `k` används sedan med
`t` = **insatsens egen längd**. Modellen antar därmed att en timmes tävlande tröttar ungefär
som en timmes körning på 0,75 × CP. Det gör det inte — att ligga på CP i en timme är
väsentligt dyrare än att ligga på 0,75 × CP i en timme.

Skarven är alltså: `k` kalibreras i *förtröttningens* tidsskala och tillämpas i
*insatsens*. Riktningen på felet är känd — modellen underkorrigerar.

### (b) Bandet nås inte

Dokumentet anger själv att `P(60 min)/CP` typiskt ligger på **86–94 %**. Exemplet ovan
landar på **95,4 %**, alltså över bandet. Det är inte exemplets fel. Räknat baklänges:

| Mål `P(60)/CP` | Krävd `k` | Motsvarande fall i 5-min-effekt efter 2,5 h |
|---|---|---|
| 94 % | 0,071 | −14,2 % (43 W av 300 W) |
| 90 % | 0,107 | −21,6 % (65 W av 300 W) |
| 86 % | 0,144 | −28,9 % (87 W av 300 W) |

Ett fall på 21,6 % i 5-minuterseffekt efter 2,5 h på 0,75 × CP är inte en normalt uthållig
motionär — det är en dålig dag. Mätt från andra hållet:

| Uppmätt fall efter 2,5 h | `k` | `P(60 min)/CP` |
|---|---|---|
| −5 % | 0,025 | 99,0 % |
| −10 % | 0,050 | 96,3 % |
| −15 % | 0,074 | 93,6 % |
| −20 % | 0,099 | 90,9 % |

**Ett realistiskt Pass C ger `P(60 min)/CP` runt 95–97 %, inte 86–94 %.** Grenen är en klar
förbättring mot de 101,8 % mittengrenen påstår, men den når inte hela vägen, och den siffra
protokollet själv anger som nyckeltal är inte den siffra protokollet själv producerar.

Åtgärden är inte att justera `T₀` tills det stämmer — det vore att passa en parameter mot
en förväntning i stället för mot data. Antingen mäts `k` mot ett långt maxtest (dyrt: ett
60-minuterstest gör hela grenen överflödig, eftersom då har man punkten), eller så byter
tidsargumentet mening: `t` blir *ackumulerat arbete* i stället för duration, vilket kopplar
grenen till vad atleten faktiskt gjort före insatsen. Det senare är en annan modell, inte
en justering av denna.

---

## 9. Vad detta skulle lösa i dagens `power-curve/`

| Fel idag | Åtgärdas? |
|---|---|
| [PC-1](07-fel-power-curve.md) — "area under kurvan" är ingen energi | Nej. Orört — se [01 §4](01-critical-power.md) för åtgärden. |
| [PC-2](07-fel-power-curve.md) — `PP` är inte en peak power | **Ja.** `Pmax` kommer ur ett 10-sekunderstest och används i Morton-grenen. |
| [PC-3](07-fel-power-curve.md) — lika testtider ger `Infinity` | **Ja, strukturellt.** Minstakvadrat över ≥ 3 punkter har ingen `t₁ − t₂` i nämnaren. Separationskravet finns kvar som regel. |
| [PC-4](07-fel-power-curve.md) — negativ HIE utan varning | **Ja.** `W′ ≤ 0` är en uttrycklig regel med en tolkning: minst en insats var inte maximal. |
| [PC-5](07-fel-power-curve.md) — tvåpunktsmetoden förstärker mätfel | **Delvis.** Residualen gör felet synligt, men 8-wattsregeln fångar bara grova missar (§5). |
| [PC-6](07-fel-power-curve.md) — hårdkodade exempelvärden utanför domänen | **Ja.** Domängränserna är explicita regler, inte en kommentar i en exempeltext. |

Priset: **6 testpunkter över 3 pass i stället för 2 siffror i två rutor**, plus en
anpassningsrutin i stället för två rader algebra.

---

## 10. Minimivarianten

Pass B och C kostar ungefär två träningsveckor — inte i passtid, utan i att tre maxtest och
ett 3-timmarspass med efterföljande maxtest inte kan läggas ovanpå en normal träningsvecka.

**Om du inte tävlar långt räcker Pass A plus en extra punkt.** Tre punkter i 2–15 min ger
CP, W′ och en residual, vilket är allt som behövs för zoner och intervallplanering
([04](04-wbal-och-intervalldesign.md)). Då utgår:

- `Pmax` och Morton-grenen — korta änden blir odefinierad i stället för fel.
- `k` och den långa grenen — och därmed nyckeltalet `P(60 min)/CP`.

Det som inte utgår är trepunktskravet. Två punkter ger fortfarande ingen residual, och det
är den enda delen av detta dokument som är gratis.
