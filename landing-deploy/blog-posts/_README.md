# Ako pridať nový blog

1. V tomto priečinku (`landing-deploy/blog-posts/`) skopíruj súbor `_TEMPLATE.md` a premenuj ho podľa dátumu a témy, napr. `2026-10-07-how-to-stop-fighting.md`.
2. Otvor ho a vyplň hlavičku (title, date, description, tags) a pod ňou napíš text.
3. Ulož súbor a v termináli spusti:

   git add -A && git commit -m "New blog post" && git push

4. Cloudflare stránku sám prebuduje a o minútu-dve je článok na `/blog/`. Zobrazí sa aj v sekcii "From the blog" na hlavnej stránke a v sitemape.

Pravidlá:
- Súbory, ktoré začínajú znakom `_`, sa nepublikujú (šablóna).
- Ak do hlavičky pridáš riadok `draft: true`, článok sa zatiaľ nepublikuje.
- `date` je vo formáte RRRR-MM-DD. Najnovší článok je navrchu.
- Všetky texty článkov píš po anglicky (stránka je anglická).
- Chceš to vyskúšať lokálne: `node build-blog.mjs` v priečinku `landing-deploy/`.

## Jazyky (preklady)

Blog sa generuje po anglicky + v 5 jazykoch: es, sv, ro, fi, nl (`BLOG_LANGS` v `build-blog.mjs`, preložené hlavné stránky sú vypnuté: `TRANSLATED_HOME = false`). Každý nový článok musí mať preklad do všetkých 5 jazykov. Preložený článok bez `date:` preberie dátum anglického, a kým je anglický `draft: true`, preklad sa nezverejní. Ostatné jazyky presmerováva `landing-page/_redirects` na angličtinu:

- Texty hlavnej stránky: `landing-deploy/i18n/<kód>.json` (anglický text -> preklad). Čo nemá preklad, ostane po anglicky.
- Preložené články: `landing-deploy/blog-posts/<kód>/<ten istý názov súboru>.md` (hlavička navyše obsahuje `slug:`, malé písmená bez diakritiky).
- Zoznam jazykov: `landing-deploy/i18n/langs.json`. Nový jazyk = riadok tu + súbor `<kód>.json` (+ články).
- Po zmene anglického textu na hlavnej stránke spusti `node build-blog.mjs --check` (ukáže, čo ešte nie je preložené) a `node build-blog.mjs --extract` (obnoví `i18n/_source.json`).
- Pri novom anglickom článku: pridaj preložené verzie do priečinkov jazykov, inak sa v tom jazyku nezobrazí (jazykové stránky ukazujú len preložené články).
- Stránky `privacy.html` a `method.html` zatiaľ ostávajú po anglicky.
