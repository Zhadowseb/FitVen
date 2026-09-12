# PR-review-agenter

Otte agenter læser hver pull request parallelt, hver med sit eget mandat. En
niende agent samler rapporterne til én kommentar på PR'en og opdaterer den
samme kommentar ved hvert nyt push.

Workflowet er `.github/workflows/pr-review.yml`. Mandaterne er filerne her i
mappen.

```
pull_request (opened, synchronize, reopened, ready_for_review)
        │
   context ──▶ diffet hentes én gang og deles med alle
        │
        ├─ checks ──────────── npm ci && npm test
        │
        ├─ quality-assurance ─┐
        ├─ testing            │
        ├─ security           │  otte parallelle jobs,
        ├─ architecture       │  hver skriver én markdown-rapport
        ├─ code-design        │
        ├─ performance        │
        ├─ ui-usability       │
        └─ design ────────────┘
                    │
              aggregate ──▶ én kommentar på PR'en
```

## Opsætning

1. Tilføj ét af to repository secrets under **Settings → Secrets and
   variables → Actions**:
   - `CLAUDE_CODE_OAUTH_TOKEN` — **det er den, der bruges her.** Genereres
     med `claude setup-token` i en terminal og kører på Pro/Max-abonnementet
     i stedet for API-kredit. Den er bundet til den konto, der lavede den,
     den udløber og skal fornys, og forbruget deles med din egen lokale
     Claude Code.
   - `ANTHROPIC_API_KEY` — en API-nøgle fra Claude Console. Udløber ikke og
     er uafhængig af abonnementet, men faktureres pr. forbrug.

   Workflowet tager den, der findes, så der skal ikke ændres en linje for at
   skifte. Er ingen af dem sat, springer review-jobbene over uden at fejle,
   og kørslen skriver en advarsel.

   Når tokenet udløber, fejler alle otte agenter på én gang. Den samlende
   agent er instrueret i at skrive netop det øverst i PR-kommentaren i
   stedet for at lade det ligne otte tomme reviews.

2. Intet andet. Workflowet poster selv kommentaren med det indbyggede
   `GITHUB_TOKEN`, så Claude GitHub App'en behøver ikke være installeret.

## Sådan ændrer du noget

- **Justér hvad en agent leder efter:** ret mandatfilen. Workflowet skal
  ikke røres.
- **Tilføj en agent:** opret `<navn>.md` her, og tilføj `<navn>` til
  `strategy.matrix.agent` i workflowet.
- **Fjern en agent:** tag navnet ud af matrixen. Mandatfilen kan blive
  liggende.
- **Skift model:** `REVIEW_MODEL` og `SUMMARY_MODEL` i workflowets `env`.
- **Kør manuelt på en eksisterende PR:** Actions → *PR Review Agents* → *Run
  workflow* → indtast PR-nummeret.

Draft-PR'er springes over. En ny kørsel afløser den forrige på samme PR, så
hurtige pushes ikke betaler for otte agenter flere gange.

## Hvad det koster

Otte agenter plus en samlende agent pr. kørsel, hver begrænset af
`--max-turns`. Forbruget følger PR'ens størrelse, fordi diffet er det, de
læser.

På et abonnements-token tæller det i den samme forbrugsgrænse som din egen
Claude Code. Derfor kører matrixen med `max-parallel: 4` frem for alle otte
på én gang — det halverer ikke forbruget, men det holder kørslen fra at
ramme grænsen i ét spring. Vil du skrue ned på selve forbruget, er der tre
knapper: færre agenter i matrixen, en lavere `--max-turns`, eller at droppe
`synchronize` fra triggerne, så der kun reviewes ved åbning af PR'en.

## Hvorfor mandaterne er skarpt adskilt

Otte agenter, der alle leder efter "problemer", finder de samme tre ting og
skriver dem otte gange. Hver mandatfil slutter derfor med "Ikke dit bord",
og den samlende agent slår alligevel dubletter sammen. Holder du et mandat
op mod de andre, når du redigerer, bliver den samlede rapport ved med at
være kort.
