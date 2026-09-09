# Träningsmodellerna i detta repo

Detta är en dokumentation av *den fysiologiska och träningsmetodiska intelligensen* som ligger
inbakad i verktygen — inte av koden, gränssnittet eller grafiken.

Fyra verktyg, men egentligen **en enda idé**: en handfull parametrar (en *fitness signature*)
beskriver en atlets kapacitet, och allt annat — kurvor, tider, zoner, intervallpass, träningsdos —
härleds ur den. Verktygen är fyra olika sätt att komma åt eller använda samma signatur.

| Verktyg | Frågan det svarar på | Parametrar | Dokument |
|---|---|---|---|
| `power-curve/` | Vad är min kapacitet på cykel? | TP, HIE (= CP, W′) | [01](01-critical-power.md) |
| `running/` | Vad är min kapacitet i löpning, och vilka tider ger den? | CS, D′ | [02](02-critical-speed.md) |
| `fit-analysis/` | Hur hård var passet jag gjorde? | FTP, exponent, fönsterlängd | [03](03-normalized-power-och-tss.md) |
| `wbal/` | Vilken effekt ska jag hålla i ett givet intervallpass? | CP, W′, τ | [04](04-wbal-och-intervalldesign.md) |
| `fit-analysis/` (passeditorn) | Hur beskriver jag ett pass formellt? | passchema (JSON) | [05](05-passmodellen.md) |

Två sammanfattande dokument:

- **[06 — Etablerat vs eget](06-etablerat-vs-eget.md)** — facit över vad som är etablerad
  vetenskap och vad som är egenuppfunnet. Läs den först om du bara läser en.
- **[07 — Felkatalog](07-felkatalog.md)** — varje fel i detalj: vad koden gör, varför det är
  fel, hur man återskapar det och hur stort det är. Alla siffror uppmätta genom att köra
  repots egen kod.

## Konventioner i dokumenten

Varje modell och varje delbeslut märks med en av tre statusar:

- **[Etablerad]** — publicerad, peer-reviewad modell, korrekt implementerad.
- **[Egen – rimlig]** — egen konstruktion eller förenkling, men resonemanget håller.
- **[Egen – problematisk]** — egen konstruktion med en identifierad svaghet som påverkar resultatet.

Siffror i dokumenten är räknade på verktygens egna defaultvärden och verifierade mot
den faktiska implementationen, inte uppskattade.

## Den gemensamma begreppskärnan

Alla fyra verktygen vilar på **tvåparametersmodellen för uthållighet** (Monod & Scherrer 1965,
vidareutvecklad av Moritz, Hill, Jones & Vanhatalo m.fl.):

> Prestation över tid styrs av (1) en effektnivå som kan hållas i princip obegränsat —
> ett *tak* — och (2) ett ändligt energiförråd som kan användas ovanför det taket.

Taket heter olika saker i olika verktyg (CP, TP, FTP, CS) och förrådet likaså (W′, HIE, D′),
men det är samma två storheter. Konsekvensen: **en enda linjär modell**

```
Arbete(t) = tak × t + förråd
```

genererar allt annat — den hyperboliska effektkurvan, tidsprediktioner, W′bal-dynamiken
och zonindelningen. Att modellen är linjär i *arbete* men hyperbolisk i *effekt* är den
enskilt viktigaste insikten att ta med sig: det är samma modell, sedd från två håll.

## Vad modellerna *inte* fångar

Gäller genomgående, och nämns inte om igen i varje dokument:

- **Ingen tidsupplösning i formen.** Signaturen är ett ögonblick, inte en utveckling.
  Ingenting i repot modellerar hur TP/CP förändras över veckor (jfr CTL/ATL/TSB, Banister).
- **Ingen durationsberoende utmattning.** Modellerna har ingen glykogen-, värme- eller
  muskelskadeterm. Det är därför alla extrapolationer mot långa tider (maraton, 1 h-effekt)
  blir för optimistiska.
- **Ingen individuell variation i modellform.** Tvåparametersmodellen antas gälla exakt.
  I verkligheten varierar kurvformen mellan individer, vilket är hela poängen med
  treparametersmodeller.
- **Ingen felskattning.** Två mätpunkter ger exakt en lösning, alltid, utan residual.
  Du får aldrig veta hur säker skattningen är. Se [01](01-critical-power.md).
