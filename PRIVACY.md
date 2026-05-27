# Privacy Policy — AI Guard

_Last updated: May 27, 2026_

## What AI Guard does

AI Guard is a Reddit moderation app that lets subreddit moderators build automated content-review workflows powered by a large language model (LLM) of their choice.

## Data collected and processed

| Data | How it is used |
|---|---|
| Post and comment text | Sent to the LLM API you configure to evaluate whether content violates your moderation rules. |
| Reddit usernames | Stored in the subreddit's Redis instance to power the strike-tracking system. Reset at any time by a moderator. |
| Moderation decisions | Stored in the subreddit's Redis instance as a 30-day audit log visible only to moderators. |
| Your LLM API key | Stored as a Devvit app setting, scoped to your subreddit. Never logged or transmitted outside of requests to the API endpoint you configure. |

## Data sharing

- Content is sent to the LLM provider you configure (e.g. OpenAI, Google Gemini). You are responsible for reviewing that provider's privacy policy.
- No data is shared with any other third party.
- No data is stored outside of Reddit's Devvit platform (Redis and app settings).

## Data retention

- Audit log entries are automatically deleted after 30 days.
- Strike counts are stored indefinitely until a moderator manually resets them.

## Moderator control

All data is scoped to your subreddit. Moderators can delete strike labels and individual user records at any time from the Strikes panel.

## Contact

For questions or concerns, open an issue at [github.com/TheGreatRay/rz-mod](https://github.com/TheGreatRay/rz-mod).
