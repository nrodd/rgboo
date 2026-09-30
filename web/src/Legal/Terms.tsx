import { Link } from "react-router-dom";
import { LegalPage } from "./LegalPage";
import { Contact } from "./contact";

export default function Terms() {
  return <LegalPage
    title="Terms of service"
    intro="These terms govern your use of the RGBoo website and color-request service, operated by Nathan Rodd. By using the service, you agree to these terms."
    sections={[
      { title: "Using RGBoo", content: <>
        <p>RGBoo lets you request a color for a physical light display through the website or supported livestream chat. Requests are queued and may be shown with your username on the stream, in overlays, or in chat acknowledgements.</p>
        <p>Only submit usernames and messages you are entitled to use. Follow the rules of the chat platform and channel, and meet the platform’s applicable age requirements.</p>
      </> },
      { title: "Respectful participation", content: <>
        <p>Do not use RGBoo to harass others, impersonate someone, expose private information, submit unlawful or abusive content, spam the queue, bypass access controls, or disrupt the service.</p>
        <p>We may reject or cancel requests, redact displayed usernames, block abusive names, or suspend access to protect the service and its viewers.</p>
      </> },
      { title: "Availability and estimates", content: <>
        <p>RGBoo is a live project provided on an as-available basis. Queue positions and wait times are estimates, not promises. Requests may be delayed, dropped, reordered, or interrupted by moderation, platform limits, network failures, maintenance, or the stream ending.</p>
        <p>We do not guarantee continuous availability, delivery of a particular request, or an exact color appearance on your screen or the physical display. Nothing in these terms limits rights or responsibilities that cannot be limited under applicable law.</p>
      </> },
      { title: "Privacy and third-party services", content: <>
        <p>Our <Link to="/privacy">privacy policy</Link> explains how usernames, chat commands, request history, and operator authorization are handled.</p>
        <p>RGBoo uses YouTube API Services. By using the YouTube features, you also agree to the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>. Use of Twitch is subject to the <a href="https://www.twitch.tv/p/en/legal/terms-of-service/">Twitch Terms of Service</a>. RGBoo is an independent project and is not endorsed by YouTube, Google, or Twitch.</p>
      </> },
      { title: "Changes and contact", content: <>
        <p>We may change or discontinue features and update these terms. The current version and revision date will be available on this page. If you do not agree with updated terms, stop using the service.</p>
        <p>For questions about RGBoo or these terms, <Contact />.</p>
      </> },
    ]}
  />;
}
