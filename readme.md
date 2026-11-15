# relay: confidence-gated word recognition for dysarthric speech

**track:** ai + health

**team:** mofe atanda & bharath erusalagandi

## the problem

an estimated 97 million people worldwide can't rely on speech alone to be understood. dysarthria is one cause, and it affects about half of the 15 million people who have a stroke each year and most people with parkinson's disease. people with dysarthria know what they want to say, but their speech is hard to understand. we tested whisper, openai's widely used open-source speech-to-text model, on recordings of people with dysarthria, and it got the right phrase 52% of the time, and 21% for people with severe dysarthria. additionally, a model that says the wrong word for someone who can't correct it out loud is worse than one that stays quiet, and speech-to-text models like whisper speak every time.

## what we built

**who it's for:** we built relay for people who have difficulty speaking clearly because of conditions like als, a stroke or cerebral palsy. they can make sound, but the people around them often can't understand what they're saying.

**when they'd use it:** when they want to ask a caregiver or nurse for something, like water, and can't get the word across.

**how they use it:**
- **set up:** the user adds the words and phrases they want relay to recognize, including names and personal requests, and says each one three times. relay saves the recordings of each word.
- **use:** the user says a word. relay compares it from start to finish with each recording they saved and picks the closest one.
- **the confidence gate:** a small trained model then estimates how likely relay's prediction is to be right. if it is confident, relay says the word out loud in a clear voice. if it is less sure, it shows the top three closest saved words for the user to pick from. otherwise it stays silent.
- **learning from feedback:** relay learns each time the user confirms a word or corrects a wrong guess, so it gets better the more they use it.
- **caregiver view:**

## what we added

our own idea (not one of the suggested projects). relay builds on a 2023 apple paper that matched speech to a person's own saved recordings and chose between saying a phrase or nothing based only on how close the best match was. relay's confidence gate is a small trained model that looks at five clues to estimate how likely relay's prediction is to be right (e.g. how close the best match is and how loud the recording is).

## how it works

**data:** we used easycall, a public dataset of italian speakers saying 67 short commands for using a phone like "chiama emergenza" (call emergency). we removed 36 of its 21,386 recordings because they were too short to contain a full word (under 0.2 seconds) or longer than whisper can take in at once (over 30 seconds). we also fixed phrases that were spelled two different ways, so the same phrase wasn't counted as two. we tested on 27 speakers with dysarthria (16 mild, 6 moderate and 5 severe) and 24 speakers without it.

**saved and test recordings:** each speaker's first three recordings of each phrase are their saved recordings. relay and the baselines are tested on the 5,149 later recordings from speakers with dysarthria, never on a saved one.

**how relay recognizes words:** for each test recording, relay works out which of the 67 phrases was said, the same choice whisper makes in the baseline. it uses whisper small, openai's speech-to-text model, without retraining it. relay uses its listening half to turn each recording into numbers, trims the silence, then compares the new recording to each saved one from start to finish (dynamic time warping). it chooses the phrase whose saved recordings are closest. this step works like a plug-in tool. it can sit on top of other speech models and requires no extra training.

**the confidence gate:** a logistic regression, which is a small model that gives a chance from 0 to 1 and works well with little data. it uses five clues: how close the best match is, how far behind the next closest word is, whether the three saved recordings agree, how long the recording is and how loud it is. relay speaks only when the chance is high enough that it says a wrong word on about 5% of tries. we trained and set this on some speakers and tested on others, rotating through five groups, so the gate is never tested on someone it learned from.

**baselines:**
- **whisper small:** the same model relay uses, but with both its listening and writing halves. it chooses from the same 67 phrases as relay by scoring how likely each phrase is and choosing the most likely one. it never sees the saved recordings, because normal speech-to-text doesn't learn how one person speaks.
- **simplest guess:** always says the most common phrase.
