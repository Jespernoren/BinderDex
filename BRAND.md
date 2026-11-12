# Binderdex brandbok

Korten står för färgen. Gränssnittet är neutralt och lugnt, med en enda accentfärg.

## Logga
- `logo.svg` (v3): uppslagen pärm, Pokédex till vänster och 3x3 kortfack till höger. Används som huvudlogga.
- `favicon.svg` (v1): stående pärm, 3x3 fack med linsen i första facket. Används som favicon och för små ytor (under 64 px).

## Färger
| Roll | Ljust | Mörkt | Används till |
|---|---|---|---|
| Bakgrund | `#F6F6F7` | `#0E0F12` | Sidan |
| Yta | `#FFFFFF` | `#16181D` | Kort, paneler |
| Text | `#0F1115` | `#F3F4F6` | Rubriker och siffror |
| Text 2 | `#3A3F4A` | `#C9CDD4` | Brödtext |
| Dämpad | `#6B7280` | `#8B93A1` | Etiketter, hjälptext |
| Linje | `#E8E9EC` | `#24272E` | Avdelare, staplar |
| **Accent** | `#D7262E` | `#D7262E` | Aktiv vy, P1, viktigaste KPI, Gen 1-ringen |
| Har | `#16A34A` | | Bara små statusprickar och bock |
| På väg | `#2563EB` | | Bara små statusprickar och "+N på väg" |

Regler:
- Max cirka 10 % accent på en skärm. Accenten markerar det viktigaste, inte dekor.
- Set har ingen egen färg. Setsymbolen och namnet räcker.
- Staplar är neutrala (text-färg). Bara Gen 1-ringen har accent.
- Prio: P1 i accent, P2 och P3 mörka, P4 och P5 ljusa.

## Typografi
- Systemtypsnitt (SF Pro / Inter), tabellsiffror (`tnum`).
- Sidrubrik 28–32 px, 800. KPI-siffra 24 px, 800. Brödtext 13–14 px. Etiketter 11–12 px, versaler med luft.

## Form
- Hörnradie 14 px på paneler, 12 px på små brickor, helt runda chips.
- Skugga: hårfin kant + mycket mjuk skugga. Lyft vid hover.
- Avstånd i steg om 8 px.

## Informationsprinciper
- Det viktigaste syns först (överst till vänster): KPI-rad överst på varje vy.
- Detaljer bakom "Mer om setet" eller hover.
- Pris och kortnummer visas bara på kort du saknar.
