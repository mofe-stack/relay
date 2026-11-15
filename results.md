# relay: full results

more results for the [readme](readme.md). unless it says otherwise, numbers are on the same 5,149 test recordings from the 27 speakers with dysarthria, with the gate tested on speakers it never learned from.

## by severity

| | spoke and right | false alarms | missed cases |
|---|---|---|---|
| mild (16) | 74.1% | 4.1% | 9.0% |
| moderate (6) | 50.2% | 6.2% | 14.6% |
| severe (5) | 25.4% | 7.1% | 16.0% |

## speakers without dysarthria

we also tested the 24 speakers without dysarthria on their 5,196 later recordings. the gate was only trained on speakers with dysarthria, so these are speakers it never learned from.

| | spoke | spoke and right | spoke and wrong |
|---|---|---|---|
| whisper small | 100% | 83.2% | 16.8% |
| relay (no gate) | 100% | 90.2% | 9.8% |
| relay with the gate | 93.1% | 88.3% | 4.8% |

## men vs women (no gate)

| | men | women |
|---|---|---|
| whisper small | 55.1% | 46.7% |
| relay | 69.9% | 77.5% |

all 5 severe speakers are men, which pulls the men's numbers down. among mild speakers only, whisper gets 71.7% right for men and 46.2% for women, a gap of 25.5 points. relay gets 87.9% and 76.6%, a gap of 11.3 points. both do worse on women here, but relay's gap is less than half of whisper's. easycall doesn't include speakers' ages, so we couldn't check results by age.

## words the user never saved

sometimes a user will say a word they never saved. relay can't get these right, so the best it can do is not speak and show three words instead. to test this we hid 13 of the 67 phrases for each speaker so they counted as never saved. then we checked how often relay spoke anyway when someone said one of those hidden phrases. the gate described in the readme speaks on 33.3% of them because it only learned from saved words and never saw this case. when the gate also practices on hidden words during training, that drops to 16.9%.

## keep learning

each speaker started with one saved recording of each phrase. relay then made a prediction on each new recording of those same phrases. after each prediction, the new recording was saved under the right word, as if the user corrected relay whenever it was wrong. relay's predictions got more accurate with each recording session:

| session 2 | session 3 | session 4 | session 5 | session 6 |
|---|---|---|---|---|
| 50.3% | 63.6% | 68.2% | 74.4% | 78.4% |

with no learning it stayed around 54%. if relay only saved a recording when the right word was already in its top three (spoken or shown for the user to pick), it reached 61.6% by session 6. when the right word wasn't in the top three, nothing was saved, so the words it kept getting wrong never got better.

## whisper's gate

for whisper the gate uses whisper's own scores in place of relay's first two clues (how likely whisper thought its chosen phrase was right and how much more likely it was than the next phrase). whisper has no saved recordings so it has no version of the third clue (whether the three saved recordings agree). it uses the same fourth and fifth clues (how long and how loud the recording is).

## other gate models

we also tried boosted trees and a small neural network in place of the logistic regression on the 27 speakers with dysarthria with the same setup.

| gate model | spoke and right | false alarms | auroc |
|---|---|---|---|
| logistic regression (relay) | 61.1% | 5.0% | 0.904 |
| boosted trees | 57.6% | 4.3% | 0.895 |
| small neural network | 60.9% | 5.6% | 0.896 |

neither model did better so the limit seems to be the sound itself and not the gate model.

**this project is a prototype and is not medical advice.**
