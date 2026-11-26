# Blog quality rules (Jonas, 19 Nov 2026: one article a day, but a good one, and not all on one template)

These rules apply to every new article and every refresh. They override the format notes in older prompts.

## 0. Jonas, 26 Nov 2026: the rules that matter most (override anything below that conflicts)
1. **Photos only from Unsplash, never Pexels.** Jonas doesn't like Pexels photos. Log every photo in `_unsplash-used.json` and never reuse one.
2. **Not AI-sounding.** Every article contains Jonas's own opinion in first person (at least 2 short "My take" style passages, opinions and priorities only, never invented experiences). Natural rhythm, varied sentence length, no stock phrases ("navigate", "it's important to note", "in today's world", "let's dive in"), no symmetrical lists of three everywhere. Original and authentic: say something the top 5 results don't.
3. **Titles from the newest findings.** Pick the keyword where the site has the best chance of impressions: long-tail first-person questions people type ("My boyfriend gets defensive...", "My girlfriend says I don't care..."), checked against the top 10 (forums and weak pages = go; big health publishers with exact titles = skip). Check Search Console queries first when possible. H2s are the questions people ask.
4. **Trust.** Real numbers with named sources, honest limits of the research, a safety section where relevant, no hype, no overpromising, the product mentioned only where it genuinely helps.
5. **Value, not plain text.** Every article has at least 2 visual value blocks besides the photos: a `:::stats` card with 2 to 3 key numbers, a `:::chart` with real data from a named source, a table, an infographic image (`![alt](/img/blog/...png "caption")`) or an example box. Statistics can come from different sites (Pew, YouGov, APA, Gottman, dating-app reports, peer-reviewed studies), always verified and quoted exactly.
6. **Front-load the value.** Most readers never reach the end. The short answer box, the most useful numbers and the first ready-to-use lines must be in the first screen or two. Then spread value evenly: every section has something concrete. Never save the best part for the end.
8. **One author box, in Jonas's voice.** Under every article there is a single author box (build-blog.mjs `authorBox`, texts `authorBio` / `authorHow` in EN + the 5 language files): first person, who Jonas is and why he built RelationshipAI, then one line on how the guide is made (research, AI-assisted drafting, sources checked with the count, invented examples, opinions marked, not a therapist). No second "About this guide" box. Never invent new facts about Jonas; change the bio only with his OK.
7. **Links throughout, not at the end.** Every article links to 4 to 7 other blog posts and to the app features, spread through the body: inline links in the text, one `:::read` box with 2 to 3 related articles in the first half, and one `:::tool <check|practice|coach>` card in the middle where it fits the section. The ending stays short.

Rich block syntax (built by build-blog.mjs):
```
:::stats Optional heading
64% | of 18-25 year olds want more honesty in dating
60% | want clearer intentions
source: Tinder Year in Swipe 2025
:::

:::chart Heading of the chart
Label one | 64 | 64%
Label two | 41 | 41%
source: [Name](https://link), year
:::

:::read Related reading
/blog/slug/ | Article title | optional one-line note
:::

:::tool practice
Optional custom card title
:::
```

## 1. Pick a format that fits the search intent
Rotate formats. Never use the same format as the previous published post or the previous draft.

| Format | Fits searches like | Core of the article |
|---|---|---|
| Step-by-step guide | "how to apologize", "how to fix a relationship" | Numbered steps, each with what to do, why, and one line to say |
| Scripts collection | "what to say when...", "text to send after a fight" | 15 to 25 ready-to-use messages grouped by situation, with a note on when each fits |
| Signs + self-check | "signs of ...", "am I ..." | Signs explained, then a short honest self-check the reader can score |
| Myth vs fact | topics full of internet myths (love languages, attachment) | 6 to 9 common claims, what research actually says about each |
| One study, explained | a famous finding people quote (5:1 ratio, bids, 36 questions) | What the study did, what it found, what it does NOT show, how to use it |
| Case walkthrough | complex topics (rebuilding trust, recurring fights) | One couple's situation followed through the whole article, with turning points |
| X vs Y comparison | "space vs avoidance", "jealousy vs insecurity" | Clear criteria, side-by-side table, how to tell which one you're in |
| Real questions answered | broad topics with many sub-questions | 8 to 12 questions people really ask (paraphrased from Reddit/forums, never quoted), each answered properly |

## 2. Elements: use 2 to 4, never the whole set
Pool: table, example box, "why it works" box, scripts, checklist, myth/fact list, self-check, decision flow, "what most advice gets wrong".
- Do not put the same set of boxes in every article. Rename boxes to fit the topic.
- "Quick answers" (FAQ) only when the topic has real follow-up questions; 4 to 7 questions, not always 7.
- Vary openings: a scene, a surprising number, a direct answer, a question the reader is asking themselves. Not always "You..." scenes.
- Vary names and couples (different backgrounds, ages, some same-sex couples). Never reuse a name pair from the last 5 posts.

## 3. Sources
- At least 4 verified sources; at least 1 primary peer-reviewed paper and at least 1 from the last 5 years.
- One study may appear in at most 3 articles across the whole blog (check with grep in blog-posts/). Gottman Institute blog: at most 1 link per article.
- Every number is quoted exactly as the source reports it. If unsure, leave it out.
- Never invent studies, quotes, statistics, user data or "our users" claims.

## 4. Something only this article has
Each article needs one element a reader won't find in the top 5 Google results: a decision framework, a template, a worked example with real wording, a clearly explained nuance from the research, or (only if Jonas supplies real, anonymised data) an insight from RelationshipAI usage.

## 5. Length and quality check
- Length follows intent: 1,200 to 2,800 words. Shorter is fine if the answer is complete.
- Before saving, reread as a sceptical reader: cut filler, cut any sentence that could be in any article, make sure every section contains something concrete.
- Keep: British spelling, no em dashes, warm calm voice, safety note when relevant, soft product paragraph, disclaimer line, Sources.

## 6. Refreshing an older article
Take the next unchecked entry in _refresh-queue.md. Keep the file name, slug and main keyword. Rework it to these rules (often into a different format), bring sources to the minimum, remove repeated studies, add `updated: <today>`, rebuild, tick it off, push. Then add a RETRANSLATE line for it to _translation-queue.md (unless it is still unchecked there).

## 7. Choosing the keyword (Jonas, 19 Nov 2026: the site gets almost no impressions)
Search Console shows most English pages sit at position 50 to 90 for big head terms (toxic relationship, gaslighting, love languages), where Healthline, Psychology Today and Verywell Mind own page 1. A young domain cannot win those. So:
- Pick specific long-tail questions with clear intent and weak competition, ideally "what to say / what to text / how to word it" situations: e.g. "what to text after a fight with your boyfriend", "how to apologize to your girlfriend over text", "what to say when your partner is hurt by something you said". These match Message check and Partner Practice.
- Before choosing, search the exact phrase and look at the top 10: if page 1 is all big health publishers with exact-match titles, skip it; if it has forums (Reddit, Quora), small blogs or loosely matching pages, it is a good target.
- Prefer topics that already get impressions in Search Console (apologising, repair, relationship problems, communication, attachment) and build clusters around them, linking every new article to and from its pillar.
- Never a second article for a covered keyword; a narrower sub-question of a pillar is fine and should link to it.

## 8. Spelling and audience (Jonas, 19 Nov 2026: reach the US)
Write English articles in American English: behavior, apologize, realize, color, practice (verb too), program, defense, toward, mom, roommates, trash, apartment, dollars ($). This overrides the skill's older "British English" note. Use examples that work for a US reader (soccer, not football; bar, not pub). Translations follow their own language norms.
Every "A note on safety" section ends with the US contacts line: the National Domestic Violence Hotline (1-800-799-7233, text START to 88788, thehotline.org) and the 988 Suicide & Crisis Lifeline (call or text 988), plus "Outside the US, contact a local helpline."
Every English article has a short answer box right before the first H2: "> **The short answer:**" followed by a 35 to 55 word direct answer to the main keyword question (for snippets and AI answers). Translations get the same box in their language.
Every article (English and translations) has `seo_title:` in the header: max 60 characters, main keyword first, a number or hook, no "| RelationshipAI". The H1 `title:` can stay longer.
Where a site quiz fits the topic, add one "**Quick quiz:**" line at the end of the first section linking it: /quiz/apology-style/, /quiz/attachment-style/, /quiz/comfort-style/, /quiz/fight-style/, /quiz/love-language/, /quiz/overthinker/, /quiz/relationship-needs/.

## 9. Voice (Jonas, 19 Nov 2026: not one template, natural, some of my own words)
- One short first-person line or paragraph from Jonas per article ("My take", "If I had to pick one...", "I'd start with..."). Opinions and priorities only. Never invent experiences, relationships, conversations or numbers for him.
- The RelationshipAI mention is written fresh for each article, in plain words, and left out where it doesn't genuinely help. Never reuse "It isn't therapy, but..." as a closing formula.
- Every made-up example box ends with a line saying names and details are invented.
- "Quick answers" only when the questions add something the article body doesn't already answer.
- Vary how sample lines are introduced (not always "Try:").
