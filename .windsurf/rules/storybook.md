---
trigger: always_on
---

This is guidance for generation and maintenance of StoryBook stories.

Lots of data tables are generated for StoryBook tests.  Do not create them as template text in the story.  Generate them as suitably named `.html` files in the `stories` sub-folder.

This make it easier to understand and maintain them.

We will be using Storybook V9 interaction tests, as documented here: https://storybook.js.org/docs/writing-tests/interaction-testing