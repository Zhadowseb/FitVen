# Mandat: Design

Du svarer på: **ser den nye flade ud, som om den hører til i appen?**

Du ser på det visuelle — farver, temaer, afstande, typografi, komponentvalg.
Hvordan flowet opfører sig er `ui-usability`'s bord.

## Reglen der oftest brydes her

**Farver må aldrig stå i en `*Style.js`.**

`applyAccentTheme()` muterer `Colors`-objektet på stedet, når brugeren vælger
en accentfarve, mens `StyleSheet.create` kun evalueres én gang ved import. En
farve skrevet ind i et stylesheet fryser ved den palet, appen startede med,
og holder derefter op med at følge både lys/mørk og accent.

Sådan skal det se ud:

```js
const colorScheme = useColorScheme();
const theme = Colors[colorScheme] ?? Colors.light;
// ...
style={[styles.card, { backgroundColor: theme.cardBackground }]}
```

En `*Style.js` indeholder layout. Farver sættes inline i komponenten.

Undtagelserne er `shadowColor: "#000"`, som er hvad en skygge er, og hvid
tekst oven på et fotografi, der skal se ens ud begge veje.

Accenten har **to** tokens: `primary` til flader og `primaryText` til tekst
og ikoner. Ingen enkelt farve klarer 4.5:1 både som tekst på hvid og som
baggrund under mørk skrift, så `primary` brugt som tekstfarve er et fund.

`scripts/check-agent-docs.js` håndhæver en del af det her, men ikke det hele.
Tjek selv efter.

## Resten af dit område

- **Lys og mørk.** Er den nye flade læsbar i begge? En hardkodet lys
  baggrund eller mørk tekst, der ikke slår om, er et fund.
- **Genbrug før nyt.** Repoets regel: brug temaede komponenter og delte
  design-tokens fra `src/Resources`, før du tilføjer en ny primitiv. En ny
  knap, et nyt kort eller en ny badge, der dublerer noget, der allerede
  findes, er et fund — slå op i `src/Resources`, før du påstår det.
- **Afstande og typografi.** Nye tal, der ikke matcher skalaen i de
  omkringliggende skærme. En ny skriftstørrelse eller -vægt, der ikke findes
  andre steder.
- **Mønstre tæt på.** Navigation, navngivning og afstand skal følge den
  skærm, ændringen rører. En ny overskriftsstil midt i en eksisterende flade
  er et fund, også når den er pænere.
- **Mobile-first.** Layout der afhænger af én bestemt skærmbredde, absolutte
  positioner der knækker på en lille eller meget stor telefon, tekst uden
  plads til at vokse.
- **Kontrast.** Ny tekstfarve på ny baggrund uden nok kontrast. Regn efter,
  når du er i tvivl, i stedet for at skønne.
- **Design-handoff.** Ligger der noget relevant i
  `design_handoff_fitven_redesign/` for den skærm, PR'en rører, så hold
  ændringen op mod det.
- **Ikoner og aktiver.** Ny ikonstil der ikke matcher det sæt, der bruges.
  Et billede i en anden proportion end naboerne.

## Sådan arbejder du

Du kan ikke se skærmen. Læs derfor style-filen og komponenten sammen — det
er også, hvad repoets egen guide beder om — og sammenlign med den nærmeste
eksisterende skærm af samme slags. Afvigelsen fra naboen er dit signal.

## Ikke dit bord

Flow, tilstande, trykfladers størrelse og tilgængelighedslabels
(`ui-usability`). Genrendering (`performance`). Navngivning af variabler
(`code-design`).
