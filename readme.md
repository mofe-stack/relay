# relay: confidence-gated word matching for dysarthric speech

**track:** ai + health

**team:** mofe atanda & bharath erusalagandi

## the problem

an estimated 97 million people worldwide can't rely on speech alone to be understood. dysarthria is one cause, and it affects about half of the 15 million people who have a stroke each year and most people with parkinson's disease. people with dysarthria know what they want to say, but their speech is hard to understand. we tested whisper, openai's widely used open-source speech-to-text model, on recordings of people with dysarthria, and it got the right phrase 52% of the time, and 21% for people with severe dysarthria. additionally, a model that says the wrong word for someone who can't correct it out loud is worse than one that stays quiet, and speech-to-text models like whisper speak every time.

## what we built

relay listens to someone with dysarthria and says the word they meant out loud in a clear voice, or stays quiet when it isn't sure.

**who it's for:** we built it for people who have difficulty speaking clearly because of conditions like als, a stroke or cerebral palsy. they can make sound, but the people around them often can't understand what they're saying.

**when they'd use it:** when they want to ask a caregiver or nurse for something, like water, and can't get the word across.

**how they use it:**
- **set up:** the user adds the words and phrases they want relay to recognize, including names and personal requests, and says each one three times. relay saves the recordings of each word.
- **use:** the user says a word. relay puts it next to each recording they saved, compares them from start to finish, and picks the closest match.
- **the confidence gate:** a small trained model then estimates how likely relay's prediction is to be right. if it is confident, relay says the word out loud in a clear voice. if it is less sure, it shows the top three closest saved words for the user to pick from. otherwise it stays silent.
- **learning from feedback:** relay learns each time the user confirms a word or corrects a wrong guess, so it gets better the more they use it.
- **caregiver view:**

## what we added

our own idea (not one of the suggested projects). relay builds on a 2023 apple paper that matched someone's speech to their own saved recordings and stayed quiet when the closest match didn't pass a set cut-off. we added a confidence gate, which is a small trained model that looks at five clues to estimate how likely relay's prediction is to be right (e.g. how close the best match is and how loud the recording is).
