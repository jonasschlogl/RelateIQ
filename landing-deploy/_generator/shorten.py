import re
p='/root/lp/index.html'
s=open(p).read()
def rep(old,new,count=1):
    global s
    pat=r'\s+'.join(re.escape(w) for w in old.split())
    s,n=re.subn(pat,lambda m:new,s,count=0 if count==0 else count)
    assert n>=1,('missing',old[:60])
def drop_p(text):
    global s
    pat=r'\s*<p[^>]*>\s*'+r'\s+'.join(re.escape(w) for w in text.split())+r'\s*</p>'
    s,n=re.subn(pat,'',s,count=1); assert n==1,('missing p',text[:50])

rep("Talk through a conflict, check a message before you send it, and rehearse the hard conversation. A private coach that remembers your story and is there at 2am.","Talk it through, check a message before you send it, rehearse the hard talk. A private coach, there at 2am.")
rep("Pick a situation. Watch what Message check does with the first draft.","Pick a situation and see the difference.")
rep("Example, not a live chat. Early access gives you the real thing, with your own words.","Example. Early access gives you the real thing.")
drop_p("The things people most often get stuck on, and a way to say them that gets heard.")
rep("Four quick questions. Find out your pattern and what to try next time.","4 questions. Find your pattern.")
rep("For fun and reflection, not a diagnosis. Nothing you pick here is stored.","For fun, not a diagnosis. Nothing is stored.")
rep("In your own words. Type, dictate, or add a screenshot.","Type it, or add a screenshot.")
rep("Get patterns, honest feedback and specific next steps.","Honest feedback and next steps.")
rep("Send a better message, or rehearse the conversation first.","Send it, or rehearse it first.")
rep("Start with any one of them. Each takes only a few minutes, and all three are free to try.","All three are free to try.")
# tools
rep("Describe what happened in your own words. It remembers your partner and your earlier chats, so you never start from zero.","It remembers your partner and your past chats, so you never start from zero.")
rep('<strong>Spots patterns</strong> you might miss, like "you both go quiet after an argument"','<strong>Spots patterns</strong> you might miss')
rep("<strong>Always there</strong>, even at 2am. You can add screenshots or documents for context","<strong>Always there</strong>, even at 2am")
rep("Paste a message before you hit send. In a few seconds you see how it may land and get versions you can send as they are.","Paste a message and see how it may land, plus better versions.")
rep("<strong>2 or 3 better versions</strong>: calmer, more direct, or warmer","<strong>2 or 3 better versions</strong> to send")
rep("<strong>Not stored.</strong> We keep only a counter, so we can apply your plan's limit","<strong>Not stored</strong>, ever")
rep("Describe your partner and rehearse with an AI that plays them, pushback included. Then get a short, honest debrief.","Rehearse with an AI that plays them, pushback included. Then get a short debrief.")
rep("<strong>A debrief every time</strong>: what went well, what to watch for, what to try next","<strong>A debrief every time</strong> with what to try next")
rep("<strong>Switch roles</strong> to hear how your own words might sound to them","<strong>Switch roles</strong> to hear yourself")
rep("<strong>Completely private.</strong> It never contacts your real partner","<strong>Completely private</strong>, never contacts your partner")
# more tools
drop_p("Each one has a plan label, so you always know what is free and what comes with Pro or Premium.")
for o,n in [
("Take a breath with a short calming guide, free for everyone. Pro adds a personal message you can send to reach out, and Premium adds a gentle check-in the next day.","A short calming guide for the first hour. Pro adds a message to reach out."),
("The coach suggests one small thing to try. You tell us how it went. Over time you see what really works for you.","One small thing to try. See what really works for you."),
("One minute a day to notice how things are going. Private, just for you.","One private minute a day."),
("Pick what you want to share and send a link. Your partner doesn't need an account.","Share what you choose. No account needed."),
("Turn a chat into a one-page summary for your therapist. Yours to download or print. Premium adds a full Therapist pack.","A one-page summary of a chat, to download or print."),
("One small thing to focus on this week, plus ideas for little gestures and simple dates.","One focus a week, plus ideas for gestures and dates."),
("The patterns the coach notices across your chats, in a short weekly summary.","Patterns the coach notices, in a weekly summary."),
("Get a short plan before you practice: an opening line, what to avoid, how they may react. Turn up the pushback in hard mode.","An opening line, what to avoid, and a hard mode."),
("A calm look back at your month, and a page that shows your year so far.","A calm look back at your month and year."),
]: rep(o,n)
# compare / approach / trust
drop_p("RelationshipAI sits in between: easier to reach than a therapist, and more useful for relationships than a general AI assistant.")
rep("RelationshipAI isn't a substitute for a licensed therapist. It's what's actually available at 11pm on a Tuesday, when you need to think something through before it becomes a bigger conversation.","Not a substitute for a licensed therapist. It's what's there at 11pm on a Tuesday.")
rep("RelationshipAI isn't an AI best friend or a novelty companion app. It has one job: help you think more clearly about your relationship, and give you words that land better than the ones you'd have found on your own. No tricks to keep you chatting longer than you need to. Just a coach that's ready when you are, guided by methods used in real couples therapy, and honest about where its job ends and a professional's begins.","One job: help you think clearly about your relationship and find words that land. No tricks to keep you chatting. Guided by real couples therapy methods, and honest about where a professional takes over.")
rep("Hashed with bcrypt, never stored in plain text, ever.","Hashed with bcrypt, never plain text.")
rep("Only you can see your conversations in your account. We don't read them as a routine.","Only you can see your chats.")
rep("We don't sell your conversations or use them for advertising. Our AI provider processes them only to write your replies.","Our AI provider only uses them to write your replies.")
rep("No contracts, no retention calls. Manage or cancel anytime from your account page.","No contracts. Cancel from your account page.")
# pricing
rep("Free lets you really try all three main tools. Pro takes the limits away. Premium adds the deeper tools for the conversations that matter most.","Free is enough to feel the difference.")
rep("Enough to feel the difference. No card required.","Try all three tools.")
rep("No daily limit, and our stronger AI for Partner Practice. About the price of a coffee a week.","No daily limit. About a coffee a week.")
rep("Deeper tools for the conversations that matter most, on our most advanced AI.","The deepest tools, on our best AI.")
rep("Prices in EUR. Launch pricing preview. Plans open when RelationshipAI does. Cancel or switch anytime. Paid plans include fair-use limits (1,000 AI messages a month on Pro, 1,500 on Premium) that keep the service fast for everyone.","Prices in EUR. Launch pricing preview, plans open with RelationshipAI. Cancel or switch anytime. Fair-use limits: 1,000 AI messages a month on Pro, 1,500 on Premium.")
# final
rep("Try Coach Chat, Message check and Partner Practice. Join the early access list and we'll write once, the day we open.","Join the list. We'll write once, the day we open.")
# FAQ
def faq(q,a):
    global s
    pat=r'(<summary>'+re.escape(q)+r'</summary>\s*<p>).*?(</p>)'
    s,n=re.subn(pat,lambda m:m.group(1)+a+m.group(2),s,count=1,flags=re.S); assert n==1,q
def faq_del(q):
    global s
    pat=r'\s*<details class="faq-item">\s*<summary>'+re.escape(q)+r'</summary>.*?</details>'
    s,n=re.subn(pat,'',s,count=1,flags=re.S); assert n==1,q
faq("What is RelationshipAI?","A private AI relationship coach: talk things through, check a message before you send it, and rehearse hard conversations. It draws on methods like the Gottman Method, attachment theory and Nonviolent Communication, but is not affiliated with any of these organizations.")
faq("When does RelationshipAI open?","Soon. If you leave your email, we'll write to you once, the day it opens. Clicks on &ldquo;Get early access&rdquo; are counted anonymously.")
faq("What is Partner Practice? Is it talking to my real partner?","No, it never contacts your real partner. The AI plays them as a private rehearsal, then gives you a short debrief.")
faq_del("What is After a fight?"); faq_del("What is the Playbook?")
faq("Can I share things with my partner?","Only if you choose to. You send a link to specific things, and they don't need an account.")
faq("Is RelationshipAI a replacement for therapy?","No. It's a self-improvement tool for between sessions, or when therapy isn't easy to get. For serious problems, abuse or a crisis, please contact a professional.")
faq("Does it work for any kind of relationship?","Yes. Dating, long-term, married, long-distance or non-monogamous.")
faq("What if my partner doesn't want to use it?","That's fine. It works with just you, and Partner Practice lets you prepare on your own.")
faq("Are my conversations private?","Yes. Only you can see them. We never sell them or use them for ads. They're processed by our AI provider (OpenAI) to write replies, and it doesn't train on them under its API terms. Texts pasted into Message check and After a fight are not stored.")
faq("What happens when I reach a Free plan limit?","Coach Chat's 8 daily messages reset every day. You can still read everything you have. To keep going, upgrade to Pro.")
faq("What's the difference between Pro and Premium?","Pro removes the Free limits: up to 1,000 AI messages a month, unlimited Partner Practice, up to 5 partner profiles and more. Premium adds up to 1,500 messages, Advanced AI in Coach Chat, monthly review, Talk plan, hard mode, Therapist pack and priority support. See the full comparison above.")
faq("Can I cancel anytime?","Yes. Cancel or switch plans from your account page and keep access until the end of your billing period. Payments are not refundable, except where the law gives you a right to a refund.")
faq("What AI does it use?","Free uses a fast OpenAI model tuned for relationship coaching. Paid plans add a monthly amount of messages on our most advanced model, and you can pick Fast or Advanced in each chat.")
open(p,'w').write(s)
print('shortened',len(s))
