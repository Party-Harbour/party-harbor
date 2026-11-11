# Party Harbor walkthrough

A tour of everything the app does, in the order you would use it for a real gathering. The running example is a cookie exchange, but nothing here is specific to cookies.

Two kinds of people use Party Harbor:

- **Hosts** sign in, plan events and see every guest list. A household usually has one or two.
- **Guests** never sign in. Each invited household gets one private link that shows the event and lets them reply.

## Contents

1. [Getting in](#1-getting-in)
2. [The dashboard](#2-the-dashboard)
3. [Contacts: households and people](#3-contacts-households-and-people)
4. [Creating an event](#4-creating-an-event)
5. [The event page and its stages](#5-the-event-page-and-its-stages)
6. [Guests and invitation links](#6-guests-and-invitation-links)
7. [What a guest sees](#7-what-a-guest-sees)
8. [Tasks](#8-tasks)
9. [Contributions: who brings what](#9-contributions-who-brings-what)
10. [The contest](#10-the-contest)
11. [Photos](#11-photos)
12. [Messages](#12-messages)
13. [Templates and next year](#13-templates-and-next-year)
14. [The digest](#14-the-digest)
15. [A worked timeline](#15-a-worked-timeline)
16. [Privacy and limits](#16-privacy-and-limits)

## 1. Getting in

**Signing up.** When sign-up is open, the sign-in page has a "Create your account" link. You enter your name, an email, a password of at least 10 characters, and the **sign-up code**. The code comes from whoever set up the site (the `HOST_SIGNUP_CODE` setting). It exists because every host can see every guest's details, so a public site must not let strangers make host accounts. Once everyone who should be a host has signed up, the person running the site can remove the code and sign-up closes again.

The email is only your sign-in name. Nothing is sent to it. There is no password reset yet, so keep the password somewhere safe.

**Signing in.** Email and password. After eight wrong passwords in fifteen minutes an account pauses for the rest of that window.

**On your own computer.** A fresh local copy starts with two sample host accounts and some sample events so there is something to click on. The sign-in page lists them.

## 2. The dashboard

The first page after signing in:

- A greeting and a one-line summary of what is coming up.
- Four tiles: upcoming events, people in contacts, confirmed RSVPs, and replies still awaited.
- A card per upcoming event with its date, place, invitation count, countdown, stage and open tasks.
- **My tasks**: the next open tasks across all events. Tick the box to mark one done.
- **Quick actions**: new event, add a household, today's digest, invite guests to the next event.
- **Planning progress** for the next event: tasks done and households confirmed.

The side menu (bottom bar on a phone) reaches Dashboard, Events, Contacts, Templates and Digest.

## 3. Contacts: households and people

Party Harbor invites **households**, not individuals. One invitation and one reply cover the whole family.

On the Contacts page:

1. **Add a household** with a name ("The Garcias") and optional notes.
2. **Add people** to it: a name, optionally a mobile number and email, and whether they are a child.
3. Set each adult's **messaging consent**: unknown, opted in, or opted out.

Consent matters. A phone number is not permission to text. The app only ever texts adults who have a number **and** are marked opted in. If someone replies STOP to a text, they are switched to opted out automatically, and START switches them back.

Contacts are reused across every event, so you enter people once.

## 4. Creating an event

Events → **New event**. Give it a title, a start time, and whatever else you know: end time, time zone, RSVP deadline, venue, description, "what to bring", a colour theme and an optional cover image link.

There are three ways to start:

- **From scratch.** Fill in the form.
- **From a template.** The Templates page has three built-in starters (Christmas Cookie Exchange, Carnival, Fall Bonfire) plus any you have saved. A template lays out tasks, sign-up slots, a contest and scheduled reminders against the date you pick.
- **By cloning a past event.** "Reuse this plan" on any event copies its set-up and suggests the same time a year later.

A new event starts as a **Draft**: guests cannot open their links yet.

## 5. The event page and its stages

Each event has tabs: Overview, Guests, Tasks, Contributions, Contest, Photos, Messages, and Edit.

The **Overview** shows the numbers at a glance (invited, attending with head count, awaiting reply, open tasks), the details, the next tasks, and the event's stage. Stages move in order:

| Stage            | What it means                                                      |
| ---------------- | ------------------------------------------------------------------ |
| Draft            | Still planning. Guest links show nothing yet.                      |
| Invitations open | Guests can open their links and reply.                             |
| RSVP closed      | Replies are closed; you have your numbers.                         |
| Underway         | The day itself.                                                    |
| Memories         | Afterwards: photos and results stay available.                     |
| Archived         | Out of the way. Hidden from the dashboard and the digest.          |

You move the stage yourself with the button on the Overview. Nothing changes stage automatically.

## 6. Guests and invitation links

The **Guests** tab is where households join an event.

1. Tick the households to invite and choose **Generate invitation links**. Each household gets its own long, unguessable link.
2. **Copy** a link to send it yourself (text, email, a card with a QR code), or use the Messages tab to text it.
3. The guest list shows each household's reply as it comes in.

Other things you can do here:

- **Record a reply** for a household that told you in person or by phone.
- **New link** replaces a household's link; the old one stops working.
- **Revoke link** turns a link off without replacing it.

Links are stored in a form that cannot be reversed for lookups, plus an encrypted copy so the app can show and re-send them to you.

## 7. What a guest sees

Opening the link shows a page in the event's theme: the title and date with a countdown, where and when, the description, and what to bring. No account, no app to install. On that page a household can:

- **Reply**: attending, maybe, or can't make it, with the number of adults and children and an optional note. They can change the reply until the RSVP deadline passes or you move the event to *RSVP closed*.
- **Sign up to bring something**: pick an open slot ("Hot cocoa") or write in their own ("I'll bring…").
- **Enter the contest**, if there is one: name their entry, add dietary tags and a description, and attach a photo.
- **Vote** once voting is open: one vote per household in each category.
- **See and add photos**, depending on the gallery setting you chose.

Each household only ever sees its own reply and its own entries, plus whatever you have chosen to share with everyone.

## 8. Tasks

The **Tasks** tab is the hosts' to-do list for the event. Each task has a title, optional notes, a due date, a priority and an assignee (one of the hosts). Tasks are open, in progress or done.

Overdue tasks are flagged on the event, on the dashboard and in the digest. Tasks created from a template arrive with due dates worked out from the event date.

## 9. Contributions: who brings what

The **Contributions** tab defines the sign-up slots guests see: a category ("Drinks"), a title ("Mulled cider"), an optional note and a **capacity** (how many households can take it; leave it empty for no limit).

As guests claim slots you see who is bringing what and which slots are still open. Free-form offers ("I'll bring folding chairs") appear in the same list. Unfilled slots show up in the digest as the day approaches.

## 10. The contest

Optional, one per event: a cookie contest, a chili cook-off, best costume. On the **Contest** tab:

1. **Set it up**: a title, what guests enter (the word used in guest wording, such as "cookie"), and the **categories** people vote in ("Best Overall", "Most Creative").
2. **Choose the rules**:
   - *Who can vote*: every invited household, or only households attending.
   - *Self-voting*: whether a household may vote for its own entry.
   - *Show who entered each one*: on, or keep entrants private until the reveal.
3. **Collect entries.** Guests enter from their link; you can also add entries yourself. You can hide an entry from the ballot.
4. **Freeze ballot** when entries are final. Nothing can be added or changed after that.
5. **Open voting.** Guests vote from their link, one vote per household per category. You watch a **live tally**.
6. **Close voting**, then **Reveal results**. Ties share the place. Guests see the results on their page once revealed.

Each step can be undone with an override button (reopen entries, reopen voting, hide results again), and every change of state is recorded in the audit log.

## 11. Photos

Each event has a gallery on the **Photos** tab.

- **Add photos** up to twelve at a time. Large phone photos are shrunk before upload, then the app rotates them upright, resizes them, strips location and camera data, and keeps a thumbnail. The original file is never stored.
- **Guest access** has three settings: hidden, view only, or view and add.
- **Approval**: choose whether guest photos appear straight away or wait as *pending* until a host approves them.
- For each photo you can hide it, delete it, download it, or use it as the event's **cover**.
- A storage meter shows how many photos the event holds against its limit.

Photos are private. Every image is served only to a signed-in host or to a guest with a valid link for that event. The one exception is the cover photo, which appears on the invitation page.

## 12. Messages

The **Messages** tab sends text messages to an event's households.

1. **Pick who gets it** (the segment): everyone invited; those who haven't replied; those attending; or everyone except those who declined.
2. **Write it**, or start from a built-in message: invitation link, RSVP reminder, logistics, voting is open, thank you. Placeholders are filled in per person:

   | Placeholder      | Becomes                                   |
   | ---------------- | ----------------------------------------- |
   | `{{first_name}}` | The recipient's first name                |
   | `{{household}}`  | The household name                        |
   | `{{event}}`      | The event title                           |
   | `{{date}}`       | The event date                            |
   | `{{time}}`       | The start time                            |
   | `{{venue}}`      | The venue name                            |
   | `{{link}}`       | That household's private invitation link  |
   | `{{host}}`       | Your name                                 |

3. **Choose when**: now, at a set date and time, or relative to the event (seven days before, the day after). Relative reminders move if you change the event date.

Before sending, the page shows who **will get it** and who will be **skipped** and why (no number, no consent, opted out, a child).

Things the app does for you:

- **Quiet hours.** Nothing goes out between 9 pm and 8 am in the event's time zone; it waits until morning.
- **Late invitations.** A household invited after a reminder was scheduled is added to it automatically.
- **Retries.** A text that fails is retried a few times; one that keeps failing is listed so you can retry it or reach the person another way.
- **A delivery log** for every message.

Until a text provider is connected (Twilio is supported), messages are written to the server log instead of being sent. That makes it safe to try everything out first.

## 13. Templates and next year

On any event's Overview, **Reuse this plan** offers two things:

- **Save as template**: keeps the settings, sign-up slots, tasks, contest set-up and relative reminders under a name you choose.
- **Clone**: starts a new event from this one, suggesting the same date and time a year on.

A template never carries people: no guests, replies, claims, entries, votes or photos. The Templates page lists your saved templates and the built-in starters, each with a summary of what it contains.

## 14. The digest

The **Digest** is a summary for hosts so nobody has to go looking. For each live event it shows the reply count and head count, households yet to reply, open and overdue tasks, unfilled slots, the state of the contest, new photos, and texts going out in the next day. It also lists what changed since the last digest and anything that needs attention: overdue tasks, an RSVP deadline that passed with replies outstanding, texts that could not be delivered, photos or entries awaiting approval, a draft that is getting close to its date.

Each host sets their own schedule on the Digest page: daily or weekly, the hour, the day of the week, and their time zone. Add your mobile number to get it as a text; without one it simply appears in the app. **Send me a digest** makes one on the spot. Earlier digests stay in a history list.

## 15. A worked timeline

Planning a cookie exchange for mid-December:

| When             | What you do                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Six weeks out    | Add households to Contacts. Create the event from the Christmas Cookie Exchange template.     |
| Five weeks out   | Review the Tasks, Contributions and Contest tabs. Adjust categories and slots.                |
| Four weeks out   | On Guests, generate links. Move the stage to *Invitations open*. Send the invitation message. |
| One week out     | The scheduled RSVP reminder goes to households that haven't replied.                          |
| Two days out     | The logistics reminder goes out. Move the stage to *RSVP closed*. Check unfilled slots.       |
| The day          | Stage *Underway*. Freeze the ballot, open voting, watch the tally, close, reveal.             |
| The day after    | The thank-you message goes out. Stage *Memories*. Approve any pending photos.                 |
| A few weeks on   | Save the event as a template, then archive it.                                                |

## 16. Privacy and limits

- Guests see only their own household's information and what hosts choose to share.
- Invitation links are the only thing a guest needs. Treat a link like a house key: anyone holding it can reply for that household. Replace or revoke a link if it goes astray.
- Texts go only to adults who have opted in, never during quiet hours.
- Photos have location data removed and are never public, apart from a chosen cover photo.
- Every significant action (invitations, replies recorded by hosts, contest state changes, messages, sign-ups) is written to an audit log.

Not built yet: email and WhatsApp messages, downloading a whole gallery as one file, voting by text reply, different permission levels for co-hosts, and password reset.
