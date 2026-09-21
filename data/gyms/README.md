# Centres

The source data for `public.gym`: one folder per chain, one folder per centre
inside it, each with an `info.json` and a `hero.jpg` (or `hero.png`). The
`alle-centre.json` beside them is the index the scraper wrote and is not read
by anything here.

| Folder | Chain | Centres | Scraper |
|---|---|---|---|
| `Puregym/` | PureGym | 128 | `Puregym/scrape_puregym.py` |
| `LOOP/` | LOOP Fitness | 137 | `LOOP/scrape_loop.py` |
| `FitSund/` | Fit&Sund | 39 | `FitSund/scrape_fitsund.py` |
| `FitnessX/` | FitnessX | 33 | `FitnessX/scrape_fitnessx.py` |
| `Sats/` | SATS | 28 | `Sats/scrape_sats.py` |

The images are gitignored: 29 MB of photographs would have doubled the
repository, and their home is the public `gym-images` storage bucket, where
the import puts them. The JSON is what is versioned. To rebuild the images,
run the chain's scraper from inside its folder (Python 3, Pillow optional).

Most Fit&Sund centres have no photograph on their site; the scraper wrote the
chain logo as a placeholder and set `hero_is_placeholder`. The import skips
those, and the app shows the chain initials instead.

## Importing

```
node scripts/import-gyms/index.js --dry-run
```

prints the `short_name` derived for every centre. That is the name on the
tiles, so read the list before the first real import; the rule that derives it
is in `scripts/import-gyms/normalizeGym.js`, and a centre it gets wrong wants
an explicit `short_name` in its `info.json`.

```
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-gyms/index.js
```

uploads the images and upserts the rows on `(chain, name)`. It is safe to run
again; a centre without an image keeps the `image_url` it had. The service
role key never goes in the repository - put both variables in the gitignored
`.env` and run `node --env-file=.env scripts/import-gyms/index.js`.
