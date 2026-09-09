# Passmodellen — passet som datastruktur (`fit-analysis/`)

Passeditorn definierar ett litet formellt språk för att beskriva träningspass. Det är
mindre synligt än de andra modellerna men bär en av repots bästa designidéer.

## 1. Schemat  **[Egen – rimlig]**

Ett pass är en lista av segment som körs i ordning:

```
pass
├─ id, name, description
└─ segments[]
   ├─ type: "warmup" | "interval" | "cooldown"
   ├─ duration (sekunder), targetWatt        ← enkla segment
   └─ för type = "interval":
      ├─ repeat: antal repetitioner
      ├─ rest: { duration, targetWatt }      ← läggs mellan reps, inte efter sista
      └─ subSegments[]: [{ duration, targetWatt }, ...]
                                             ← ersätter duration/targetWatt
```

**Rekursionen är den intressanta delen.** Ett intervall är antingen enkelt (en effekt, en
duration) eller sammansatt av `subSegments` — ett block av delsteg som upprepas som en
enhet. Det gör att strukturer som *"5 × (1 min hårt + 5 min lugnt + 2 min medel)"* kan
uttryckas, alltså exakt de blandade och pyramidformade passen som
[`wbal/`](04-wbal-och-intervalldesign.md) har som hårdkodade mallar. **De två verktygen
uttrycker samma familj av pass — det ena i data, det andra i kod — utan att veta om
varandra.** Att låta intervalloptimeraren generera passfiler i detta schema är den
uppenbara sammankopplingen.

Vilan placeras korrekt: mellan repetitioner, aldrig efter den sista. Både tidslinjen
(visningen) och den syntetiska effektserien (beräkningen) byggs av samma segmentlogik,
så de kan inte glida isär.

## 2. Den starka idén: plan genom samma motor som verklighet  **[Egen – och den bör behållas]**

Passet renderas till en **syntetisk effektserie med 1 Hz upplösning** och skickas genom
*exakt samma* NP/TSS-beräkning som en riktig FIT-fil
([03](03-normalized-power-och-tss.md)).

Konsekvensen är att **planerad och genomförd träningsdos blir direkt jämförbara** — samma
definition, samma fönster, samma exponent, ingen omräkning. Det låter litet men är det inte:
i de flesta träningsverktyg beräknas planerad TSS med en annan metod än genomförd TSS, och
differensen mellan dem blir därför delvis en artefakt.

Och eftersom hela **fönsterspektrumet** beräknas för både plan och utfall säger jämförelsen
inte bara *om* passet avvek, utan **hur**:

| Observation | Tolkning |
|---|---|
| Utfallets långa fönster ≈ planens | Rätt total dos. |
| Utfallets korta fönster ≫ planens | Ryckigt genomfört — surgar, dåligt hållen effekt. |
| Utfallets korta fönster ≈ planens, långa lägre | Intervallerna höll, men vilorna blev för långa eller för lätta. |

Det är en diagnostik som ett enda TSS-tal per pass inte kan ge.

**Med en viktig reservation:** den syntetiska serien är perfekt rektangulär och har därför
noll variation *inom* varje segment. Planens korta fönster blir alltså systematiskt lägre
än vad samma pass ger när det faktiskt körs. Passfilen `4x4 Threshold` ger 66,3 i
10 s-TSS mot 58,2 i 600 s-TSS — en spridning på 8. Ett verkligt genomfört 4×4 hamnar
högre i den korta änden, eftersom ingen håller helt konstant effekt. **Planens
fönsterspektrum är en undre gräns, inte en prognos.**

## 3. Validering  **[Egen – rimlig]**

Importerade pass valideras mot: segments är en icke-tom array; varje segment har en
`type`; intervall har `repeat ≥ 1`; alla `duration ≥ 1` och alla `targetWatt ≥ 1`, även i
`subSegments` och i `rest`.

Kravet `targetWatt ≥ 1` har en konsekvens som förmodligen inte var avsedd:

> **Vila på 0 W går inte att uttrycka.**

Frihjulning och stillastående vila — helt vanligt i verkliga intervallpass — måste kodas
som minst 1 W. I praktiken spelar det liten roll för TSS, men det interagerar illa med
nollhanteringen i beräkningsmotorn ([03](03-normalized-power-och-tss.md) §4d), som ändå
skulle ha höjt varje 0 W till 30 W. Två separata mekanismer förbjuder alltså samma
verkliga träningstillstånd.

## 4. Absoluta watt, inte % av FTP  **[Egen – problematisk]**

Alla mål anges i **absoluta watt**. Det ger en obehaglig asymmetri: passets *mål* är fasta,
men passets *poängsättning* sker mot FTP. Ändrar man FTP räknas TSS om — men passet
skalas inte.

Exempelpasset visar precis det problemet. `4x4 Threshold` föreskriver 250 W, mot
verktygets standard-FTP på 200 W:

```
250 / 200 = 125 % av FTP
```

Det är **VO2max-intensitet, inte tröskel**. Passet motsäger sitt eget namn så snart FTP
inte råkar vara 250 W. Med relativa mål (`targetPercent: 0.95`) hade passet varit
korrekt för varje atlet, och den planerade TSS:en hade varit invariant — vilket den bör
vara, eftersom TSS per definition är normaliserad mot FTP.

**Detta är den enskilt viktigaste ändringen i schemat:** byt `targetWatt` mot ett relativt
mål, och räkna om till watt vid visning. Då blir ett pass ett *pass*, inte en watt-lista
som råkar passa en viss atlet.

## 5. Vad schemat inte kan uttrycka

Begränsningar som följer av att alla segment är rektanglar:

- **Ramper.** Progressiva uppvärmningar och stigande intervaller (t.ex. 250→300 W över
  5 min) finns inte. Måste approximeras med många korta steg.
- **Målintervall istället för punkter.** Verklig föreskrift är oftast "250–265 W", inte
  "250 W". Ett spann skulle också göra plan/utfall-jämförelsen ärligare.
- **Andra styrvariabler.** Ingen kadens, puls eller RPE — bara effekt. Passen kan alltså
  inte beskriva pulsstyrda eller kadensstyrda block.
- **Villkorad struktur.** "Kör tills W′bal < 20 %" går inte att uttrycka. Det är den
  naturliga bryggan till [`wbal/`](04-wbal-och-intervalldesign.md), där just den storheten
  redan simuleras.
