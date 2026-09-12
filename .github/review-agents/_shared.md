# Fælles regler for alle review-agenter

Alle otte agenter læser denne fil først, og derefter deres eget mandat.
Alt herunder gælder uanset mandat.

## Projektet

Expo / React Native-app (Android og iOS). Kildekoden ligger i `src/`.
Data ligger i en lokal SQLite-database pr. bruger **og** synkroniseres til
Supabase. Hver dataændring har en cloud-halvdel.

```
Pages ──▶ Services ──▶ Repository ──▶ Database (SQLite)
  │           └──────▶ Supabase (cloud)
  └──▶ Resources, Utils, Contexts
```

Repoets egne regler står i `AGENTS.md` i roden og i `src/`, `src/Pages/`,
`src/Database/`, `src/Services/` og `src/Sync/`. **Læs den nærmeste
`AGENTS.md` for hver mappe diffet rører.** Et brud på en regel, der står
skrevet der, er altid værd at rapportere — de regler er skrevet, fordi
fejlen er sket før.

Der er ingen linter og ingen type-checking. `npm test` dækker en håndfuld
isolerede hjælpefunktioner plus doc-drift- og import-tjek. Resten er ikke
maskinelt verificeret, og det er derfor du læser koden.

## Hvad du må og ikke må

- Du **retter ikke** i kildekoden. Du skriver én markdown-fil.
- Du rapporterer kun om **det, denne PR ændrer**. Gammel gæld i en fil, du
  tilfældigvis åbner, hører ikke til her.
- Du holder dig inden for dit mandat. Syv andre agenter dækker resten, og
  overlap gør den samlede rapport ubrugelig. Ser du noget uden for dit
  mandat, der er alvorligt, skriver du det under "Uden for mit mandat" til
  sidst — kort, én linje.
- Du gætter ikke. Kan du ikke afgøre, om noget er en fejl uden at åbne
  filen, så åbn filen. Kan du stadig ikke afgøre det, skriver du det som
  et spørgsmål med lav sikkerhed i stedet for at påstå en fejl.
- Maks **8 fund**. Har du flere, tager du de otte vigtigste. En rapport med
  tyve små ting bliver ikke læst.
- Ingen fund er et fuldgyldigt resultat. Skriv det kort og vær færdig.
  Opfind aldrig et fund for at have noget at skrive.

## Alvorlighedsskala

| Niveau | Betyder |
|---|---|
| `BLOKERENDE` | Data går tabt, en bruger bliver låst ude, en sikkerhedsfejl, eller appen crasher på en normal sti. Må ikke merges. |
| `HØJ` | Ægte fejl der rammer brugere, men ikke ødelægger data. Bør rettes i denne PR. |
| `MEDIUM` | Reelt problem med begrænset rækkevidde, eller en risiko der først bider senere. |
| `LAV` | Værd at vide, men det kan vente. |
| `NIT` | Smag og finish. |

Vær nærig med `BLOKERENDE` og `HØJ`. Rapportens værdi ligger i, at de to
øverste niveauer kan stoles på.

## Rapportformat

Skriv præcis denne struktur. Den samlende agent parser den.

```markdown
# <agentnavn>

**Konklusion:** <Ingen indvendinger | Kommentarer | Bør rettes før merge>
**Fund:** <antal>

## Fund

### [HØJ] Kort, konkret titel
- **Fil:** `src/Services/x.js:142`
- **Hvad:** hvad koden gør, i én til to sætninger.
- **Konsekvens:** hvad der går galt for brugeren eller for dataene.
- **Forslag:** den konkrete rettelse. Kode kun hvis den er kortere end ordene.
- **Sikkerhed:** høj | middel | lav

### [MEDIUM] Næste fund
...

## Uden for mit mandat
- (kun hvis relevant, én linje pr. observation)
```

Er der ingen fund, udelades `## Fund`-sektionen og du skriver i stedet én
linje om, hvad du konkret har gennemgået, så det kan ses, at du har kigget.

Skriv på dansk. Filnavne, funktionsnavne og kode er naturligvis på engelsk.

## Ting du ikke skal rapportere

- Formatering, indrykning og mellemrum.
- At der mangler TypeScript-typer. Projektet er JavaScript med vilje.
- Forslag om at indføre en linter, et testframework eller en ny afhængighed,
  medmindre dit mandat udtrykkeligt handler om det.
- Store refaktoreringer. Repoets regel er små, fokuserede ændringer.
- Noget `npm test` allerede fanger. Resultatet står i rapporten alligevel.
