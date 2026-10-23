# Ownership: the next 30 days of invites

## Where we are, four weeks in

Invites have been on for 90% of activities for a month. The first goal is met: 33% of bookers sent at least one invite within a week, against a 30% target. The second isn't: 11.4% of opened invites ended in a claim, against 25% per rail, so that trigger has fired.

Where invites are on, they're doing their job. Those activities average 9.2 attendees against 6.0 in the holdout, fill to 79% against 61%, bring in 6.5 new users each against 3.6, and have groups of two or more where the holdout has none. So invites work. The problem is that most of them lead nowhere.

## What's going on

I went looking for where the other 88.6% goes. Six things, biggest first.

1. **Almost half of opens land on an activity that's already full.** 43% of opens (1,113 of 2,578) found no spots, and none of those could be claimed. Leave them out and vouches convert at 37.5% and public links at 13.9%. Vouches already beat the target whenever there's a spot.
2. **The spot is gone by the time the friend looks.** Same-day opens convert at 14.6%, and 23% of them find the activity full. One to two days later it's 11.5% and 52% full. Three days or more, 4.2% and 75% full. Vouches show the same pattern: 27% the same day, 13% three days later.
3. **The claim form isn't the leak.** Of people who opened an invite and found a spot, 85% of vouch openers and 87% of link openers started the form, and 86 to 90% of those finished it. Only 18 of 650 vouch opens were rejected for the wrong contact.
4. **Links bring volume, vouches bring quality.** 1,928 opens came through public links, converting at 7.8%. 650 came through vouches, converting at 22.3%. New users per booker end up close on both (0.064 for vouches, 0.071 for links), because one link reaches more people.
5. **Many invites go out when the activity is nearly full already.** 27% of vouches and 28% of links were sent with two spots or fewer left. Nothing on the invite side fixes those.
6. **Platform isn't it.** Mobile converts at 12.0% and web at 9.1%, and both hit full activities equally often (43% and 42%).

I also checked expiry. 224 claims were rejected as expired, but here that means the activity had already started, so it's the same delay problem as point 2.

## What I'd change, ranked by impact over effort

**1. Hold a spot when someone sends a vouch, until the activity starts.**
Vouches convert at 37.5% when there's a spot, so the full activities are the whole gap. Of the 263 vouch opens that hit a full activity, 193 had a spot when the vouch was sent. How long the hold lasts matters, because friends open one to three days later: a 24-hour hold would save only 33 of those opens, while holding until the start saves all 193.
*Effort:* medium. One new path through the booking module, an expiry job, and a cap so holds never take more than a third of an activity.
*Expected:* vouch claims from 22% to about 33% (29% with a 72-hour hold), and overall from 11.4% to about 14%. The cost: most holds will expire unclaimed, since 210 of 860 vouches are never opened, and while a hold sits there it can turn away someone booking directly.

**2. Nudge the inviter** when their invite is opened but not claimed, and when the activity is down to two spots.
Opens three or more days late hit a full activity 75% of the time. The inviter is the one person who can hurry their friend, and we already know the moment it matters.
*Effort:* small. The web already has a Nudge button.
*Expected:* more same-day opens. Nobody has been nudged yet, so this is a guess: if a seventh of late opens moved to the same day, that's about one point on the overall rate, and I'd treat that as the most it gives. Worth it because it's cheap and makes holds work better.

**3. Put the spots left in the share message** ("3 left").
It's the only thing the friend sees before they open.
*Effort:* small. *Expected:* faster opens. I can't size it without trying it.

**4. Make public links expire after 48 hours, renewable**, so a link in a group chat stops pointing at a full activity.
Link opens three or more days late convert at 1.5%, and 78% of them hit a full activity.
*Effort:* small. *Expected:* fewer dead ends. It lifts the link rate partly by cutting opens, so it only counts if we report opens that found a spot alongside it.

Not doing: redesigning the claim form, since point 3 says it works, or holding spots for public links, since anyone with the link could drain an activity.

## How I'd prove it

- The 10% holdout stays as it is. The main comparison is still attendees, fill rate and new users per activity, counting only activities that have started, compared within category. Comparing within host isn't possible yet: only 14 hosts have activities on both sides.
- Holds get their own split inside the activities that have invites: half with holds, half without, chosen by the same hash, for two weeks. I'd read claim rate per rail, the share of opens that find a full activity, and one cost measure: direct bookers turned away while a hold sat unclaimed on the same activity.
- No decision before the minimum sample sizes already built into `/admin`: 500 booking attempts, 200 bookers and 200 opens per rail.
- Booking rate per view looks worse where invites are on, but only because every invite open counts as a view. I'd take those out before reading it.

## What I'd decide

- Ship the nudge now. It's small, it can't disturb the holdout, and it goes straight at the delay.
- Build holds behind their own split and run them for two weeks. Keep them if vouch claims rise by at least eight points and fill rate doesn't drop. If fill drops, the holds are blocking real bookers: lower the cap or shorten the hold to 72 hours before giving up on them.
- Ship the spot count and link expiry together with the nudge. Neither needs its own test.
- Decide at the end of week six. If vouches pass 25% and links are still under 15%, make vouching the default and the link the second option. If neither moves, the problem comes before the invite: people are inviting friends to activities that are already nearly full, and the fix is to help hosts add another date.

## If the numbers were different

I can rerun the scenario with different numbers in a few seconds (the README shows how), so these aren't just guesses.

- **Claim rate at 18% instead of 11.4%.** The likeliest reason is that friends open sooner. Rerunning with every invite opened within a day gives 16.9%, and the share of opens that find a full activity drops from 43% to 33%. Holds would still help, but about half as much, so I'd run the nudge alone for two weeks before building them.
- **Vouches and links converting the same.** Rerunning that way gives 7.4% for vouches and 8.3% for links. Then trust isn't earning anything, and the vouch limit and contact check are friction with no payoff. Holds only pay off because vouches convert, so I'd drop them and lead with the nudge and link expiry.
