# W′bal och intervalldesign (`wbal/`)

Det här verktyget innehåller repots skarpaste träningsmetodiska idé — och dess allvarligaste
modellfel. Båda är värda att förstå.

## 1. W′bal-konceptet  **[Etablerad]**

W′bal (Skiba m.fl. 2012) beskriver hur det anaeroba förrådet W′ töms och återfylls under
intermittent arbete:

- **Ovanför CP:** förrådet töms **linjärt** med överskottet.
  `förbrukat = (P − CP) × tid`
- **Under CP:** förrådet återfylls **exponentiellt** mot fullt, med tidskonstant τ.
  `W′bal ← W′ − (W′ − W′bal) · e^(−vila/τ)`

Asymmetrin — linjär tömning, exponentiell återfyllnad — är hela poängen och är korrekt
implementerad. Den förklarar varför den femte intervallen alltid är värst: återfyllnaden
under vilan hinner aldrig ikapp tömningen under arbetet, så bottennivån vandrar nedåt
rep för rep.

Verktyget simulerar detta segment för segment genom hela passet. Eftersom effekten antas
konstant inom varje segment är den styckvisa beräkningen matematiskt ekvivalent med den
kontinuerliga formen — ingen approximation förloras där.

## 2. τ som fri parameter  **[Egen – rimlig, men default är optimistisk]**

I Skibas originalmodell är τ **inte** fri. Den anpassas till återhämtningsintensiteten:

```
τ = 546 · e^(−0,01 · D_CP) + 316      där D_CP = CP − medeleffekt under vilan
```

Poängen är att τ ligger runt **300–500+ sekunder** för realistiska vilointensiteter.
Verktyget gör istället τ till en användarinställning med **default 180 s**, alltså
betydligt snabbare återhämtning än Skibas anpassning ger. Att exponera τ är i sig
rimligt — den varierar kraftigt individuellt och är svår att mäta — men defaultvärdet
gör passen lättare än modellen egentligen förutsäger.

## 3. Återhämtningsfaktorn  **[Egen – problematisk]**

Verktyget lägger till en egen mekanism ovanpå Skiba: vilointensiteten viktar **hur mycket**
som återhämtas, via en linjär faktor:

```
återhämtningsfaktor = (CP − viloeffekt) / CP
återhämtat = (W′ − W′bal) · (1 − e^(−vila/τ)) · återhämtningsfaktor
```

**Riktningen är riktig.** Faktorn ger 1,0 vid total vila (0 W) och 0 vid vila på CP —
vilket stämmer med fysiologin: ligger man på CP återhämtar man ingenting. Att låta
vilointensiteten spela roll är helt korrekt tänkt.

**Men den sitter på fel ställe.** I Skibas modell påverkar vilointensiteten τ — alltså
*hastigheten*. Här multipliceras den istället på *mängden*, vilket ger en felaktig asymptot:

> Med återhämtningsfaktor 0,5 kan man **aldrig återhämta mer än halva underskottet**,
> hur lång vilan än är.

Uträknat, med W′ = 15 kJ, W′bal = 6 kJ (underskott 9 kJ), viloeffekt 0,5 × CP:

| Vila | W′bal efter |
|---|---|
| 60 s | 7 276 J |
| 180 s | 8 845 J |
| 600 s | 10 339 J |
| 1 h | 10 500 J |
| 10 h | **10 500 J** ← taket |

Efter tio timmars vila är förrådet fortfarande bara på 70 % av fullt. Det är fysiologiskt
orimligt och gör att verktyget **systematiskt underskattar** hur hårt man kan köra pass med
långa vilor.

**Fix:** flytta in vilointensiteten i τ (`τ_effektiv = τ / återhämtningsfaktor`, eller
Skibas egen `D_CP`-anpassning) istället för att multiplicera på mängden. Då bevaras både
den rätta riktningen och den rätta asymptoten.

## 4. Kärnidén: föreskriv effekt ur mål-W′bal  **[Egen – och detta är det värdefulla]**

Detta är verktygets faktiska bidrag, och det är en riktigt bra idé.

Konventionell intervallföreskrift anger **procent av FTP** — "kör 4×4 på 110 %". Problemet
är att `%FTP` inte säger något om den totala anaeroba kostnaden. Dessa två pass föreskrivs
identiskt men är helt olika:

- 4 × 4 min @ 110 % med 3 min vila
- 12 × 4 min @ 110 % med 1 min vila

Verktyget vänder på styrningen:

> **Ange hur mycket W′ som ska återstå när passet är slut. Lös ut den effekt som ger det.**

Det är rätt sätt att tänka, eftersom det som avgör om ett pass är genomförbart och
återupprepbart inte är intensiteten i sig utan **hur nära botten man hamnar**. Reps,
duration, vilolängd och viloeffekt vägs automatiskt in, eftersom de alla ingår i
simuleringen.

**Mål-reserven** (default 30 % av W′ kvar) är en egen men vettig konstruktion: den kodar
principen *"passet ska vara hårt men inte tömmande"* — tillräckligt kvar för att kunna
avsluta kontrollerat och träna igen inom rimlig tid.

**Lösningsmetoden** är binärsökning över effektintervallet 105 %–150 % av CP, 30 iterationer,
tolerans 100 J. Det bygger på att slut-W′bal är monotont avtagande i effekt — vilket
gäller här, om än inte helt trivialt: högre effekt ger djupare underskott, vilket ger
*mer* återhämtning under vilorna, som delvis motverkar. Nettot är ändå monotont.

## 5. Där föreskrivningen brister

### (a) Sökintervallet klipper tyst  **[Egen – problematisk]**

Om lösningen ligger utanför 105–150 % av CP returneras **gränsvärdet utan varning**.
Kört på defaultvärdena (CP 200 W, W′ 15 kJ, τ 180 s, mål 30 %):

Kolumnen *sant svar* är lösningen med vidgat sökintervall (0,5–4 × CP):

| Pass | Föreskrivet | % CP | W′bal vid slut | Sant svar | Status |
|---|---|---|---|---|---|
| 4×4 min | 218 W | 109 % | 4 323 J | 218 W | ok (mål 4 500 J) |
| 8×2 min | 221 W | 110 % | 4 411 J | 221 W | ok |
| 12×1 min | 233 W | 117 % | 4 601 J | 233 W | ok |
| 10×1 min | 244 W | 122 % | 4 574 J | 244 W | ok |
| 3×8 min | 210 W | **105 %** | 4 425 J | 210 W | klippt, men sammanfaller |
| 4×6 min | 211 W | **105 %** | 4 219 J | 211 W | klippt, men sammanfaller |
| 2×10 min | 210 W | **105 %** | 4 947 J | 210 W | klippt, men sammanfaller |
| **2×15 min** | 210 W | **105 %** | **−155 J** | **207 W (103 %)** | **fel svar** |

Klippningen **biter** bara när den sanna lösningen ligger utanför intervallet, och bland de
20 mallarna gäller det enbart `2×15 min`. För de tre övriga sammanfaller gränsvärdet med
det korrekta svaret — de är klippta men råkar ha rätt.

`2×15 min` är det avslöjande fallet. Verktyget rekommenderar 210 W, men vid 210 W är
förrådet **slut före passets slut** — W′bal landar på −155 J, vilket betyder att atleten
inte kan fullfölja. Rekommendationen visas ändå, i samma format och med samma auktoritet
som de fungerande passen.

**Läsregel tills detta är fixat:** ett resultat på exakt **105 %** eller **150 %** betyder
att sökningen tog slut, inte nödvändigtvis att svaret är fel. Kontrollera det separat —
det kan sammanfalla med rätt svar, eller vara ogenomförbart som `2×15 min`.

### (b) Bara sluttillståndet begränsas  **[Egen – problematisk]**

Simuleringen kontrollerar enbart W′bal **vid passets slut**. För de flesta mallarna spelar
det ingen roll — med lika långa arbetsintervall ligger bottennivån i slutet av sista
repetitionen, så slutvärdet *är* minimum. Men i pyramiderna ligger det längsta arbetsblocket
i mitten, och då inträffar bottennivån mitt i passet:

| Pass | Slut-W′bal | Lägsta W′bal | Skillnad |
|---|---|---|---|
| Pyramid 1-2-3-4-3-2-1 | 4 378 J | 3 812 J | 566 J = **3,8 % av W′** |
| Pyramid 2-4-6-4-2 | 4 583 J | 3 771 J | 812 J = **5,4 % av W′** |

Ber man om 30 % kvar får man alltså ned till ~25 % i botten, utan att det syns.

Sänker användaren τ under ~145 s (tillåtet — gränssnittets minimum är 60 s) går bottennivån
**under noll** medan slutvärdet fortfarande når målet. Passet ser då ut som en normal, ej
klippt lösning på 110–120 % av CP men är ogenomförbart. En genomsökning av CP 150–350 W,
W′ 6–30 kJ, τ 60–400 s och mål 10–30 % ger **168 sådana fall**, samtliga i de två
pyramidmallarna. Se
[WB-1 i fellistan för wbal](09-fel-wbal.md).

**Fix:** villkoret ska vara på båda — `min(W′bal) > 0` som genomförbarhetskrav, slutvärdet
som doseringsmål. De mäter olika saker.

### (c) De föreskrivna effekterna är genomgående för låga

Alla 20 passen landar mellan 105 % och 122 % av CP. För de långa intervallerna är det
rimligt. För de korta anaeroba passen är det det inte: `20×30s` föreskrivs till 119 % av CP,
medan klassiska 30/30-pass körs väsentligt hårdare. Orsaken är kombinationen av
återhämtningsfaktorn (§3), som stryper återfyllnaden under de korta vilorna, och
150 %-taket. Det är alltså samma två fel som slår igenom, inte en separat brist.

## 6. Inkodad tränarkunskap

Två tabeller i verktyget är i praktiken nedskriven träningsmetodik, och de är värda att
lyfta fram eftersom de aldrig sägs ut.

### Vilointensitet per passtyp

`restPercent` sätter viloeffekten som andel av CP, och därmed återhämtningsfaktorn:

| Passtyp | Vila (% av CP) | Återhämtningsfaktor | Metodisk logik |
|---|---|---|---|
| Anaerob | 30–40 % | 0,60–0,70 | Lätt/passiv vila. Syftet är att kunna upprepa kvaliteten — återhämtningen ska maximeras. |
| VO2max | 50 % | 0,50 | Balanserad. Tillräcklig återhämtning för att hålla effekten, tillräckligt lite för att hålla syreupptaget uppe. |
| Tröskel | 60–65 % | 0,35–0,40 | Aktiv vila nära tröskel. Man *ska inte* återhämta sig fullt — den ackumulerade belastningen är hela poängen. |

Det är korrekt tränarpraxis, och att den är kopplad direkt till återhämtningsmatematiken
är elegant.

### Passtaxonomin

| Typ | Arbetsduration | Mallar i verktyget |
|---|---|---|
| Anaerob kapacitet | 20–60 s | 20×30s, 12×45s, 10×1min, tabata-varianter |
| VO2max | 1–5 min | 4×4, 5×5, 6×3, 8×2, 10×90s, 12×1min, pyramider |
| Tröskel | 6–15 min | 3×8, 4×6, 2×10, 2×15 |

Standardindelning, korrekt kalibrerad. Pyramiderna och de blandade passen
(`5×(2min + 1min)`) kodar dessutom två strukturella idéer som saknas i de raka mallarna:
progressiv/regressiv belastning och variation inom repet.

En mall sticker ut som orealistisk: `8×(8×20s)` är 64 repetitioner och 52 minuter totalt.
Klassisk tabata är **ett** set om 8×20/10. Åtta set är inte ett pass, det är en skrivfel-
liknande extrapolation av mallformatet.

## 7. CP eller FTP?

Inmatningsfältet heter `CP (Critical Power / FTP)` och behandlar de två som utbytbara.
Det är de inte:

- **FTP** definieras protokollmässigt, typiskt 95 % av ett 20-minuterstest.
- **CP** definieras matematiskt som modellens asymptot, och ligger typiskt **något över** FTP.

Konsekvensen är enkelriktad: matar man in FTP där modellen vill ha CP blir taket för lågt,
`(P − CP)` för stort, och **W′-förbrukningen överskattas i varje intervall**. Verktyget
blir då för försiktigt — vilket förstärker underskattningen i §5(c).

Använd TP från [`power-curve/`](01-critical-power.md), inte ett FTP-värde från ett
20-minuterstest. De två verktygen är designade att hänga ihop; det är bara inte utsagt.
