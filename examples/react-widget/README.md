# Rapida Widget Examples

The **Rapida Chat Widget** is a pre-built, embeddable voice + text AI agent that you can drop into any website with a single `<script>` tag. No build step required.

## How it works

The widget loads as a self-contained JS bundle. Before the script runs, set `window.chatbotConfig` with your credentials and options. The widget will render a floating chat button in the bottom-right corner of the page.

## Installation

Load the widget from the Rapida CDN:

```html
<script defer src="https://cdn-01.rapida.ai/public/scripts/app.min.js"></script>
```

## Configuration

```js
window.chatbotConfig = {
  assistant_id: "YOUR_ASSISTANT_ID",   // required
  token: "YOUR_API_KEY",               // required

  assistant_version: "latest",         // optional — pin to a specific version
  api_base: "https://...",             // optional — custom/self-hosted endpoint
  language: "en",                      // optional — BCP 47 language tag
  debug: false,                        // optional — verbose console logging

  user: {                              // optional — identify the current user
    name: "Jane Doe",
    user_id: "stable-user-id",
    meta: { plan: "pro" },
  },

  theme: {                             // optional — accent color
    color: "#2563eb",
  },
};
```

## CSS Customization

Override widget size and position with CSS custom properties:

```css
#RPDContainer.RPDContainer .RPD_Wrapper {
  --cds-chat-BASE-width: 400px;
  --cds-chat-BASE-height: 600px;
  --cds-chat-BASE-bottom-position: 20px;
  --cds-chat-BASE-right-position: 20px;
  --cds-chat-BASE-border-radius-large: 10px;
}
```

## Examples

| **Use Case**           | **File**                      | **Description**                                      |
|------------------------|-------------------------------|------------------------------------------------------|
| Basic HTML embed       | `basic-embed.html`            | Minimal embed — assistant ID + token only            |
| Advanced HTML embed    | `advanced-embed.html`         | Full config: user identity, theme, CSS overrides     |
| React app integration  | `react-integration.tsx`       | `<RapidaWidget>` component for existing React apps   |
| Local development      | `local-dev.html`              | Loads from local build with debug mode enabled       |

## Local Development

To build the widget and run the local example:

```bash
# 1. Install dependencies and build the widget
cd sdks/react-widget
yarn install
yarn build
# Output: sdks/react-widget/dist/app.min.js

# 2. Serve the examples directory (file:// protocol won't work)
cd examples/react-widget
python3 -m http.server 8000

# 3. Open in browser
open http://localhost:8000/local-dev.html
```

The `local-dev.html` file loads the widget from the local build path
(`../../sdks/react-widget/dist/app.min.js`) and enables `debug: true` so
you can see verbose logs in the browser console.

## Getting Your Credentials

1. Sign in to the [Rapida Console](https://app.rapida.ai)
2. Create or open a project → copy your **API Key**
3. Open the **Assistants** section → copy your **Assistant ID**

## Contact

Questions? Reach out to **prashant@rapida.ai** or open an issue on GitHub.
