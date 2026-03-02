/**
 * Rapida Widget — React Integration
 *
 * Shows how to load the Rapida chat widget inside an existing React application.
 * The widget is framework-agnostic (plain JS bundle), so we inject the
 * <script> tag and window.chatbotConfig programmatically via a useEffect hook.
 *
 * Usage:
 *   <RapidaWidget
 *     assistantId="YOUR_ASSISTANT_ID"
 *     token="YOUR_API_KEY"
 *     user={{ name: "Jane", user_id: "user-123" }}
 *     theme={{ color: "#2563eb" }}
 *   />
 */

import { useEffect } from "react";

interface RapidaWidgetProps {
  /** Assistant ID from the Rapida console (required) */
  assistantId: string;
  /** Project API key / SDK credential (required) */
  token: string;
  /** Pin to a specific published version. Defaults to "latest". */
  assistantVersion?: string;
  /** Override the Rapida API base URL (for self-hosted deployments) */
  apiBase?: string;
  /** Identify the current user for conversation tracking */
  user?: {
    name: string;
    user_id?: string;
    meta?: Record<string, string>;
  };
  /** BCP 47 language tag. Defaults to the page's <html lang>. */
  language?: string;
  /** Accent color for the widget launcher and header */
  theme?: { color?: string };
  /** Enable verbose console logging */
  debug?: boolean;
}

const WIDGET_CDN = "https://cdn-01.rapida.ai/public/scripts/app.min.js";
const SCRIPT_ID = "rapida-widget-script";

export function RapidaWidget({
  assistantId,
  token,
  assistantVersion,
  apiBase,
  user,
  language,
  theme,
  debug = false,
}: RapidaWidgetProps) {
  useEffect(() => {
    // Set the config before the script executes
    window.chatbotConfig = {
      assistant_id: assistantId,
      token,
      ...(assistantVersion && { assistant_version: assistantVersion }),
      ...(apiBase && { api_base: apiBase }),
      ...(user && { user }),
      ...(language && { language }),
      ...(theme && { theme }),
      debug,
    };

    // Inject the widget script only once
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = WIDGET_CDN;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Cleanup: remove the injected DOM node that the widget creates
    return () => {
      const container = document.getElementById("rapida-chat-app");
      container?.remove();
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [assistantId, token]);

  // The widget renders its own DOM outside of React's tree
  return null;
}

// ---------------------------------------------------------------------------
// Example usage inside your app
// ---------------------------------------------------------------------------

export function App() {
  return (
    <>
      <h1>My App</h1>

      <RapidaWidget
        assistantId="YOUR_ASSISTANT_ID"
        token={process.env.REACT_APP_RAPIDA_API_KEY!}
        user={{
          name: "Jane Doe",
          user_id: "user-123",
          meta: { plan: "pro" },
        }}
        theme={{ color: "#2563eb" }}
        language="en"
      />
    </>
  );
}
