import { Link } from "react-router-dom";
import { LegalPage } from "./LegalPage";
import { Contact } from "./contact";

export default function Privacy() {
  return <LegalPage
    title="Privacy policy"
    intro="RGBoo is an interactive livestream project operated by Nathan Rodd. Viewers submit colors through this website or livestream chat to change a physical light display. This policy covers the RGBoo website and stream aggregator."
    sections={[
      { title: "Information we process", content: <>
        <p>Website requests include the username you enter and your selected color. For connected YouTube and Twitch chats, the aggregator receives public chat messages, display names, and platform message identifiers to recognize color commands and avoid duplicate requests. Twitch user logins are used to address replies.</p>
        <p>Accepted commands become records containing a username, color, request identifier, timestamps, scheduling information, and processing status. Request records and operational logs can contain usernames. Messages that are not recognized as color commands are not added to the color-request database.</p>
      </> },
      { title: "How information is used and displayed", content: <>
        <p>We use this information to queue and deliver colors, display the current requester, send estimated-wait replies in the originating chat, moderate abuse, troubleshoot failures, and calculate color-request statistics.</p>
        <p>Your username and color may appear publicly on the livestream, overlays, connected players, and chat replies. Other viewers and platform recordings may preserve that information. Do not include private information in your username or color commands.</p>
      </> },
      { title: "YouTube authorization and account access", content: <>
        <p>RGBoo uses YouTube API Services. The stream operator authorizes a YouTube channel so the aggregator can post color-request acknowledgements as that channel. Viewers do not need to grant RGBoo access to their Google accounts to submit a public chat command.</p>
        <p>OAuth client credentials and refresh tokens are stored in the operator’s server configuration; access tokens are used by the server to make authorized requests. They are not intentionally exposed in the website or chat. RGBoo uses the authorization to post chat replies, not to manage videos or access unrelated Google services.</p>
        <p>Our use of Google API data follows the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including its Limited Use requirements. We do not sell Google user data or use it for advertising.</p>
      </> },
      { title: "Hosting, platforms, and embedded content", content: <>
        <p>Cloudflare serves the website, and Google Cloud services process and store color requests. YouTube and Twitch receive messages posted through their APIs. These providers process information needed to deliver their services, which can include IP addresses, browser details, request logs, and cookies.</p>
        <p>The website embeds a YouTube player and loads Google Fonts. Those services can receive connection and usage information when you visit. Their data practices are described in the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>, <a href="https://www.twitch.tv/p/en/legal/privacy-notice/">Twitch Privacy Notice</a>, and <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare Privacy Policy</a>.</p>
      </> },
      { title: "Storage and retention", content: <>
        <p>Color-request records are stored in Google Cloud Firestore. Recent chat message identifiers used for duplicate detection are held in memory and cleared when the aggregator restarts. Operator credentials remain in server configuration until replaced or removed.</p>
        <p>The current service does not automatically delete request history on a fixed schedule. Records and logs may remain until manually removed or expired under the hosting provider’s settings. Contact us to request deletion of information associated with your requests.</p>
      </> },
      { title: "Your choices and deletion requests", content: <>
        <p>You can stop sending requests at any time. An operator can revoke Google authorization through <a href="https://myaccount.google.com/permissions">Google account permissions</a>; this prevents future authorized access but does not automatically erase stored request records.</p>
        <p>For access or deletion requests, <Contact />. Include the platform, username, and approximate request date so we can locate the records. Do not send passwords or tokens. We may ask for enough information to confirm the request concerns your data. Removing RGBoo records does not remove messages or recordings held by YouTube, Twitch, or other viewers.</p>
      </> },
      { title: "Contact and changes", content: <>
        <p>For privacy questions, <Contact />. Updates to this policy will appear here with a revised date. See also our <Link to="/terms">terms of service</Link>.</p>
      </> },
    ]}
  />;
}
