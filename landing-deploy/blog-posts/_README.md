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
