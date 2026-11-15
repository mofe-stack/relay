# data

- **dist.pkl:** for each speaker with dysarthria, the dynamic time warping distance between every test recording and every saved recording. it has no audio in it.
- **whisper_test.csv:** whisper small's chosen phrase and scores for each test recording from speakers with dysarthria.
- **dist_clear.pkl** and **whisper_clear.csv:** the same two files for the 24 speakers without dysarthria (5,196 test recordings).
- **pairs1.pkl** and **pairs_clear.pkl:** the distance between every pair of recordings for each speaker, used for the keep learning test (with and without dysarthria).

all of them are made from the easycall dataset (turrisi et al. 2021, cc by-nc 2.0) and none of them have audio in them: [paper](https://arxiv.org/abs/2104.02542) and [hugging face](https://huggingface.co/datasets/changelinglab/easycall-dysarthria).
