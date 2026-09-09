# Etablerat vs eget — facit

Sammanställning över vad i repot som är publicerad, etablerad metodik och vad som är
egenuppfunnet. Egenuppfunnet är inte samma sak som fel — flera av de egna konstruktionerna
är repots bästa delar. Men de bör inte förväxlas med de etablerade, och särskilt inte
när siffrorna jämförs med andra verktyg.

## Ledger

| Modell / beslut | Status | Kommentar | Var |
|---|---|---|---|
| `P(t) = TP + HIE/t` och `W(t) = TP·t + HIE` | **Etablerad** | Monod & Scherrer 1965, Moritz, Hill. Korrekt implementerad, båda formerna visas. | [01](01-critical-power.md) |
| Tvåpunktslösning av TP/HIE | **Etablerad** | Algebraiskt korrekt. Men två punkter ⇒ ingen residual, ingen konfidens. | [01](01-critical-power.md) |
| `PP = max(P₁, P₂)` | **Egen – problematisk** | Lånar Xerts term *Peak Power* utan att skatta den. Är bara den högsta inmatade siffran. Kräver treparametersmodell (Morton 1996). | [01](01-critical-power.md) §3 |
| "Area under kurvan" som *energi* | **Egen – problematisk** | Integralen är rätt räknad, tolkningen är fel. +12,3 % över korrekt värde, och beror på godtyckligt `t₀`. | [01](01-critical-power.md) §4 |
| `d = CS·t + D′` | **Etablerad** | Hughson 1984, Jones & Vanhatalo. Korrekt. | [02](02-critical-speed.md) |
| Loppprediktion `t = (d − D′)/CS` | **Etablerad modell, riskabel användning** | Pålitlig 3–10 km. Strukturellt för snabb på maraton, odefinierad i sprintänden. | [02](02-critical-speed.md) §3 |
| Max distans på 1 h | **Egen – rimlig** | Använder den linjära formen direkt. Tolkbar, men extrapolerad. | [02](02-critical-speed.md) §4 |
| NP = ⁴√(medel(fönstermedel⁴)), `TSS = (t/3600)·IF²·100` | **Etablerad** | Coggan & Allen. Algebraiskt identisk implementation. | [03](03-normalized-power-och-tss.md) §1 |
| **Fönsterlängden som fri parameter → TSS-spektrum** | **Egen – rimlig, repots bästa idé** | Mäter variabilitetens tidsskala. Skiljer pass som medeleffekt och konventionell TSS inte kan skilja. | [03](03-normalized-power-och-tss.md) §2 |
| Fönsternamn `SPRINT` / `VO2_MAX` / `THRESHOLD` | **Egen – problematisk** | Antyder energisystem. Fönstret mäter tidsskala, inte system. Vilseledande. | [03](03-normalized-power-och-tss.md) §2 |
| Exponenten som inställning | **Egen – rimlig** | 4 är etablerad default. Reglaget är utforskande, inte för produktionssiffror. | [03](03-normalized-power-och-tss.md) §3 |
| Decimerad fönsterstegning | **Egen – rimlig** | Uppmätt effekt < 0,1 % och utan riktning. Sund optimering, inget fel. | [03](03-normalized-power-och-tss.md) §4a |
| Täckningskrav 0,5 | **Egen – problematisk** | Absolut krav på 0,5 Hz, inte relativ täckning. Gles inspelning (smart recording) ger `N/A` överallt, utan förklaring. | [07](07-felkatalog.md) A2 |
| **0 W → 30 W** | **Egen – problematisk** | Behandlar frihjulning som sensorbortfall. **+12 % TSS** på ett pass med normal frihjulning. | [03](03-normalized-power-och-tss.md) §4d |
| TSS-ackumuleringskurva | **Egen – problematisk** | Full omräkning var 30:e sekund, inte löpande summa. **Planar aldrig ut** (växer som √t): 1,6–3,7× för stort tillskott. Lutningen är det tolkbara. | [07](07-felkatalog.md) A3 |
| W′bal: linjär tömning / exponentiell återfyllnad | **Etablerad** | Skiba 2012. Asymmetrin korrekt implementerad. | [04](04-wbal-och-intervalldesign.md) §1 |
| τ som användarinput, default 180 s | **Egen – rimlig, optimistisk default** | Skibas anpassning ger typiskt 300–500+ s. | [04](04-wbal-och-intervalldesign.md) §2 |
| Återhämtningsfaktor `(CP − viloeffekt)/CP` | **Egen – problematisk** | Rätt riktning, fel angreppspunkt. Ger felaktig asymptot: återhämtar aldrig fullt, oavsett vilotid. | [04](04-wbal-och-intervalldesign.md) §3 |
| **Föreskriv effekt ur mål-W′bal istället för %FTP** | **Egen – rimlig, repots näst bästa idé** | Väger in reps, duration, vila och viloeffekt automatiskt. Rätt sätt att dosera intervaller. | [04](04-wbal-och-intervalldesign.md) §4 |
| Binärsökning 105–150 % av CP | **Egen – problematisk** | Klipper tyst vid gränserna. Biter bara för `2×15 min`, som då föreskrivs som ogenomförbart (slut-W′bal −155 J). | [07](07-felkatalog.md) B1 |
| Endast slut-W′bal begränsas | **Egen – problematisk** | Ingen kontroll av bottennivån. Pyramiderna underskattar djupet med 3,8–5,4 % av W′; vid τ < 145 s blir pass ogenomförbara utan markering (168 fall). | [07](07-felkatalog.md) B2 |
| Vilointensitet per passtyp (30–65 % av CP) | **Etablerad tränarpraxis** | Korrekt kalibrerad och elegant kopplad till återhämtningsmatematiken. | [04](04-wbal-och-intervalldesign.md) §6 |
| Passtaxonomi anaerob/VO2max/tröskel | **Etablerad** | Standardindelning, rätt durationer. | [04](04-wbal-och-intervalldesign.md) §6 |
| CP och FTP som utbytbara | **Egen – problematisk** | CP ligger typiskt över FTP. Överskattar W′-förbrukningen. | [04](04-wbal-och-intervalldesign.md) §7 |
| Rekursivt passchema med `subSegments` | **Egen – rimlig** | Uttrycker samma passfamilj som `wbal/` hårdkodar. | [05](05-passmodellen.md) §1 |
| **Plan → syntetisk 1 Hz-serie → samma TSS-motor** | **Egen – rimlig, tredje bästa idén** | Gör planerad och genomförd dos direkt jämförbara, per fönster. | [05](05-passmodellen.md) §2 |
| Absoluta watt i passchemat | **Egen – problematisk** | Mål skalar inte med FTP, men poängsättningen gör det. Exempelpasset "Threshold" ligger på 125 % av FTP. | [05](05-passmodellen.md) §4 |

## De tre idéerna värda att behålla och bygga vidare på

**1. TSS-spektrum över fönsterlängder.**
Att beräkna NP/TSS över flera tidsskalor samtidigt och läsa *spridningen* som ett
variabilitetsmått är en genuin generalisering av Variability Index. Ett jämnt och ett spikigt
pass med identisk medeleffekt separeras med faktor 2 i den korta änden och är
oskiljbara i den långa. Nästa steg: gör spridningen till en egen, namngiven storhet i
gränssnittet — det är den man faktiskt tolkar.

**2. Dosera intervaller efter mål-W′bal, inte efter %FTP.**
Ett procenttal av FTP säger ingenting om total anaerob kostnad. Att lösa ut effekten ur ett
mål för återstående W′ väger automatiskt in reps, duration, vilolängd och viloeffekt.
Nästa steg: låt villkoret vara `min(W′bal) > 0` **och** ett slutmål, och rapportera
ärligt när ingen lösning finns.

**3. Låt plan och utfall gå genom samma beräkningsmotor.**
Att rendera passplanen till syntetisk effektdata och köra den genom samma NP/TSS-kod som
FIT-filerna gör planerad och genomförd dos direkt jämförbara. Kombinerat med idé 1 blir
avvikelsen diagnostisk, inte bara ett tal.

## De fem sakerna att fixa först

Prioriterade efter hur mycket de påverkar de siffror verktygen faktiskt visar. Fullständig
beskrivning av varje fel — mekanism, reproduktion och uppmätt storlek — finns i
[07 — Felkatalog](07-felkatalog.md).

1. **Ta bort 30 W-golvet för nollor** ([07](07-felkatalog.md) A1).
   Störst numerisk påverkan i hela repot: **+2 till +54 % TSS** beroende på hur mycket
   atleten frihjular. Eftersom felet växer med frihjulningen kan det inte kalibreras bort —
   det förvränger jämförelsen *mellan* pass, vilket är hela poängen med TSS.
2. **Fixa täckningskravet** ([07](07-felkatalog.md) A2).
   Vid inspelning glesare än 0,5 Hz blir **samtliga** TSS-värden `N/A` utan förklaring.
   Det enda felet som yttrar sig som totalt bortfall i stället för en förskjuten siffra.
3. **Begränsa bottennivån, inte bara slutvärdet, och varna vid klippning**
   ([07](07-felkatalog.md) B1–B2). Verktyget föreskriver pass som enligt dess egen modell
   är ogenomförbara, omarkerade.
4. **Flytta återhämtningsfaktorn in i τ** ([07](07-felkatalog.md) B3).
   Rättar asymptoten — i dag återhämtas förrådet aldrig fullt, oavsett vilotid — och därmed
   underskattningen av pass med långa vilor.
5. **Byt "area under kurvan" mot `TP·3600 + HIE`** ([07](07-felkatalog.md) A4).
   Ersätter ett tal som är 12,3 % för högt och dessutom rör sig 10 % med en godtyckligt
   vald integrationsgräns.

Därefter: relativa mål i passchemat ([07](07-felkatalog.md) D4), etiketten
`30m TSS (Endurance)` för ett 30-**sekunders**fönster (C3), `PP`-rutan som inte visar en
peak power (C1), fönsternamn som antyder energisystem (C2), `t₁ = t₂`-kontroll i
effektverktyget (D1), kolliderande `displayKey` (D5) och oanropbar `Base TSS`-kodväg (D6).

## Vad som saknas helt

Repot modellerar **en atlet vid en tidpunkt**. Det som inte finns någonstans:

- **Formutveckling över tid.** Ingen CTL/ATL/TSB, ingen impulse–response-modell
  (Banister). TSS beräknas men ackumuleras aldrig över dagar. Det är det naturliga
  nästa lagret ovanpå [03](03-normalized-power-och-tss.md).
- **`D′bal` för löpning.** Cykeldelen har full W′bal-dynamik, löpdelen har bara den
  statiska skattningen — trots att D′ i meter är ett ovanligt intuitivt mått på taktiskt
  spelrum i ett lopp. Se [02](02-critical-speed.md) §5.
- **Delad signatur.** Fyra verktyg definierar samma två parametrar var för sig, under
  fyra olika namn, utan att utbyta värden. TP från effektverktyget är precis den CP som
  intervalloptimeraren vill ha.
