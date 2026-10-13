import type { User } from "../lib/types";
import { markdownDocument } from "../lib/server-import";
export const SEED_USERS: User[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alice Morgan",
    email: "alice@folio.demo",
    color: "#d9e5dd",
    initials: "AM",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Ben Carter",
    email: "ben@folio.demo",
    color: "#e7ddf1",
    initials: "BC",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Clara Park",
    email: "clara@folio.demo",
    color: "#f3ddcf",
    initials: "CP",
  },
];
const examples = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    owner: 0,
    title: "A little space for big ideas",
    shares: [
      { index: 1, role: "editor" as const },
      { index: 2, role: "viewer" as const },
    ],
    body: `# A little space for big ideas

Welcome to **Folio**, your team's quiet corner for getting thoughts onto the page.

A good document starts with a thought. It becomes useful when someone else can build on it.

## Make yourself at home

- Write something worth sharing. The editor supports headings, lists, and the small details that make an idea clear.
- Invite a teammate. Give them editing access or a place to read along.
- Bring your notes. Import a Markdown or plain-text file to pick up where you left off.

> The first draft is just a place to begin.

## A few things to try

Ben can edit this document. Clara can read it. Use the account switcher to see how their permissions work.

Your changes save automatically. If someone saves a newer version while you're typing, Folio asks you to review it before replacing anything.

**Now, what are you thinking about?**`,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    owner: 0,
    title: "Brand direction · autumn 2026",
    shares: [{ index: 2, role: "editor" as const }],
    body: `# Brand direction

## The feeling we're after

Warm, thoughtful, and easy to use. A workspace should help people focus on what they want to say.

## Principles

1. Give words room to breathe.
2. Make the next action obvious.
3. Let the work speak for itself.

## Palette notes

Soft paper, charcoal ink, and a green that feels like a well-used notebook. Keep contrast high and decoration simple.

**Next step:** Bring two directions to Thursday's review.`,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    owner: 0,
    title: "Monday thoughts",
    shares: [],
    body: `# Monday thoughts

A few things I'm carrying into this week.

- Finish the first working draft before worrying about the last ten percent.
- Leave time for an actual conversation with the team.
- Keep a list of the questions we haven't answered yet.

## One question

What can we remove to make the most important work easier?`,
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    owner: 1,
    title: "Product launch checklist",
    shares: [
      { index: 0, role: "editor" as const },
      { index: 2, role: "viewer" as const },
    ],
    body: `# Product launch checklist

A shared checklist for the first public release.

## Before we share it

- Walk through the new-user experience from an empty workspace.
- Check editing and view-only access with separate accounts.
- Test imports from the notes people already use.
- Read every empty state and error message out loud.

## Release day

Share the release notes, keep an eye on feedback, and write down the rough edges we want to fix next.

> Ship something useful. Then pay attention.`,
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    owner: 2,
    title: "Notes from the customer table",
    shares: [{ index: 0, role: "viewer" as const }],
    body: `# Notes from the customer table

## What we heard

People want a simple place to write with their team. Most already have too many tabs open.

**The recurring request:** Make it easy to tell who can read and who can edit.

## Follow-up

- Try a short invitation flow with visible permission labels.
- Keep saving quiet unless something needs attention.
- Preserve the formatting of existing notes when importing.

These notes are shared with Alice for reading.`,
  },
];
export const SEED_DOCUMENTS = examples.map((example, index) => {
  const date = new Date(Date.now() - index * 86_400_000);
  return {
    _id: example.id,
    title: example.title,
    ownerId: SEED_USERS[example.owner].id,
    content: markdownDocument(example.body),
    version: 1,
    createdAt: date,
    updatedAt: date,
    shares: example.shares.map((s) => ({
      userId: SEED_USERS[s.index].id,
      role: s.role,
      createdAt: date,
    })),
  };
});
