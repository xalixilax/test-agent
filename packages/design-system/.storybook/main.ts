import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  "stories": [
    { titlePrefix: "Design System", directory: "../ui" },
    { titlePrefix: "Bookmark Manager", directory: "../../../clients/bookmark-manager/src" },
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs"
  ],
  "framework": "@storybook/react-vite"
};
export default config;