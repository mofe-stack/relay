# data

**distance** means one number for how different two recordings sound, from dynamic time warping. a smaller distance means they sound more alike.

- **dist.pkl:** for each speaker with dysarthria, the dynamic time warping distance between every test recording and every saved recording. it has no audio in it.
- **whisper_test.csv:** whisper small's chosen phrase and scores (how likely whisper thought its chosen phrase was and how much more likely it was than the next phrase) for each test recording from speakers with dysarthria.
- **dist_clear.pkl** and **whisper_clear.csv:** the same two files for the 24 speakers without dysarthria (5,196 test recordings).
- **pairs1.pkl** (with dysarthria) and **pairs_clear.pkl** (without): the distance between each recording and the earlier recordings by the same speaker. in the keep learning test, each new recording is compared to the earlier ones that were saved, then gets saved itself.

all of them are made from the easycall dataset (turrisi et al. 2021, cc by-nc 2.0) and none of them have audio in them: [paper](https://arxiv.org/abs/2104.02542) and [hugging face](https://huggingface.co/datasets/changelinglab/easycall-dysarthria).
