import { createColorSender } from "./colorSubmission";
export const frogColor = { username: "Frog", color: { r: 0, g: 255, b: 0 } };

export function createFrogSender(onMessage: (message: string) => void) {
  const sender = createColorSender((result) => {
    // Hops during cooldown are silent. Feedback only follows a real submission.
    if (result.kind === "success") onMessage(result.position === undefined ? "Frog sent green!" : `Frog sent green! #${result.position} in the queue.`);
    if (result.kind === "error") onMessage("Frog couldn't send green. Try again in a moment.");
  });
  return { send: () => sender.send(frogColor), destroy: sender.destroy };
}
