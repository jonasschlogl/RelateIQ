// Free relationship quizzes: /quiz/ (hub) and /quiz/<slug>/ (one interactive quiz each).
// Imported at the end of build-pages.mjs. Quiz logic lives in /js/quiz.js, styles in /css/quiz.css.
// The first 3 questions of every quiz match the Instagram/TikTok quiz reels, so people recognise them.
import fs from "node:fs";
import path from "node:path";
import { page, LANDING, esc } from "./shell.mjs";

const write = (rel, html) => { const f = path.join(LANDING, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const HEAD = `  <link rel="stylesheet" href="/css/quiz.css?v=6" />`;
const REG = "https://app.relationshipaiadvice.com/register.html";

export const QUIZZES = [
  {
    slug: "attachment-style",
    cat: "attachment",
    tint: "#f4b8c4",
    kicker: "Attachment style quiz",
    h: "What's your <em>attachment style?</em>",
    sub: "Seven quick questions about how you act when love feels close, or uncertain. Answer with your first instinct, not the answer you wish was true.",
    title: "Attachment style quiz: what's your attachment style? | RelationshipAI",
    desc: "Free 2-minute attachment style quiz. Find out if you lean secure, anxious, avoidant or fearful-avoidant, what it means for your relationship and what to try this week.",
    card: "Secure, anxious, avoidant or a mix of both? Find the pattern behind how you love.",
    note: "This quiz is for self-reflection. It is not a clinical assessment or a diagnosis.",
    qs: [
      ["They take 5 hours to text back. You…", ["Assume they're just busy", "Reread your last message 10 times", "Feel fine, you like your space", "Start pulling away first"]],
      ["After a fight, what do you need most?", ["To talk it through calmly", "Reassurance, right now", "Time alone before anything", "To act like you don't care"]],
      ["Things are getting serious. You feel…", ["Safe and excited", "Scared it won't last", "The urge to step back", "Like you want it and fear it"]],
      ["Your partner has a night out without you. You…", ["Tell them to have fun", "Check your phone all evening", "Enjoy the quiet time alone", "Say it's fine, then feel hurt"]],
      ["When something upsets you, you usually…", ["Say what's wrong", "Need them to notice and fix it fast", "Keep it to yourself", "Push them away, then want them back"]],
      ["They say \"I love you\" first. You…", ["Say it back when you mean it", "Finally relax, now you know", "Feel a little trapped", "Feel happy, then start doubting it"]],
      ["Your biggest fear in love is…", ["Not much, you trust it can work", "Being left", "Losing your freedom", "Getting hurt the way you were before"]],
    ],
    results: [
      { name: "Secure", line: "You can be close without losing yourself.",
        text: "You trust that love can be steady. You say what you need, you give space without panicking, and a fight does not feel like the end of the world. Secure does not mean perfect. It means you can repair.",
        good: ["You say what you feel without games", "You can give space without feeling rejected", "You make repair after a fight feel safe"],
        watch: ["You may not notice when your partner feels insecure", "Patience can turn into carrying the relationship alone"],
        tip: "Ask your partner one question tonight: \"What helps you feel safe with me when we argue?\" Their answer tells you their style." },
      { name: "Anxious", line: "You love deeply and you notice everything.",
        text: "When love feels uncertain, your mind fills the silence with worst-case stories. A late reply can feel like a warning sign. That is not neediness. It is a nervous system that learned closeness can disappear.",
        good: ["You are warm, loyal and very attuned", "You notice small changes before anyone else", "You put real effort into the relationship"],
        watch: ["Overthinking a slow reply and over-texting", "Seeking reassurance instead of asking for what you need"],
        tip: "Next time you feel the spiral, wait 20 minutes, then send one calm sentence: \"I missed you today, can we talk tonight?\" instead of five worried ones." },
      { name: "Avoidant", line: "You value your freedom and you protect it.",
        text: "Closeness can start to feel like pressure, so you pull back to feel like yourself again. You are not cold. You learned early that relying on people was risky, so you rely on yourself.",
        good: ["You are calm and steady in a crisis", "You respect your partner's independence", "You don't create drama"],
        watch: ["Going quiet when things get emotional", "Partners reading your need for space as rejection"],
        tip: "When you need space, say it out loud with a time: \"I need an hour to think, then I want to talk.\" Space with a return time feels safe to a partner." },
      { name: "Fearful-avoidant", line: "You want closeness and you fear it at the same time.",
        text: "Part of you reaches for love and part of you braces for getting hurt. It can feel like push and pull, even to you. Often this comes from love that once felt both safe and painful.",
        good: ["You feel deeply and understand pain", "You are very self-aware once you feel safe", "You fight hard for what matters"],
        watch: ["Pulling away right after a close moment", "Testing your partner instead of telling them what you need"],
        tip: "Notice the moment you want to pull back. Name it instead of acting on it: \"I'm feeling scared right now, not angry. Give me a minute.\"" },
    ],
    article: ["/blog/how-attachment-styles-work-in-relationships/", "How attachment styles work in relationships"],
    tool: ["/coach-chat/", "Talk it through with Coach Chat", "Coach Chat remembers your story and helps you handle the moments your attachment style makes hard.", "Want help with the moments your pattern makes hard?"],
  },
  {
    slug: "love-language",
    cat: "love",
    tint: "#f7d99a",
    kicker: "Love language quiz",
    h: "How do you really need <em>to be loved?</em>",
    sub: "Pick fast and don't overthink. Seven questions show which of the five love languages feels most like love to you.",
    title: "Love language quiz: how do you need to be loved? | RelationshipAI",
    desc: "Free 2-minute love language quiz. Find out if you need words, touch, acts of service, gifts or quality time, and how to tell your partner without sounding demanding.",
    card: "Words, touch, help, gifts or time? Find out what actually makes you feel loved.",
    note: "Love languages are a simple way to talk about what you need. Most people have a mix.",
    qs: [
      ["Worst day ever. What fixes it?", ["Hearing \"I'm proud of you\"", "A long, quiet hug", "They handle dinner and dishes", "A small surprise on the way home", "Their full attention, phone away"]],
      ["The moment you felt most loved was…", ["Something they said", "Falling asleep on their chest", "When they took care of everything", "A tiny gift that meant a lot", "A whole day, just the two of you"]],
      ["What hurts you the most?", ["Harsh words in a fight", "No affection for days", "Promises they don't keep", "Forgetting a special day", "Them scrolling while you talk"]],
      ["They're away for a week. What helps most?", ["Sweet texts every day", "Counting down to the first hug", "They sorted things at home before leaving", "A note or gift they left behind", "A nightly call with full attention"]],
      ["Your perfect birthday includes…", ["A heartfelt card you'll keep", "Lots of cuddles", "Them planning everything for you", "A gift that shows they listened", "A whole day together, no phones"]],
      ["After a fight, what makes it right?", ["A real, spoken apology", "Being held", "Them fixing what went wrong", "A small peace offering", "Sitting down and really talking"]],
      ["You show love most by…", ["Telling them what you love about them", "Hugs, kisses, a hand on their back", "Doing things that make their life easier", "Bringing home things that remind you of them", "Making time, even when you're busy"]],
    ],
    results: [
      { name: "Words of affirmation", line: "You feel loved when love is said out loud.",
        text: "Compliments, \"I'm proud of you\" and sweet texts land deep with you. Silence or harsh words in a fight hit just as deep. You don't need speeches, you need to hear it.",
        good: ["You remember the kind things people say", "You are good at encouraging your partner"],
        watch: ["Criticism can feel like rejection", "You may wait for words your partner shows in other ways"],
        tip: "Tell your partner: \"It means a lot when you tell me what you like about us. Even one line a day.\" Specific asks are easier to give." },
      { name: "Physical touch", line: "You feel loved when you feel close.",
        text: "A hug, a hand on your back, falling asleep next to each other. Touch is how you feel safe and connected. Days without affection can make you feel far apart, even when nothing is wrong.",
        good: ["You make your partner feel warm and wanted", "You calm down faster when someone holds you"],
        watch: ["Distance after a fight hurts you more than the fight", "Your partner may not know touch matters this much"],
        tip: "Ask for one daily ritual: a long hug when you see each other after work. Twenty seconds is enough to feel it." },
      { name: "Acts of service", line: "You feel loved when someone makes life lighter.",
        text: "Dinner handled, the car fixed, the thing you hate doing already done. For you, love is a verb. Broken promises and \"I'll do it later\" feel like you don't matter.",
        good: ["You notice and appreciate effort", "You show love in practical, reliable ways"],
        watch: ["Doing everything yourself and quietly resenting it", "Reading a forgotten task as not caring"],
        tip: "Instead of hinting, pick one thing: \"It would mean a lot if you handled dinner on Thursdays.\" Clear beats hoping." },
      { name: "Receiving gifts", line: "You feel loved when someone was thinking of you.",
        text: "It's never about the price. A note, a snack you love, something they saw and thought of you. The gift is proof you were on their mind. Forgotten special days can sting.",
        good: ["You give thoughtful, personal gifts", "You treasure small things for years"],
        watch: ["A forgotten date can feel bigger than it is", "Partners may think you want expensive things"],
        tip: "Tell your partner it's the thought: \"The small things you bring me mean more than any big present.\" It takes the pressure off." },
      { name: "Quality time", line: "You feel loved when you have their full attention.",
        text: "Phones away, a long walk, a real conversation. Time together is how you feel connected. A partner scrolling while you talk can feel like being alone in the same room.",
        good: ["You are fully present with people you love", "You create the best memories in the relationship"],
        watch: ["Busy weeks can make you feel unloved", "Distracted moments feel personal"],
        tip: "Suggest one phone-free hour each week, same day, same time. Protected time beats random good intentions." },
    ],
    article: ["/blog/love-languages/", "The 5 love languages, explained"],
    tool: ["/message-check/", "Ask for what you need with Message check", "Write how you want to ask for more of your love language, and see how it will land before you send it.", "Ask for what you need, and see how it lands first."],
  },
  {
    slug: "fight-style",
    cat: "conflict",
    tint: "#f8c7a3",
    kicker: "Conflict style quiz",
    h: "What kind of partner are you <em>in a fight?</em>",
    sub: "Be honest, nobody's watching. Seven questions show your conflict style, what it does to your relationship and what to say next time.",
    title: "Conflict style quiz: what kind of partner are you in a fight? | RelationshipAI",
    desc: "Free 2-minute conflict style quiz for couples. Find out if you escalate, shut down, people-please or repair, and get one thing to say in your next argument.",
    card: "Do you get louder, go quiet, give in or repair? See your fight style and what to say next time.",
    note: "Inspired by research on how couples argue, including the Gottman Method. For self-reflection, not a diagnosis.",
    qs: [
      ["In the middle of an argument, you usually…", ["Get louder so they hear you", "Go quiet and shut down", "Apologize just to end it", "Stay calm and look for a fix"]],
      ["They say \"you always do this.\" You…", ["List what THEY always do", "Leave the room", "Say sorry right away", "Ask what they really mean"]],
      ["Two hours after the fight, you're…", ["Still replaying who was right", "Waiting for them to come first", "Overthinking if they're still mad", "Ready to talk it out"]],
      ["The same old topic comes up again. You…", ["Bring up every past time too", "Change the subject", "Agree with whatever they say", "Suggest a new way to talk about it"]],
      ["During a fight, your body feels…", ["Heart racing, ready to argue", "Numb, like you checked out", "Tight stomach, you just want it over", "Tense, but you can still listen"]],
      ["Who usually makes up first?", ["You, once you've said your piece", "Them, you wait it out", "You, even when you weren't wrong", "Whoever is ready first"]],
      ["Your partner starts crying in a fight. You…", ["Feel it's unfair, you're upset too", "Freeze and don't know what to do", "Drop everything and apologize", "Slow down and ask what they need"]],
    ],
    results: [
      { name: "The Fire Starter", line: "You fight to be heard.",
        text: "When it matters, you push. Your voice gets louder because you are scared the problem won't get solved. The trouble is that criticism and blame make the other person defend, not listen.",
        good: ["You don't let problems hide", "You care enough to fight for the relationship"],
        watch: ["\"You always\" and \"you never\" start a second fight", "Winning the argument while losing the connection"],
        tip: "Start with \"I feel ___ about ___, and I need ___\" instead of \"You always ___\". Same message, half the defence." },
      { name: "The Wall", line: "You go quiet to keep things from getting worse.",
        text: "When a fight heats up, your body floods and you shut down. To your partner it can look like you don't care, when really you are overwhelmed. Researchers call this stonewalling.",
        good: ["You rarely say things you regret", "You stay calm on the outside"],
        watch: ["Silence feels like punishment to your partner", "Problems come back because they never got solved"],
        tip: "Instead of walking away, say: \"I'm overwhelmed. I need 20 minutes, then I'll come back.\" Then come back." },
      { name: "The Peacekeeper", line: "You end fights fast, even when it costs you.",
        text: "You apologize first, agree quickly and let it go, because conflict feels unsafe. Peace returns, but your own needs never get said, and resentment quietly builds.",
        good: ["You calm things down quickly", "You are kind even when you're hurt"],
        watch: ["Saying sorry for things that weren't your fault", "Your partner never learns what you need"],
        tip: "Next time, before you apologize, add one honest sentence: \"I want to fix this, and I also felt ___ when ___.\"" },
      { name: "The Repairer", line: "You fight to fix it, not to win.",
        text: "You can stay in a hard conversation, listen and look for a way back to each other. Couples who repair well are the ones who last. Your job is to stay patient when your partner can't do it yet.",
        good: ["You make repair attempts that land", "You can listen while upset"],
        watch: ["Pushing to solve it before your partner is ready", "Carrying all the repair work yourself"],
        tip: "Ask: \"Do you want to solve this now, or do you need a bit of time first?\" Matching their pace is part of repair." },
    ],
    article: ["/blog/how-to-rebuild-trust-after-a-fight/", "How to rebuild trust after a fight"],
    tool: ["/partner-practice/", "Rehearse your next hard talk", "Partner Practice plays your partner so you can try a calmer way to say it before the real conversation.", "Practise your next hard talk before it's real."],
  },  {
    slug: "overthinker",
    cat: "overthinking",
    tint: "#f9cfae",
    kicker: "Overthinking quiz",
    h: "What kind of <em>overthinker</em> are you?",
    sub: "Seven quick questions about what your mind does when love feels uncertain. Pick the answer that sounds most like you, not the one you wish was true.",
    title: "Overthinking quiz: what kind of overthinker are you? | RelationshipAI",
    desc: "Free 2-minute overthinking quiz for relationships. Find out if you replay, decode or predict the worst, and get one calming thing to try this week.",
    card: "Do you replay, decode or predict the worst? Find your overthinking pattern.",
    note: "This quiz is for self-reflection. It is not a clinical assessment or a diagnosis.",
    qs: [
      ["They reply with just \"ok\". You…", ["Replay what you said earlier", "Analyse the full stop and the tone", "Picture them losing interest", "Assume they're busy and move on"]],
      ["It's 1 am and you can't sleep. You're thinking about…", ["An awkward thing you said last week", "A message you still can't read clearly", "Where this relationship will be in a year", "Nothing much, you'd be asleep"]],
      ["Your partner seems quiet at dinner. You…", ["Go back over your day for mistakes", "Study their face for clues", "Wonder if this is the beginning of the end", "Ask if they're okay"]],
      ["After a small argument, your mind…", ["Plays it on repeat", "Picks apart every word they used", "Jumps to \"we're not going to make it\"", "Lets it go once you've talked"]],
      ["They haven't liked your new post. You…", ["Wonder if you posted something wrong", "Check if they liked someone else's", "Decide they're pulling away", "Don't notice"]],
      ["Before a big conversation, you…", ["Rehearse what you said last time", "Plan what every reaction might mean", "Imagine the worst way it could go", "Think about what you want, then stop"]],
      ["A friend says \"you're overthinking it\". You…", ["Think about why they said that", "Ask what exactly they meant", "Worry they're tired of you", "Agree and change the subject"]],
    ],
    results: [
      { name: "The Replayer", line: "Your mind lives in the last conversation.",
        text: "You go back over what was said, again and again, looking for the moment it went wrong. It feels like learning from it, but replaying rarely brings new information. Mostly it brings the feeling back.",
        good: ["You care about how your words land", "You are quick to own your mistakes"],
        watch: ["Apologising for things nobody noticed", "Losing sleep over conversations that are already over"],
        tip: "Give the replay a time slot: 10 minutes in the evening, written down. When it shows up at 2 pm, tell yourself \"later\"." },
      { name: "The Decoder", line: "You read between every line.",
        text: "A full stop, a short reply, a different emoji. You notice everything and try to work out what it means. Your attention is a gift, but most messages carry far less meaning than your mind gives them.",
        good: ["You pick up on small changes fast", "You are emotionally perceptive"],
        watch: ["Treating the tone of a text as a fact", "Checking \"last seen\" and read receipts"],
        tip: "Write down what the message actually says, then two other explanations for it. Still unsure? Ask one simple question instead of guessing." },
      { name: "The Fortune Teller", line: "Your mind runs ahead to the worst ending.",
        text: "One quiet evening and you are already picturing the breakup. Your mind is trying to protect you by preparing for pain. But in one study of people with anxiety, more than 9 in 10 of their worries never came true.",
        good: ["You think ahead and plan", "You take the relationship seriously"],
        watch: ["Reacting to a future that hasn't happened", "Pulling away first so you can't get hurt"],
        tip: "When the worst-case movie starts, ask yourself: what do I actually know right now? Say only that sentence out loud." },
      { name: "The Settled One", line: "You let things go once they're said.",
        text: "Uncertainty doesn't grab you for long. You ask when you want to know, and you don't build stories in the gaps. That calm is valuable, especially if your partner tends to overthink.",
        good: ["You don't make small things bigger", "You ask instead of guessing"],
        watch: ["Your calm can look like not caring", "Missing it when your partner needs reassurance"],
        tip: "If your partner overthinks, send one small, clear message when plans change. It costs you seconds and saves them hours." },
    ],
    article: ["/blog/how-to-stop-overthinking-in-a-relationship/", "How to stop overthinking in a relationship"],
    tool: ["/message-check/", "Check a text instead of overthinking it", "Message check shows how a message will probably land, so you don't have to guess.", "Check a text before you overthink it."],
  },
  {
    slug: "relationship-needs",
    cat: "check-up",
    tint: "#f9e2ae",
    kicker: "Relationship check-up",
    h: "What does your relationship <em>need right now?</em>",
    sub: "Seven quick questions about how things have felt between you lately. Answer for the last few weeks, not your best or worst day.",
    title: "Relationship check-up quiz: what does your relationship need right now? | RelationshipAI",
    desc: "Free 2-minute relationship check-up. Find out if you need more time together, better talks, more fun or more teamwork, and get one thing to try this week.",
    card: "More time, better talks, more fun or more teamwork? Find what would help most.",
    note: "This quiz is for self-reflection. It is not a clinical assessment.",
    qs: [
      ["Lately, your evenings together look like…", ["Two people on two phones", "Talking, but mostly about logistics", "The same routine every night", "One of you doing everything"]],
      ["The last time you felt really close was…", ["Hard to remember", "After a good, honest talk", "On a trip or a fun day out", "When they helped with something hard"]],
      ["Small frustrations usually come from…", ["Not seeing each other enough", "Feeling misunderstood", "Feeling bored or stuck", "Feeling like you carry more"]],
      ["If you could add one thing to this week, it would be…", ["An evening with no screens", "One honest conversation", "Something new and silly together", "Help with the to-do list"]],
      ["When you argue, it's often about…", ["Not making time", "How something was said", "Nothing really, you just feel flat", "Who does what"]],
      ["You'd feel most loved if they…", ["Planned time just for you two", "Really listened without fixing", "Surprised you with something fun", "Took something off your plate"]],
      ["Which sentence fits best right now?", ["We're busy, but we miss each other", "We keep missing each other's point", "We're good, just on autopilot", "I need to feel we're a team again"]],
    ],
    results: [
      { name: "More time together", line: "You don't need more love. You need more of each other.",
        text: "Life has crowded out the moments that keep you close. It's common and very fixable. Closeness grows from small, regular moments more than from big gestures.",
        good: ["You still want each other's company", "The bond is there, it just needs space"],
        watch: ["Living side by side on separate screens", "Saving connection for \"when things calm down\""],
        tip: "Pick one evening this week with phones out of the room for 30 minutes. Ask one real question, like \"What's been on your mind lately?\"" },
      { name: "Better talks", line: "You're talking, but not always hearing each other.",
        text: "The love is there, but conversations end in misunderstanding more than you'd like. Often it's not what you say but how a talk starts. Small changes in how you start and how you listen make a big difference.",
        good: ["You both still try to talk things through", "You care about being understood"],
        watch: ["Starting hard talks with blame", "Defending instead of listening"],
        tip: "Start your next hard talk with \"I feel ___ about ___, and I need ___\". Then repeat back what you heard before you answer." },
      { name: "More fun", line: "You're solid, just stuck on autopilot.",
        text: "Nothing is really wrong, but things feel flat. Routines are comfortable, and they can also make a relationship feel like sharing a flat. Research on couples suggests that doing new things together can bring back some of the early spark.",
        good: ["You have a stable base", "You feel safe with each other"],
        watch: ["Mistaking comfort for boredom", "Only talking about chores and plans"],
        tip: "Plan one small first this week: a new recipe, a walk somewhere new, or three date night questions you've never asked." },
      { name: "More teamwork", line: "You need to feel you're in this together.",
        text: "One of you is carrying more, or it feels that way. Over time, an uneven load turns into quiet resentment. The fix is rarely a big talk about everything. It's a clear, fair split of real tasks.",
        good: ["You're both committed to making life work", "You notice what needs doing"],
        watch: ["Keeping score in silence", "Asking for \"help\" instead of handing over whole tasks"],
        tip: "List everything that keeps your home running, including planning and remembering. Then hand over one whole task, from noticing to finishing." },
    ],
    article: ["/blog/relationship-problems-that-keep-coming-back/", "5 relationship problems that keep coming back"],
    tool: ["/partner-practice/", "Rehearse the talk you keep putting off", "Partner Practice plays your partner so you can try a calm way to ask for what you need.", "Practise the talk you keep putting off."],
  },
  {
    slug: "comfort-style",
    cat: "love",
    tint: "#f6c3b4",
    kicker: "Comfort style quiz",
    h: "How do you <em>comfort</em> the person you love?",
    sub: "Seven everyday moments when your partner is having a hard time. Pick what you would really do, not what you think you should do.",
    title: "Comfort style quiz: how do you comfort your partner? | RelationshipAI",
    desc: "Free 2-minute comfort style quiz. Find out if you comfort by fixing, listening, hugging or lightening the mood, and how to support your partner better.",
    card: "Fix it, listen, hug or make them laugh? Find how you show up when they're struggling.",
    note: "This quiz is for self-reflection. It is not a clinical assessment or a diagnosis.",
    qs: [
      ["Your partner comes home after a terrible day. You first…", ["Ask what went wrong and suggest a plan", "Sit down and let them talk", "Hug them before anyone says a word", "Put on their favourite show and order food"]],
      ["They say they bombed an important presentation. You…", ["Work out what to do next", "Ask how it felt", "Pull them close", "Make them laugh about something else"]],
      ["They're stressed about money. You…", ["Open a spreadsheet and look at options", "Say \"that sounds really heavy\"", "Hold their hand", "Suggest a walk to clear their head"]],
      ["A friend cancels on them at the last minute. You…", ["Suggest who else they could call", "Ask how they feel about it", "Cuddle up on the sofa", "Plan something fun for tonight"]],
      ["They go quiet after a hard call with family. You…", ["Offer advice for the next call", "Stay close and wait until they want to talk", "Sit next to them, shoulders touching", "Make tea and talk about something light"]],
      ["When someone comforts YOU, you like it most when they…", ["Help you solve it", "Really listen", "Just hold you", "Take your mind off it"]],
      ["Your partner says \"I just need a minute.\" You…", ["Think about what might help later", "Say you're here whenever they're ready", "Stay in the room quietly", "Check in later with a snack and a joke"]],
    ],
    results: [
      { name: "The Fixer", line: "You show love by solving things.",
        text: "When someone you love is struggling, you see a problem and want to help right away. Your practical care is real and valuable. The risk is that advice can land as \"your feelings are a task to finish\" when your partner only wanted to be heard.",
        good: ["You stay calm and useful in a crisis", "Your partner knows you will help"],
        watch: ["Giving advice nobody asked for", "Moving to solutions before they feel heard"],
        tip: "Ask: \"Do you want advice, or do you just want me with you?\" Then do exactly what they answer." },
      { name: "The Listener", line: "You make space for feelings.",
        text: "You don't rush or fix. You let your partner talk and you stay with them in it. That kind of patience helps people feel understood. Sometimes, though, quiet can look like you have nothing to say.",
        good: ["People feel safe telling you hard things", "You don't judge or hurry them"],
        watch: ["Staying silent when a clear sign of care would help", "Holding back your own view"],
        tip: "Add one short sentence of care to your listening, like \"I'm on your side\" or \"That sounds really hard.\"" },
      { name: "The Hugger", line: "You comfort without words.",
        text: "A hug, a hand on their back, sitting close. You use touch to say \"I'm here\", and for many people it works faster than words. The catch is that some people need space or words first, and touch can feel like too much in the wrong moment.",
        good: ["Your presence is calming", "You make people feel physically safe"],
        watch: ["Assuming touch is what they need", "Skipping words when they'd help"],
        tip: "Ask first: \"Would a hug help right now?\" It takes two seconds and shows you're paying attention to them." },
      { name: "The Lightener", line: "You make hard moments feel lighter.",
        text: "You bring warmth, snacks, humour and a change of scene. That can break a spiral and remind your partner that life goes on. Timing matters though: a joke too early can feel like brushing their feelings aside.",
        good: ["You lift the mood when things feel heavy", "You make hard days easier to get through"],
        watch: ["Changing the subject too soon", "Humour that skips the feeling"],
        tip: "Listen for a few minutes first. When they start to relax, that is your moment for the funny part." },
    ],
    article: ["/blog/how-to-support-your-partner-when-stressed/", "How to support your partner when they're stressed"],
    tool: ["/message-check/", "Find words that comfort, not fix", "Message check shows how a caring message will land, so your support sounds like support.", "Find the words that comfort, not fix."],
  },
  {
    slug: "apology-style",
    cat: "conflict",
    tint: "#f3d3a4",
    kicker: "Apology style quiz",
    h: "What kind of <em>apology</em> do you need?",
    sub: "Seven moments after something goes wrong between you. Pick the apology that would really make you feel better.",
    title: "Apology style quiz: what kind of apology do you need? | RelationshipAI",
    desc: "Free 2-minute apology style quiz. Find out if you need feelings, responsibility, repair or change, and how to say sorry so your partner really hears it.",
    card: "Feelings, responsibility, repair or change? Find the apology that actually lands for you.",
    note: "Inspired by the apology languages idea from Gary Chapman and Jennifer Thomas. This quiz is for self-reflection, not a clinical assessment.",
    qs: [
      ["They forget your anniversary dinner booking. What makes it right?", ["\"I'm so sorry, I feel awful\"", "\"That was my fault, no excuses\"", "A new booking and flowers", "A plan so it never happens again"]],
      ["After a fight, the apology that works best is…", ["A warm \"I'm sorry I hurt you\"", "\"You're right, I was wrong\"", "Something kind that shows they care", "Acting differently from now on"]],
      ["They hurt your feelings with a joke. You want them to…", ["Say they feel bad about it", "Admit it wasn't okay", "Make it up to you somehow", "Promise to stop that kind of joke"]],
      ["You were late and missed their big moment. You'd apologise by…", ["Telling them how bad you feel", "Saying \"I should have left earlier, that's on me\"", "Planning a special evening to make up for it", "Changing your schedule for next time"]],
      ["Which of these would annoy you most?", ["A sorry with no feeling in it", "An excuse in the middle of an apology", "Words with no action", "The same mistake again next week"]],
      ["They say sorry, but you still feel off. What's missing?", ["Seeing that they truly feel it", "Hearing them take the blame", "Some effort to put it right", "Proof it won't happen again"]],
      ["When you apologise, you usually…", ["Explain how bad you feel", "Own exactly what you did", "Do something to repair it", "Make a plan to change"]],
    ],
    results: [
      { name: "Feelings first", line: "You need to feel the regret.",
        text: "An apology lands for you when you can tell it comes from the heart. Warm words and a sincere tone matter more than a perfect explanation. If it sounds cold or rushed, it can feel like it doesn't count.",
        good: ["You're honest about emotions", "You reconnect quickly after a warm \"sorry\""],
        watch: ["Repeating \"sorry\" without any change", "Getting stuck in guilt instead of repair"],
        tip: "After \"I'm sorry I hurt you\", add one concrete thing you will do. It turns a feeling into an apology people can trust." },
      { name: "Own it", line: "You need responsibility, not excuses.",
        text: "For you, a good apology names exactly what went wrong and who did it, with no \"but\". Hearing someone take responsibility is what makes you feel safe again.",
        good: ["You don't hide behind excuses", "Your apologies build trust"],
        watch: ["Being very hard on yourself", "Expecting your partner to own it as fast as you do"],
        tip: "Own it in one clear sentence, then ask: \"What do you need from me now?\"" },
      { name: "Make it right", line: "You need to see effort.",
        text: "Words alone don't settle it for you. You feel better when someone does something to fix the problem or make it up to you. Real effort tells you it mattered.",
        good: ["You turn sorry into action", "You notice and value effort"],
        watch: ["Gifts or favours that replace the conversation", "Skipping the words your partner may need"],
        tip: "Say the sentence first, then do the thing. Repair works best when both are there." },
      { name: "Change it", line: "You need to know it won't happen again.",
        text: "An apology without change feels empty to you. You trust people who show they've learned something and act differently next time. Repeated mistakes hurt more than the first one.",
        good: ["You take patterns seriously", "You help relationships grow, not just reset"],
        watch: ["Big promises that are hard to keep", "Sounding like a plan instead of a person"],
        tip: "Promise one small change you can keep this week and say it out loud. Small and kept beats big and broken." },
    ],
    article: ["/blog/how-to-apologize-to-your-partner/", "How to apologize to your partner"],
    tool: ["/partner-practice/", "Practise the apology before it's real", "Partner Practice plays your partner so you can try a calm, honest apology first.", "Practise the apology before it's real."],
  },
  {
    slug: "toxic-relationship",
    cat: "check-up",
    tint: "#f8c7a3",
    kicker: "Toxic relationship quiz",
    h: "Is my relationship <em>toxic?</em>",
    sub: "Seven questions about how things feel between you on a normal week. Answer for the last few months, not for one bad day.",
    title: "Toxic relationship quiz: is my relationship toxic? | RelationshipAI",
    desc: "Free 2-minute toxic relationship quiz. Find out if you're in a healthy relationship, a rough patch, an unhealthy pattern or something more serious, and what to do next.",
    card: "Healthy, a rough patch, or a pattern that keeps hurting you? An honest check.",
    note: "This quiz is for self-reflection. It is not a clinical assessment. If you ever feel afraid of your partner, please reach out to someone you trust or a local helpline.",
    qs: [
      ["After a disagreement, you usually…", ["Talk it out and feel closer", "Go quiet for a day, then move on", "Replay it for days, nothing gets solved", "Apologize just to keep the peace"]],
      ["When you see your friends, your partner…", ["Is glad you have them", "Sometimes feels a bit left out", "Sulks or makes little digs", "Checks where you are or asks you not to go"]],
      ["Around them on most days, you feel…", ["Relaxed, like yourself", "Mostly good, a bit stressed lately", "On edge, waiting for the next fight", "Careful, like walking on eggshells"]],
      ["When you share good news, they…", ["Celebrate with you", "Are happy, but distracted", "Find something to criticize", "Make it about them or play it down"]],
      ["Money, plans and phones are…", ["Decided together", "Mostly fair, with a few old habits", "Won by whoever argues longest", "Their call, and they check your phone"]],
      ["When you say something hurt you, they…", ["Listen and try to change it", "Get defensive, then come round", "Turn it around on you", "Say you're too sensitive or it never happened"]],
      ["Picturing a year from now, you feel…", ["Hopeful", "Hopeful, if you both put in work", "Tired", "Scared or trapped"]],
    ],
    results: [
      { name: "Healthy", line: "You feel safe being yourself with them.",
        text: "You argue, like every couple, but you repair, and you come out feeling closer rather than smaller. You keep your friends, your opinions and your voice. That is what a healthy relationship looks like: not perfect, but safe.",
        good: ["You can disagree without fear", "You both keep your own lives", "Problems get talked about, not punished"],
        watch: ["Busy seasons quietly pushing your time together aside", "Small resentments you never mention"],
        tip: "Keep the habit that's working. Once this week, tell them one thing they do that makes you feel safe with them." },
      { name: "A rough patch", line: "Stress is getting into the relationship, but the base is solid.",
        text: "Things feel harder than they used to, and you may be more distant or snappy with each other. That's common when life is heavy. What matters is that you still feel safe and still come back to each other. A rough patch can be repaired.",
        good: ["You both still try", "Hurt gets acknowledged, even if slowly"],
        watch: ["Silent days becoming the default way to handle conflict", "Stress turning into blame"],
        tip: "Name it together without blame: \"We've both been stretched thin. Can we plan one easy evening just for us this week?\"" },
      { name: "Unhealthy patterns", line: "Something keeps hurting you, and it's not getting better on its own.",
        text: "Fights don't get solved, criticism has become normal, and you feel tense more than relaxed. These are unhealthy patterns, often called toxic. Many couples can change them, but usually not by waiting. It takes naming the pattern and, often, outside help.",
        good: ["You can see the pattern, which is the first step", "You still care enough to ask the question"],
        watch: ["Blame being turned back on you every time", "Losing confidence in your own feelings"],
        tip: "Pick one pattern, not everything, and raise it calmly: \"When a fight ends with us both going silent for days, I feel alone. Can we find a better way?\" If nothing changes, a couples therapist can help." },
      { name: "Signs of control", noPartnerShare: true, line: "Your answers point to control, and that is serious.",
        text: "Being checked on, cut off from friends, told your feelings aren't real and feeling scared or trapped are signs of controlling behavior, not a normal rough patch. It is not your fault, and you don't have to figure it out alone.",
        good: ["You noticed it, and that takes courage", "Your instincts are worth trusting"],
        watch: ["Explaining their behavior away", "Feeling more isolated from people who care about you"],
        tip: "Talk to one person you trust this week. If you ever feel unsafe, contact a local domestic abuse helpline. They can help you think through options, confidentially." },
    ],
    article: ["/blog/signs-of-a-toxic-relationship/", "Signs of a toxic relationship"],
    tool: ["/coach-chat/", "Think it through, privately", "Coach Chat helps you sort out what's normal friction and what isn't, at your own pace.", "Want to talk it through, privately?"],
  },
  {
    slug: "losing-interest",
    cat: "check-up",
    tint: "#e2d4f0",
    kicker: "Is my partner losing interest? quiz",
    h: "Is my partner <em>losing interest?</em>",
    sub: "Seven questions about what has changed lately. Think about the last few weeks compared to a few months ago.",
    title: "Is my partner losing interest? Free quiz | RelationshipAI",
    desc: "Free 2-minute quiz: is your partner losing interest, or just stressed? Find out if they're still invested, busy, drifting or pulling away, and what to say next.",
    card: "Still into you, just stressed, drifting or pulling away? Read the signs calmly.",
    note: "This quiz is for self-reflection. Only your partner can tell you how they feel, so use your result to start a conversation.",
    qs: [
      ["Their replies to your texts are…", ["Quick and warm, like always", "Slower lately, but still warm", "Short and flat", "Hours late, or none at all"]],
      ["Plans together lately…", ["They make plans too", "Get moved because of work or stress", "Only happen when you push", "Get cancelled more than they happen"]],
      ["When you talk about your day, they…", ["Ask follow-up questions", "Listen, but look tired", "Half-listen while on their phone", "Change the subject"]],
      ["Affection lately is…", ["The same as always", "Less, but they're exhausted", "Rare unless you start it", "Something they avoid"]],
      ["Talking about the future…", ["Comes up easily", "Is on hold until things calm down", "Feels vague now", "Gets shut down"]],
      ["When you ask if something's wrong, they…", ["Say no, and it really seems fine", "Say they're stressed and explain why", "Say \"I'm fine\" without looking at you", "Get irritated that you asked"]],
      ["Compared to a few months ago, they seem…", ["The same, maybe closer", "More stressed, not less into you", "Further away, hard to say why", "Like they've already left in their head"]],
    ],
    results: [
      { name: "Still invested", line: "The signs say they're still in this with you.",
        text: "They reply, they plan, they listen and they talk about the future. If you still feel uneasy, the worry may be coming from inside you rather than from them. That's worth knowing too, because overthinking can create distance that wasn't there.",
        good: ["They show up in small, everyday ways", "You can talk openly about worries"],
        watch: ["Reading one slow reply as a sign", "Checking for proof instead of enjoying them"],
        tip: "Tell them what you appreciate instead of asking if things are okay: \"I love that you always ask about my day.\"" },
      { name: "Busy, not distant", line: "They're stretched thin, not checking out.",
        text: "Less time and energy is not the same as less love. When someone is stressed, closeness is often the first thing that slips, even though they still care. What they may need from you is less pressure and a bit of support.",
        good: ["They explain what's going on", "The warmth is still there when you get time"],
        watch: ["Taking their stress personally", "Waiting silently until it gets worse"],
        tip: "Offer support instead of asking for attention: \"You seem really stretched. What would help most this week?\"" },
      { name: "Drifting", line: "You're drifting, and it's worth talking about now.",
        text: "Replies are flat, plans need pushing and closeness mostly starts with you. This often happens slowly in long relationships and doesn't mean it's over. It does mean it's time for an honest, calm conversation before the distance becomes the new normal.",
        good: ["Nothing is broken yet", "You noticed early"],
        watch: ["Over-pursuing, which can push them further away", "Saying nothing and quietly resenting it"],
        tip: "Use one specific, calm sentence: \"I've been missing us lately. Can we talk about how we're both feeling?\"" },
      { name: "Pulling away", line: "Your answers point to someone pulling away.",
        text: "Avoided affection, shut-down conversations and irritation when you ask are strong signs that something has changed for them. It may be something they haven't said out loud yet. You deserve a clear answer, not more guessing.",
        good: ["You're seeing things clearly", "You're asking instead of ignoring it"],
        watch: ["Trying harder and harder to win them back alone", "Accepting vague answers for months"],
        tip: "Ask directly and kindly, at a calm moment: \"It feels like you've pulled away. I'd rather know the truth than keep guessing.\"" },
    ],
    article: ["/blog/signs-your-partner-is-losing-interest/", "Signs your partner is losing interest"],
    tool: ["/partner-practice/", "Rehearse the talk first", "Partner Practice plays your partner so you can practise asking the hard question calmly.", "Practise the talk before it's real."],
  },
  {
    slug: "codependency",
    cat: "attachment",
    tint: "#d6e4c8",
    kicker: "Codependency quiz",
    h: "Am I <em>codependent?</em>",
    sub: "Seven questions about how much of yourself goes into your relationship. Answer with what you actually do, not what you think you should do.",
    title: "Codependency quiz: am I codependent? | RelationshipAI",
    desc: "Free 2-minute codependency quiz. Find out if your relationship is balanced or if you lean people-pleaser, rescuer or lose yourself in love, and one thing to try this week.",
    card: "Balanced, people-pleaser, rescuer or losing yourself? See how you give in love.",
    note: "This quiz is for self-reflection. Codependency is not a clinical diagnosis, and this is not an assessment.",
    qs: [
      ["Your partner is in a bad mood. You…", ["Ask if they want to talk, then carry on", "Wonder what you did wrong", "Drop everything to fix it", "Can't relax until they're better"]],
      ["Saying no to your partner feels…", ["Normal, sometimes necessary", "Uncomfortable, so you rarely do it", "Selfish if they need you", "Almost impossible"]],
      ["When they mess something up, you…", ["Let them handle it", "Smooth it over so no one is upset", "Step in and sort it out for them", "Feel like it's somehow your fault"]],
      ["Your own plans and hobbies…", ["Still matter a lot", "Get moved if they might mind", "Come after helping them", "Have faded since you got together"]],
      ["When they're happy, you feel…", ["Happy for them", "Relieved, you can breathe", "Proud you made it happen", "Okay, because your mood follows theirs"]],
      ["Your friends say you're…", ["Pretty balanced", "Too nice", "Doing everything for them", "Hard to see these days"]],
      ["Imagine a week apart. You…", ["Miss them and enjoy your time", "Worry they'll be upset with you", "Worry how they'll cope without you", "Feel lost"]],
    ],
    results: [
      { name: "Balanced", line: "You care deeply and you keep yourself.",
        text: "You support your partner without carrying their feelings for them. You can say no, keep your own life and still be close. Psychologists call this healthy interdependence: two people who lean on each other without losing themselves.",
        good: ["You give without keeping score", "You keep your friends and interests", "Their bad mood doesn't run your day"],
        watch: ["Over-giving in stressful seasons", "Assuming your partner feels as balanced as you"],
        tip: "Ask your partner: \"Do you ever feel you give more than you get with me?\" Balance stays healthy when you check in on it." },
      { name: "People-pleaser", line: "You keep the peace, often at your own cost.",
        text: "You're tuned in to other people's moods and quick to adjust so nobody gets upset. It makes you kind and easy to be with. Over time, though, unsaid needs turn into tiredness and quiet resentment, and your partner never gets to know what you really want.",
        good: ["You're warm, considerate and easy to be with", "You notice what others need"],
        watch: ["Saying yes when you mean no", "Apologizing for things that aren't your fault"],
        tip: "Practise one small, honest no this week: \"I'd rather not tonight, but how about Saturday?\" Notice that the relationship survives it." },
      { name: "Rescuer", line: "You fix things, even when they're not yours to fix.",
        text: "When your partner struggles, you step in and take over. It comes from love and competence, and it can also stop them from growing and leave you exhausted. Helping turns into carrying, and carrying turns into resentment.",
        good: ["You're reliable and strong in a crisis", "You show love through action"],
        watch: ["Taking responsibility for their problems", "Feeling needed more than feeling loved"],
        tip: "Next time they struggle, ask before acting: \"Do you want help, or do you want me to listen?\" Then do only what they ask." },
      { name: "Losing yourself", line: "Your relationship has become your whole world.",
        text: "Your mood follows theirs, your own life has shrunk and time apart feels frightening. This is what people usually mean by codependency. It often grows from a deep fear of being left, and it's very changeable, especially with support.",
        good: ["You love with your whole heart", "You're deeply loyal"],
        watch: ["Losing friends, hobbies and your own opinions", "Feeling empty when they're not around"],
        tip: "Put one thing back in your week that's only yours: a class, a friend, a walk alone. Keep it even if they'd rather you didn't." },
    ],
    article: ["/blog/codependent-relationship/", "Codependent relationship: signs and how to change it"],
    tool: ["/coach-chat/", "Find yourself again, step by step", "Coach Chat remembers your story and helps you practise boundaries without the guilt.", "Want help setting a boundary without the guilt?"],
  },
];

const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const SITE = "https://relationshipaiadvice.com";
const CATS = [
  ["attachment", "Attachment"],
  ["love", "Love & affection"],
  ["conflict", "Conflict"],
  ["overthinking", "Overthinking"],
  ["check-up", "Relationship check-up"],
];
const catName = (c) => (CATS.find((x) => x[0] === c) || [, "Quiz"])[1];
const plain = (h) => h.replace(/<[^>]+>/g, "");
const img = (q) => `/img/quiz-pages/${q.slug}.jpg`;
const META = "7 questions · 2 min";

// quiz card in the same markup as the blog cards
const card = (q, ev) => `<a class="post-card qz-pc" href="/quiz/${q.slug}/" data-cat="${q.cat}" data-umami-event="${ev}-${q.slug}">
  <span class="post-thumb"><img src="${img(q)}" alt="" width="1200" height="800" loading="lazy" decoding="async" /></span>
  <div class="post-card-top"><span class="post-tag">${esc(catName(q.cat))}</span><span class="post-meta">${META}</span></div>
  <h3>${q.h}</h3>
  <p>${esc(q.card)}</p>
  <span class="post-more">Take the quiz ${arrow}</span>
</a>`;

// ---------- hub: /quiz/ (blog index layout + category filter) ----------
{
  const used = CATS.filter(([k]) => QUIZZES.some((q) => q.cat === k));
  const chip = (k, label, n, on = false) => `<button type="button" class="qz-chip${on ? " is-on" : ""}" data-cat="${k}" aria-pressed="${on}" data-umami-event="quiz-filter-${k}">${esc(label)}<span>${n}</span></button>`;
  const chips = [chip("all", "All", QUIZZES.length, true), ...used.map(([k, l]) => chip(k, l, QUIZZES.filter((q) => q.cat === k).length))].join("");
  write("quiz/index.html", page({
    title: "Free relationship quizzes | RelationshipAI",
    description: "Free 2-minute relationship quizzes: attachment style, love language, codependency, conflict style, overthinking, toxic relationship and relationship check-ups. Get your result and one thing to try this week.",
    path: "/quiz/", cls: "sp-blog qz-page qz-hubpage", head: HEAD,
    body: `  <main>
    <section class="blog-hero">
      <div class="container">
        <span class="section-tag">Free quizzes</span>
        <h1>Get to know how you love</h1>
        <p>Short psychology quizzes about you and your relationship. Seven questions, two minutes, and one thing to try with your partner this week.</p>
        <div class="qz-chips" role="group" aria-label="Quiz topics">${chips}</div>
      </div>
    </section>
    <section class="blog-list">
      <div class="container">
        <div class="post-grid qz-grid2">${QUIZZES.map((q) => card(q, "quiz-hub")).join("\n")}</div>
        <p class="qz-foot-note">New quizzes every week. Seen one in our videos? Your full result is here.</p>
      </div>
    </section>
    <section>
      <div class="cta-banner">
        <h2>Know your pattern? Now practise the talk.</h2>
        <p>Partner Practice plays your partner, so you can try a calmer way to say the hard thing before the real conversation.</p>
        <a href="${REG}" class="btn" data-umami-event="cta-quiz-banner">Try it free</a>
      </div>
    </section>
  </main>
<script>(function(){var b=document.querySelectorAll(".qz-chip"),c=document.querySelectorAll(".qz-pc");function set(k){var ok=false;b.forEach(function(x){var on=x.dataset.cat===k;x.classList.toggle("is-on",on);x.setAttribute("aria-pressed",on);if(on)ok=true});if(!ok)return set("all");c.forEach(function(x){x.hidden=!(k==="all"||x.dataset.cat===k)})}b.forEach(function(x){x.addEventListener("click",function(){set(x.dataset.cat);try{history.replaceState(null,"",x.dataset.cat==="all"?location.pathname:"#"+x.dataset.cat)}catch(e){}})});var h=location.hash.slice(1);if(h)set(h)})();</script>`,
    jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Free relationship quizzes", url: `${SITE}/quiz/`, hasPart: QUIZZES.map((q) => ({ "@type": "Quiz", name: q.kicker, url: `${SITE}/quiz/${q.slug}/` })) },
  }));
}

// ---------- each quiz: blog article layout ----------
for (const q of QUIZZES) {
  const data = { slug: q.slug, kicker: q.kicker, tint: q.tint, qs: q.qs, results: q.results, article: q.article, tool: q.tool, reg: REG };
  const others = QUIZZES.filter((o) => o.slug !== q.slug);
  const sameFirst = [...others.filter((o) => o.cat === q.cat), ...others.filter((o) => o.cat !== q.cat)].slice(0, 3);
  const types = q.results.map((r) => `<li><span>${esc(r.name)}</span></li>`).join("");
  write(`quiz/${q.slug}/index.html`, page({
    title: q.title, description: q.desc, path: `/quiz/${q.slug}/`, cls: "sp-blog qz-page qz-quizpage", head: HEAD, image: `${SITE}${img(q)}`,
    jsonld: { "@context": "https://schema.org", "@type": "Quiz", name: q.kicker, about: q.desc, educationalUse: "self-reflection", url: `${SITE}/quiz/${q.slug}/`, image: `${SITE}${img(q)}` },
    body: `  <main>
    <article class="article qz-article" style="--tint:${q.tint}">
      <div class="container article-layout">
        <div class="article-wrap article-main">
          <a href="/quiz/" class="article-back">← All quizzes</a>
          <div class="article-tags"><a class="post-tag" href="/quiz/#${q.cat}">${esc(catName(q.cat))}</a><span class="post-tag qz-tag-soft">${META}</span></div>
          <h1>${q.h}</h1>
          <p class="qz-lead">${esc(q.sub)}</p>
          <figure class="article-fig article-hero qz-hero"><img src="${img(q)}" alt="" width="1200" height="800" decoding="async" fetchpriority="high" /></figure>
          <div class="qz-box" id="quiz" data-quiz="${q.slug}" aria-live="polite">
            <noscript><p>Please turn on JavaScript to take the quiz.</p></noscript>
          </div>
          <p class="qz-note">${esc(q.note)}</p>
        </div>
        <aside class="article-aside">
          <nav class="toc qz-facts" aria-label="About this quiz">
            <p class="toc-title">Possible results</p>
            <ol>${types}</ol>
            <p class="qz-facts-k">7 questions · 2 minutes · free, no sign-up</p>
          </nav>
          <div class="ad-card">
            <div class="ad-body">
              <span class="ad-ic" aria-hidden="true"></span>
              <h3>${esc(q.tool[1])}</h3>
              <p>${esc(q.tool[2])}</p>
              <a href="${REG}" class="btn btn-gradient" data-umami-event="cta-quiz-sidebar">Try it free</a>
              <small>Free to start. No card needed.</small>
            </div>
          </div>
        </aside>
      </div>
    </article>
    <section class="blog-list more-posts">
      <div class="container">
        <div class="more-head"><h2>More quizzes</h2><a class="qz-all" href="/quiz/" data-umami-event="quiz-all">All quizzes ${arrow}</a></div>
        <div class="post-grid">${sameFirst.map((o) => card(o, "quiz-next")).join("\n")}</div>
      </div>
    </section>
  </main>
<script type="application/json" id="quiz-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script defer src="/js/quiz.js?v=6"></script>`,
  }));
}
// ---------- /links/: the page behind the link in bio ----------
// FEATURED = the quiz from the newest video. Change it when a new quiz video goes out.
const FEATURED = "attachment-style";
function latestPost() {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "blog-posts");
  const posts = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).map((f) => {
    const t = fs.readFileSync(path.join(dir, f), "utf8"); const fm = (t.match(/^---\n([\s\S]*?)\n---/) || [, ""])[1];
    const get = (k) => ((fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [, ""])[1] || "").trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
    return { file: f, date: get("date"), title: get("title"), draft: /^(true|yes)$/i.test(get("draft")), slug: get("slug") || f.slice(11, -3) };
  }).filter((p) => !p.draft && p.date && p.date <= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.date < b.date ? 1 : -1));
  return posts[0];
}
{
  const f = QUIZZES.find((q) => q.slug === FEATURED) || QUIZZES[0];
  const rest = QUIZZES.filter((q) => q !== f);
  const post = latestPost();
  const item = (href, ev, tint, k, h, p, big = false) => `<a class="lk-item${big ? " lk-big" : ""}" href="${href}" style="--tint:${tint}" data-umami-event="${ev}"><span class="lk-k">${k}</span><span class="lk-h">${h}</span>${p ? `<span class="lk-p">${p}</span>` : ""}<span class="lk-go">${arrow}</span></a>`;
  const body = `<div class="lk-wrap">
  <div class="lk-head"><img src="/logo-tile.svg" alt="" width="64" height="64" /><h1>Relationship<b>AI</b></h1><p>Free quizzes and calm help for the hard conversations.</p></div>
  ${item(`/quiz/${f.slug}/`, `links-featured-${f.slug}`, f.tint, "The quiz from our video", f.h, "7 questions · 2 minutes · get your full result", true)}
  <p class="lk-label">More quizzes</p>
  ${rest.map((q) => item(`/quiz/${q.slug}/`, `links-quiz-${q.slug}`, q.tint, esc(q.kicker), q.h, "")).join("\n  ")}
  <p class="lk-label">Try the coach</p>
  ${item(REG, "links-try-free", "#3b2218", "Free, no card needed", "Rehearse a hard conversation <em>before it's real</em>", "An AI plays your partner so you can practise what to say.")}
  ${post ? `<p class="lk-label">New on the blog</p>\n  ${item(`/blog/${post.slug}/`, "links-latest-article", "#f9cfae", "Latest article", esc(post.title), "")}` : ""}
  <p class="lk-foot"><a href="/" data-umami-event="links-home">relationshipaiadvice.com</a> · <a href="/quiz/" data-umami-event="links-all-quizzes">All quizzes</a> · <a href="/blog/" data-umami-event="links-blog">Blog</a></p>
</div>
<script>try{var s=new URLSearchParams(location.search).get("utm_source");if(s)sessionStorage.setItem("ra_src",s)}catch(e){}</script>`;
  write("links/index.html", page({ title: "RelationshipAI: free relationship quizzes", description: "The quiz from our video, more free relationship quizzes and the AI coach for hard conversations.", path: "/links/", cls: "lk-page", head: HEAD, noindex: true, body }));
}
console.log(`quiz: ${QUIZZES.length + 2} pages written`);
