It's just a prefix naming who said what: дима: я четыре часа дебажил. Nothing fancier than that.

And it's not that it's better than raw user/assistant messages — it's that in a group chat you don't have the option. The API gives you two roles. Your chat has six people. Put three different people's messages in raw user turns and the model sees one undifferentiated voice, so it can't tell that Katya contradicted Sanya, can't tell which of them it's currently talking to, and can't resolve "он опять сломался" to anyone. The label is how you encode a speaker dimension that the role system doesn't have.

Which means for a 1-on-1 assistant, raw is correct and labels are pure overhead. Your case is the exception, not the default.

The thing I was actually flagging: whatever format your live transcript renders — дима: текст, [дима] текст, <дима> текст — the few-shot examples have to use the identical one. If the examples are bare and the live transcript is labeled, the model hits a format change at exactly the generation point, and it starts treating the labeled block as a different kind of content than the thing it was shown how to imitate. You lose a chunk of the conditioning for no reason.

Two consequences worth handling:

Pick a delimiter that doesn't appear in normal messages. Bare имя: is fine until someone writes короче: не работает. <дима> or [дима] is safer.

Set the stop sequence to your label pattern. Once the model sees labeled turns it will occasionally keep going and write the next person's message. Your own output should never carry a label — only incoming transcript lines do.

The question is what goes into the context for one session, and there are two answers:

A. Only Sanya's messages and your replies to Sanya. Clean 1-on-1, no labels needed.
B. The full channel transcript, labeled, with an instruction that only Sanya gets answered.

I've been arguing for B, and I never made the case explicitly, so that's on me.

The reason is that the messages surrounding Sanya's are not noise — they're what makes Sanya's message mean anything. Sanya writes "он опять сломался" and the referent is in Dima's message thirty seconds earlier. Sanya writes "лол +1" and it's reacting to Katya. Sanya writes "ну вот видишь" and the thing to see is someone else's. Under A the bot answers "кто он" to a message the whole chat understood, which reads as broken in a way the persona work can't fix.

Also: five parallel sessions means five bots that can't see each other's replies, so they'll repeat the same joke back to different people in the same visible channel. Under B each one sees what the others already said.

So it's isolated in who it answers, not in what it sees — which matches how a person in that chat actually works. You read everything, you reply to one thread.

Two things that make B cheap:

The transcript is the same for every session, so it caches once and all five calls hit it. Under A each session has its own filtered context and nothing shares.
Only the trailing instruction differs: отвечаешь только сане, остальные это фон, к ним не обращайся.