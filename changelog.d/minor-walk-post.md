### Added
- **A finished walk can be posted to the feed.** After Finish, a walk asks "Post it to your feed so the people who follow you can see it?" like a strength workout does, with a note and a **Share route** switch, and the post goes on in the background (Home shows how it is getting on, with a way to try again). A posted walk can be reposted from the workout's options, and walks are in "Your posts".
- **The walk's card:** the same card as a strength post, in green - the avatar ring, the glow, the type label and the note rule - with distance and time as the only big numbers, the route when it was shared (marked "Start and end hidden"), and a small row of pace, steps, steps a minute and steps a kilometre. Without a step counter the row is the pace alone, a walk with steps and no distance shows only the time, and nothing is ever a zero. Pace and steps/km are worked out when the card is drawn.
- **The route never shows where the walk started or ended.** The first and last 200 metres are cut away on the phone before the route leaves it - measured along the route and in a straight line, so a walk that passes the front door half way is cut there too - and what is left is simplified and rounded. A walk under 800 m shares no route. The exact positions never leave the phone.
- **Share route in the post settings:** the default of the switch (on, until you say no). A "Summary only" post never has a route.
- **No new table and no migration:** the post is a `social_post` row of type Walk with its numbers in the `payload`.

### Changed
- **A walk's numbers are on the phone that tracked it,** so a phone that does not have them (a new one, a reinstall) cannot post the walk - and never overwrites a post that is out with an empty one.
- **The privacy policy now says a posted walk contains its distance, time, steps and - if you share it - a trimmed route,** and its version is raised, so everybody is asked to accept it once more; `web/privacy/index.html` is rebuilt.
- The Play Console's Data safety form has to say that a route can now leave the phone, in a post.
- The app has no km/mi setting, so a walk post is in kilometres.
