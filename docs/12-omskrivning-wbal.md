# Omskrivning av `wbal/` — implementationsplan

Åtgärdsplan för felen i [09](09-fel-wbal.md), sekvenserad och med acceptanskriterier.
[09](09-fel-wbal.md) säger vad som är fel och varför; detta dokument säger i vilken ordning
det ska rättas och hur man vet att det blev rätt.

**Alla siffror nedan är mätta.** Solvern är återimplementerad med den nya matematiken och
körd mot samtliga 20 mallar och mot parametersvep. Fyra saker i planen överlever inte den
mätningen; de står som **[Justerat]** vid respektive steg och är sammanfattade i §9.

## Bakgrund

Modulen har en korrekt W′bal-simulering och en bra kärnidé — föreskriv effekt ur
mål-W′bal i stället för ur %FTP. Tre fel gör att den systematiskt underskattar möjlig
belastning och i vissa fall rekommenderar ogenomförbara pass utan varning.

**Rör inte:** tömningsmatematiken, `restPercent`-tabellen, passtaxonomin,
mål-W′bal-konceptet. De är repots bästa delar, och [09](09-fel-wbal.md) friskförklarar dem
uttryckligen.

---

## Steg 1 — Ersätt återhämtningsfaktorn med härledd τ

Åtgärdar [WB-3](09-fel-wbal.md) och [WB-4](09-fel-wbal.md) i ett grepp.

### Problem

Vilointensiteten multipliceras på *mängden* återhämtning
(`wbal/script.js:60–62`, anropad från sex ställen):

```
återhämtningsfaktor = (CP − viloeffekt) / CP
återhämtat = (W′ − W′bal) · (1 − e^(−vila/τ)) · återhämtningsfaktor
```

Det ger en felaktig asymptot: med faktor 0,5 når W′bal aldrig över 50 % av underskottet,
oavsett vilolängd. Tio timmars vila ger 70 % fullt förråd.

### Åtgärd  **[Etablerad]**

Ta bort `återhämtningsfaktor` helt. Låt vilointensiteten styra τ enligt Skiba m.fl. 2012:

```
D_CP = CP − viloeffekt                      # W, viloeffekt kommer från restPercent
tau   = 546 · e^(−0,01 · D_CP) + 316        # sekunder
Wbal  = W′ − (W′ − Wbal) · e^(−vila/tau)
```

En exponentialfunktion `1 − e^(−t/τ)` går alltid mot 1. Ändrar man τ ändrar man *hur
snabbt*, aldrig *om*. Asymptoten kan därmed inte gå sönder igen.

### Följdändringar

- τ tas bort som användarinställning (`wbal/index.html:33`). Defaulten 180 s var ~2× för
  snabb; de härledda värdena hamnar på 451–587 s vid CP = 200 W.
- Valfritt: en skalär `recoveryScale` som multiplicerar τ — 0,7 elit / 1,0 default /
  1,3 otränad. Eftersom den sitter på τ och inte på amplituden kan asymptoten inte gå
  sönder.

### Vad det gör med återhämtningen per vila

Mätt vid CP = 200 W, andel av underskottet som återvinns under **en** vila:

| `restPercent` | τ, ny | Bryttid | Mallarnas vilor | Gammal | Ny |
|---|---|---|---|---|---|
| 0,30 | 451 s | 473 s | 10 s | 3,8 % | **2,2 %** |
| 0,40 | 480 s | 344 s | 30–90 s | 9,2–23,6 % | **6,1–17,1 %** |
| 0,50 | 517 s | 234 s | 60–180 s | 14,2–31,6 % | **11,0–29,4 %** |
| 0,60 | 561 s | 127 s | 180–300 s | 25,3–32,4 % | **27,4–41,4 %** |
| 0,65 | 587 s | 72 s | 420 s | 31,6 % | **51,1 %** |

*Bryttid* är den vilolängd där ny och gammal modell ger lika mycket. Kortare vila än så:
den nya modellen återhämtar **mindre**. Det är avgörande för steg 5 — se §5.

### Acceptanskriterium  **[Justerat]**

Planens kriterium — *passiv vila (0 W) från W′bal = 0 ska ge > 99 % av W′ efter 30 min* —
håller inte generellt. Med `D_CP = CP` blir τ en funktion av CP:

| CP | τ | Efter 30 min | Efter 35 min |
|---|---|---|---|
| 150 W | 437,8 s | **98,36 %** | 99,17 % |
| 200 W | 389,9 s | 99,01 % | 99,54 % |
| 250 W | 360,8 s | 99,32 % | 99,70 % |
| 350 W | 332,5 s | 99,55 % | 99,82 % |

Gränsen går vid **CP > 198,7 W**. Verktygets default på 200 W klarar kriteriet med 1,3 W
till godo, och en användare med CP 150 W får ett rött test på korrekt kod.

Använd i stället ett av dessa, som båda håller över hela CP-intervallet 150–350 W:

- **> 98 % av W′ efter 30 min** (håller för CP > 133 W), eller
- **> 99 % av W′ efter 35 min**.

---

## Steg 2 — Två separata villkor: genomförbarhet och dosering

Åtgärdar [WB-1](09-fel-wbal.md).

### Problem

Endast slut-W′bal kontrolleras. I pyramidmallarna ligger bottennivån mitt i passet — upp
till 812 J (5,4 % av W′) under slutvärdet.

### Åtgärd

Spåra minimum genom hela simuleringen och skilj på de två villkoren:

| Villkor | Uttryck | Roll |
|---|---|---|
| Genomförbarhet | `min(W′bal) > marginal` | hårt krav, avvisar passet |
| Dosering | `slut-W′bal ≈ mål` | det binärsökningen optimerar mot |

Sätt `marginal` till 0 eller en liten buffert (förslag: 2 % av W′). Returnera både
`minWbal` och `finalWbal` från simuleringen, och visa `minWbal` i gränssnittet — det är
den siffra som avgör om passet går att fullfölja.

### Hur ofta villkoret faktiskt biter

Efter steg 1 är de 168 fall [WB-1](09-fel-wbal.md) räknade upp borta — de förutsatte
τ som fri parameter ner till 60 s, och τ är inte längre fri. Villkoret är därmed
**inte** en omskrivning av dagens utfall utan ett skydd. Det biter fortfarande, men smalt.

Svep över CP 50–500 W (steg 25 W), W′ 5–40 kJ (steg 500 J) och mål-W′bal 10–50 %
(steg 1 %) — alltså gränsvärdena i verktygets egna inmatningsfält — 1 106 180
kombinationer:

- **781 golvbrott (0,071 %)**, samtliga i `Pyramid 2-4-6-4-2`.
- Alla kräver **CP ≥ 375 W** *och* **mål-W′bal ≤ 11 %**. Lägsta CP där det inträffar är
  375 W, lägsta mål 10 %.
- Värsta fallet: CP 425 W, W′ 5 kJ, mål 10 % → 432 W föreskrivet, slut-W′bal 500 J
  (= målet), **bottennivå 39 J** mot marginalen 100 J.

Under mål-W′bal 10 % växer det snabbt — på ett grövre rutnät 104 fall vid 5 % och 869 vid
2 %, mot 24 vid 10 % — men det ligger utanför vad gränssnittet tillåter att mata in.

### Acceptanskriterium  **[Justerat]**

Planens kriterium — *pyramiderna ska avvisas när bottennivån understiger marginalen* — går
inte att uppfylla med mallarna på defaultvärden, eftersom villkoret då aldrig biter.
Ett test som aldrig kan fallera testar ingenting.

Dela det i två:

1. **Rapportering:** båda pyramiderna ska returnera en `minWbal` som är strikt lägre än sin
   `finalWbal` (mätt: 4234 mot 4500 J respektive 4015 mot 4500 J på defaultvärden).
2. **Avvisning:** ett *konstruerat* fall — `Pyramid 2-4-6-4-2`, CP 425 W, W′ 5 kJ,
   mål 10 % — ska avvisas eller klippas till den genomförbara effekten, inte föreskrivas
   rakt av.

---

## Steg 3 — Vidga sökintervallet och rapportera lösarstatus

Åtgärdar [WB-2](09-fel-wbal.md).

### Problem

Binärsökningen går över 105–150 % av CP (`wbal/script.js:162–163`) och returnerar
gränsvärdet tyst när lösningen ligger utanför.

### Åtgärd

- Sökintervall: `0.5 · CP` till `4.0 · CP`.
- Lösaren returnerar ett tillstånd, inte bara ett tal. UI visar de tre olika.

### Är det övre taket värt att flytta?

Ja, men nyttan ligger nästan helt hos användare med lågt CP. Andel av sveparna där
lösningen hamnar över gamla taket 150 % av CP:

| CP | Över 150 % | Högsta lösning |
|---|---|---|
| 100 W | **10,0 %** | 206 % av CP |
| 150 W | 2,9 % | 176 % |
| 200 W | 0,7 % | 161 % |
| 250 W | 0,1 % | 151 % |
| ≥ 300 W | 0,0 % | ≤ 145 % |

Med default-CP 200 W klipps alltså ungefär 1 fall på 140 — sällan, men tyst, vilket är hela
poängen. Det undre taket 105 % av CP är däremot inte värt att sänka av precisionsskäl:
ingen lösning i hela svepet ligger under det. Sänk det ändå, av skälet i nästa stycke.

### `infeasible` kan aldrig inträffa  **[Justerat]**

Planens tre tillstånd är `solved` / `out_of_range` / `infeasible`, där `infeasible` betyder
*ingen effekt uppfyller `min(W′bal) > marginal`*. **Det tillståndet är onåbart med det
föreslagna intervallet.** Vid `0.5 · CP` ligger effekten under CP, ingenting förbrukas,
och `min(W′bal) = W′` — alltid över varje marginal. Verifierat för alla tre
problemmallarna:

```
Pyramid 1-2-3-4-3-2-1   vid 0,5×CP: min = 15 000 J   vid 1,0×CP: min = 15 000 J
Pyramid 2-4-6-4-2       vid 0,5×CP: min = 15 000 J   vid 1,0×CP: min = 15 000 J
2×15 min                vid 0,5×CP: min = 15 000 J   vid 1,0×CP: min = 15 000 J
```

Eftersom `min(W′bal)` är monotont avtagande i effekt finns det alltid en genomförbar effekt
i intervallet. Samma sak gör `out_of_range` vid undre gränsen onåbar: slut-W′bal går mot
W′ när effekten går mot CP, och målet ligger under W′.

Det tillstånd som **faktiskt** uppstår är ett annat: *doseringsmålet kan inte nås utan att
bottennivån bryts* — de 24 fallen i §2. Byt därför tillståndsuppsättning till:

| Tillstånd | Innebörd | Visas som |
|---|---|---|
| `solved` | Målet nått, bottennivån håller | effektsiffra |
| `floor_limited` | Effekten begränsas av bottennivån, inte av doseringsmålet | effektsiffra **+ varning**, med faktisk slut-W′bal |
| `out_of_range` | Sökningen träffade den övre gränsen | ingen effektsiffra |

Vill man behålla ett äkta `infeasible` måste den undre gränsen ligga på `1.0 · CP` och
villkoret vara "ingen effekt **över CP**" — men eftersom ingenting förbrukas vid CP blir
även det onåbart. Slutsatsen är att tillståndet inte behövs.

### Acceptanskriterium  **[Justerat]**

Planens kriterium — *`2×15 min` returnerar `infeasible` eller en genomförbar lägre effekt,
aldrig 210 W utan varning* — uppfylls, men **av steg 1, inte av steg 3**. Med härledd τ blir
vilan på 420 s vid `restPercent` 0,65 värd 51,1 % av underskottet i stället för 31,6 %, och
passet blir genomförbart:

| | Effekt | Slut-W′bal | Bottennivå |
|---|---|---|---|
| Idag | 210 W (klippt) | −155 J | −155 J |
| Efter steg 1–3 | **208 W** | 4500 J (= målet) | **4500 J** |

Formulera kriteriet som ett rent utfallstest — `min(W′bal) > 0` för `2×15 min` på
defaultvärden — och lägg det separata statustestet på ett konstruerat fall enligt §2.

---

## Steg 4 — Separera CP och FTP

Åtgärdar [WB-5](09-fel-wbal.md). Oberoende av de andra stegen.

### Problem

Fältet heter `CP (Critical Power / FTP)` (`wbal/index.html:17`) och behandlar dem som
utbytbara. FTP ligger typiskt under CP; matas FTP in blir `(P − CP)` för stort och
W′-förbrukningen överskattas i varje intervall.

### Åtgärd

- Primär källa: CP från [`power-curve/`](01-critical-power.md) (`TP`-värdet). Det är exakt
  samma storhet, i samma enhet.
- Matas FTP in manuellt: konvertera explicit (`CP ≈ FTP / 0,95`) och märk värdet som
  uppskattat i gränssnittet.

**Överspelad.** Steget genomfördes som beskrivet, med en källväljare och `cpFromFtp()`.
Därefter togs FTP bort helt: fältet tar bara CP, `cpFromFtp()` finns inte längre i
`model.js`, och CP hämtas i första hand ur atletprofilen. Mätningen nedan gäller fortfarande
som beskrivning av felets storlek - den är bara inte längre något användaren kan råka ut
för via gränssnittet.

### Storleken på felet  **[Justerat]**

FTP 200 W inmatat som CP, mot korrekt CP = 200 / 0,95 = 210,5 W, W′ 15 kJ, mål 30 %:
`ΔCP = 10,53 W`.

Planen säger **exakt +10,5 W på varje mall — identiskt, för alla 20**, med motiveringen att
föreskriven effekt löses ur `(P − CP) · tid` mot ett fast W′-mål, så ett skift i CP flyttar
P lika mycket.

**Det höll före steg 1, men inte efter.** Mätt på implementationen med härledd τ blir
förskjutningen +10,56 till +10,96 W — nästan ett rent skift, men inte ett enda tal:

| | Förskjutning |
|---|---|
| `ΔCP` (det rena skiftet) | 10,53 W |
| Minst, `2×15 min` | **10,56 W** |
| Mest, `10×1 min` | **10,96 W** |
| Avrundat, 13 av 19 mallar | +11 W |
| Avrundat, 6 av 19 mallar | +10 W |

Skälet är att steg 1 gjorde återhämtningen CP-beroende. Viloeffekten är `CP · restPercent`,
alltså är `D_CP = CP · (1 − restPercent)`, och τ = 546·e^(−0,01·D_CP) + 316 **sjunker** när
CP stiger — vid `restPercent` 0,5 från 517 s till 507 s. Kortare τ ger snabbare
återhämtning, vilket tillåter något mer effekt än det rena skiftet. Den gamla
återhämtningsfaktorn `(CP − viloeffekt)/CP` var däremot lika med `1 − restPercent` och
alltså oberoende av CP — därför var förskjutningen exakt ett tal så länge τ var en
användarinställning.

Felet är alltså i praktiken en **förskjutning, inte en förvrängning**: spridningen mellan
mallar är 0,4 W, mot en nivåändring på 10,5 W. Det förklarar varför det är svårt att
upptäcka på utfallet — allt ser fortfarande konsekvent ut, bara 5 % för lätt.

---

## Steg 5 — Mallstädning och omkalibrering

Åtgärdar [WB-6](09-fel-wbal.md).

- Ta bort `8×(8×20s)` (`wbal/script.js:25`) — 64 repetitioner, 3100 s = 52 min. Klassisk
  tabata är **ett** set om 8×20/10.
- Kör om alla mallar med den nya matematiken och granska utfallet.

### Förväntan på omkalibreringen  **[Justerat]**

Planen förväntar sig att *effekterna stiger, mest för de korta anaeroba passen*, och
instruerar att *om de korta passen fortfarande ser låga ut är steg 1 eller 3 inte helt
genomfört.*

**Det stämmer inte, och instruktionen skickar en implementatör efter en bugg som inte
finns.** Mätt utfall, alla 20 mallar på defaultvärden (CP 200 W, W′ 15 kJ, mål 30 %):
**17 mallar sjunker, 2 stiger, 1 är oförändrad.** De korta anaeroba passen sjunker mest av
alla:

| Mall | Idag | Efter steg 1–3 |
|---|---|---|
| `20×30s` | 237 W (119 %) | **230 W (115 %)** |
| `12×45s` | 238 W (119 %) | **231 W (115 %)** |
| `10×1 min` | 244 W (122 %) | **235 W (118 %)** |
| `8×(8×20s)` | 243 W (122 %) | **231 W (115 %)** |

Mekanismen är den [09 §WB-3 ↔ WB-4](09-fel-wbal.md) redan pekar ut: de två felen drar åt
motsatt håll. Att ta bort återhämtningsfaktorn *ökar* återhämtningen; att höja τ från 180 s
till 451–587 s *minskar* den. Vilken som vinner avgörs av vilolängden mot bryttiden i §1:

- Vila **kortare** än bryttiden → τ-förlusten dominerar → lägre föreskriven effekt.
  Gäller 16 av 20 mallar, och alla anaeroba (vilor 10–90 s mot bryttider 344–473 s).
- Vila **längre** än bryttiden → faktorn dominerar → högre effekt. Gäller bara
  `3×8 min`, `4×6 min`, `2×10 min` och `2×15 min` — samtliga med `restPercent` ≥ 0,6,
  där bryttiden är nere på 72–127 s. `2×15 min` sjunker ändå, men bara för att dess
  utgångsvärde var det klippta gränsvärdet och inte en lösning; de tre övriga ligger still
  eller stiger. 16 sjunkande plus `2×15 min` ger de 17 i tabellen nedan.

Planen behöll alltså riktningen från WB-3 och räknade inte in WB-4, trots att de bakas
ihop i samma steg.

**Rätt förväntan:** effekterna sjunker svagt över nästan hela linjen (−1 till −9 W), de tre
trösklarna med lång vila ligger still eller stiger 1 W, och `2×15 min` går från
ogenomförbart till genomförbart. Ser de korta passen i stället ut att **stiga**, är det
återhämtningsfaktorn som ligger kvar någonstans.

---

## Ordning och beroenden

```
Steg 1 (τ)   ──┬──> Steg 5 (mallar kalibreras om)
Steg 2 (min) ──┤
Steg 3 (sök) ──┘
Steg 4 (CP/FTP) — oberoende, kan göras när som helst
```

Steg 1–3 bör gå i samma omgång: var och en för sig flyttar utfallen, och mallarna kan bara
kalibreras om en gång, efter att alla tre sitter. Det är också vad
[09 §Beroenden](09-fel-wbal.md) kräver — WB-2 utan WB-1 ger *sämre* resultat än idag,
eftersom gränsvärdet försvinner som varningssignal utan att bottennivån börjar kontrolleras.

Steg 4 är oberoende i koden men inte i tolkningen: det flyttar varje siffra +10,5 W. Släpps
det i samma release som steg 1–3 blir nettoeffekten för de korta passen ungefär noll
(−7 W från τ, +10,5 W från CP), vilket gör båda ändringarna osynliga i utfallet. **Släpp
steg 4 separat**, annars går det inte att verifiera att någondera fungerade.

---

## Regressionstest att lägga till

| # | Test | Fångar | Förväntat |
|---|---|---|---|
| 1 | Passiv vila (0 W) från W′bal = 0 | asymptotbuggen ([WB-3](09-fel-wbal.md)) | **> 98 % av W′ efter 30 min**, för CP 150–350 W (se §1) |
| 2 | Aktiv vila på 0,5 × CP, lång vila | att faktorn inte smugit tillbaka | > 50 % av underskottet återvunnet |
| 3 | Alla mallar, defaultvärden | bottennivån ([WB-1](09-fel-wbal.md)) | `min(W′bal) > 0` för varje rekommenderad effekt |
| 4 | `2×15 min`, defaultvärden | klippningen ([WB-2](09-fel-wbal.md)) | `min(W′bal) > 0` — idag −155 J |
| 5 | Båda pyramiderna | att minimum faktiskt spåras | `minWbal < finalWbal`, strikt |
| 6 | Konstruerat fall: `Pyramid 2-4-6-4-2`, CP 425 W, W′ 5 kJ, mål 10 % | att golvvillkoret biter | status `floor_limited`, inte en rak rekommendation |
| 7 | Parametersvep CP 150–350 W, W′ 6–30 kJ, mål 10–30 % | regression i solvern | noll fall med `min(W′bal) < 0` bland presenterade lösningar |
| 8 | `out_of_range` | tyst klippning | visas aldrig som en vanlig rekommendation |

Test 2 är trivialt uppfyllt efter steg 1 (asymptoten är 100 % oavsett vilointensitet) och
finns bara som vakt. Test 6 är det enda som faktiskt kan fallera på golvvillkoret — se §2.

---

## Mätt utfall, alla 20 mallar

CP 200 W, W′ 15 kJ, mål-W′bal 30 % (= 4500 J). "Idag" är dagens kod med τ = 180 s;
"Efter" är steg 1–3. `min` är lägsta W′bal någonstans i passet.

| Mall | Idag | min | Efter | min | Δ |
|---|---|---|---|---|---|
| `4×4 min` | 218 W (109 %) | 4480 J | 217 W (109 %) | 4500 J | −1 W |
| `5×5 min` | 213 W (106 %) | 4517 J | 212 W (106 %) | 4500 J | −1 W |
| `6×3 min` | 217 W (109 %) | 4554 J | 216 W (108 %) | 4500 J | −1 W |
| `8×2 min` | 221 W (110 %) | 4462 J | 219 W (109 %) | 4500 J | −2 W |
| `3×8 min` | 210 W (105 %) | 4402 J | 211 W (105 %) | 4500 J | **+1 W** |
| `4×6 min` | 211 W (105 %) | 4510 J | 211 W (106 %) | 4500 J | 0 |
| `2×10 min` | 210 W (105 %) | 4593 J | 211 W (106 %) | 4500 J | **+1 W** |
| `10×90s` | 221 W (111 %) | 4433 J | 219 W (109 %) | 4500 J | −2 W |
| `12×1 min` | 233 W (117 %) | 4537 J | 226 W (113 %) | 4500 J | −7 W |
| `15×1 min` | 226 W (113 %) | 4566 J | 221 W (110 %) | 4500 J | −5 W |
| `20×30s` | 237 W (119 %) | 4576 J | 230 W (115 %) | 4500 J | −7 W |
| `12×45s` | 238 W (119 %) | 4414 J | 231 W (115 %) | 4500 J | −7 W |
| `10×1 min` | 244 W (122 %) | 4467 J | 235 W (118 %) | 4500 J | −9 W |
| `8×(8×20s)` | 243 W (122 %) | 4493 J | 231 W (115 %) | 4500 J | −12 W |
| `3×(10×40s)` | 224 W (112 %) | 4459 J | 219 W (109 %) | 4500 J | −5 W |
| `Pyramid 1-2-3-4-3-2-1` | 217 W (108 %) | **4023 J** | 215 W (108 %) | **4234 J** | −2 W |
| `Pyramid 2-4-6-4-2` | 216 W (108 %) | **3787 J** | 215 W (107 %) | **4015 J** | −1 W |
| `5×(2min + 1min)` | 221 W (110 %) | 4466 J | 218 W (109 %) | 4500 J | −3 W |
| `4×(3min + 2min)` | 215 W (107 %) | 4460 J | 213 W (107 %) | 4500 J | −2 W |
| `2×15 min` | 210 W (105 %) | **−155 J** | 208 W (104 %) | **4500 J** | −2 W |

Tre rader att läsa noga:

- **`2×15 min`** är den enda som byter karaktär. Dagens 210 W är inte en lösning utan det
  klippta gränsvärdet; den nya siffran är en riktig lösning.
- **Pyramiderna** är de enda där `min` skiljer sig meningsfullt från slutvärdet, både före
  och efter. Det är därför steg 2 behövs, och varför det är just de som dyker upp i §2.
- **De 17 raderna som sjunker** är den avsedda effekten av steg 1, inte en regression.
  Modulen underskattade inte belastningen på det sätt bakgrundstexten antar — den
  överskattade den för korta vilor och underskattade den för långa.

---

## De fyra justeringarna

| # | Planen säger | Mätningen säger | Åtgärd |
|---|---|---|---|
| 1 | Effekterna stiger, mest för korta anaeroba pass | 17 av 20 sjunker; de anaeroba sjunker mest (−7 till −12 W) | Vänd förväntan i steg 5, och ta bort feldiagnosen "då är steg 1 eller 3 inte genomfört" |
| 2 | Passiv vila > 99 % av W′ efter 30 min | Håller bara för CP > 198,7 W; default 200 W klarar med 1,3 W marginal | Använd > 98 % efter 30 min, eller > 99 % efter 35 min |
| 3 | Tillståndet `infeasible` | Onåbart: vid 0,5 × CP förbrukas ingenting, `min(W′bal) = W′` | Ersätt med `floor_limited` — doseringsmålet nås inte utan att bottennivån bryts |
| 4 | Steg 4 flyttar varje mall exakt +10,5 W | +10,56 till +10,96 W efter steg 1: härledd τ gör återhämtningen CP-beroende | Läs förskjutningen som ett spann, inte ett tal; avrundat +10 eller +11 W |

Ingen av dem rör riktningen i planen. Steg 1–4 är rätt åtgärder på rätt fel; det är två
acceptanskriterier och en förväntan på utfallet som inte stämmer, och alla tre skulle ha
kostat felsökningstid att upptäcka i efterhand.
