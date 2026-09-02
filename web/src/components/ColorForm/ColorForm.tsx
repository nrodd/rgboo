import { ErrorMessage, Field, Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { ColorInput } from "./ColorInput";
import { colorFormSchema } from "./colorForm.schema";

const COOLDOWN_KEY = "rgboo_cooldown_end";
const COOLDOWN_SECONDS = import.meta.env.MODE === "test" ? 0 : 30;

export const ColorForm = () => {
  const [message, setMessage] = useState<{
    type: string;
    text: string;
    eta: number | null;
  }>({ type: "", text: "", eta: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [isOnCooldown, setIsOnCooldown] = useState(false);

  useEffect(() => {
    const savedCooldownEnd = localStorage.getItem(COOLDOWN_KEY);
    if (savedCooldownEnd) {
      const endTime = new Date(savedCooldownEnd);
      const now = new Date();
      const remainingTime = Math.max(
        0,
        Math.ceil((endTime.getTime() - now.getTime()) / 1000),
      );

      if (COOLDOWN_SECONDS === 0) {
        // Tests should not be blocked by cooldown; ensure key is removed
        localStorage.removeItem(COOLDOWN_KEY);
      } else if (remainingTime > 0) {
        setCooldownTime(remainingTime);
        setIsOnCooldown(true);
      } else {
        localStorage.removeItem(COOLDOWN_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (showPopup) {
      const timer = setTimeout(() => {
        setShowPopup(false);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [showPopup]);

  useEffect(() => {
    let interval: any;
    if (isOnCooldown && cooldownTime > 0) {
      interval = setInterval(() => {
        setCooldownTime((prev) => {
          if (prev <= 1) {
            setIsOnCooldown(false);
            localStorage.removeItem(COOLDOWN_KEY);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOnCooldown, cooldownTime]);

  const onSubmit = async (values: any, { setSubmitting }: any) => {
    setIsSubmitting(true);
    setMessage({ type: "", text: "", eta: null });

    try {
      // A relative URL goes through the Cloudflare Worker in production and
      // Vite's local authenticated proxy during `scripts/dev.sh`.
      const response = await fetch("/api/color", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const responseData = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: `Color submitted successfully! You are #${responseData.queue_position} in the queue.`,
          eta: responseData.estimated_wait_seconds,
        });
        setShowPopup(true);

        const cooldownEndTime = new Date(Date.now() + COOLDOWN_SECONDS * 1000);
        localStorage.setItem(COOLDOWN_KEY, cooldownEndTime.toISOString());
        setCooldownTime(COOLDOWN_SECONDS);
        setIsOnCooldown(COOLDOWN_SECONDS > 0);

        console.log("Color submitted successfully:", responseData);
      } else {
        if (
          response.status === 400 &&
          responseData.code === "PROFANITY_DETECTED"
        ) {
          setMessage({
            type: "error",
            text: "Username contains inappropriate language. Please choose a different username.",
            eta: null,
          });
          setShowPopup(true);
        } else {
          const errorMessage =
            responseData.error ||
            "Failed to submit color request. Please try again.";
          setMessage({ type: "error", text: errorMessage, eta: null });
          setShowPopup(true);
        }

        console.error("Failed to submit color:", response.status, responseData);
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "Unable to connect to server. Please check your connection and try again.",
        eta: null,
      });
      setShowPopup(true);
      console.error("Error submitting color:", error);
    } finally {
      setIsSubmitting(false);
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="color-form-container" className="px-6">
      <Formik
        initialValues={{
          username: "",
          color: {
            r: 114,
            g: 44,
            b: 199,
          },
        }}
        onSubmit={onSubmit}
        validationSchema={colorFormSchema}
      >
        <Form>
          <div className="flex flex-col space-y-8">
            <div className="flex flex-col space-y-4">
              <Field
                id="username"
                name="username"
                aria-label="username"
                placeholder="Name"
                className="text-sm sm:text-base form-field pl-4 py-2 placeholder-bone"
              />
              <ErrorMessage
                name="username"
                component="span"
                className="text-bone"
              />
              <ColorInput />
            </div>
            <button
              type="submit"
              className={`form-field form-button ${isOnCooldown ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={isSubmitting || isOnCooldown}
            >
              {isSubmitting
                ? "Sending..."
                : isOnCooldown
                  ? `Wait ${cooldownTime}s`
                  : "Send"}
            </button>
          </div>
        </Form>
      </Formik>

      {showPopup && message.text && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out transform ${
            showPopup
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0"
          }`}
        >
          <div
            className={`mx-4 mt-4 p-4 rounded-lg shadow-lg text-center ${
              message.type === "success"
                ? "bg-green-900/90 border border-pumpkin-400 text-bone backdrop-blur-sm"
                : "bg-red-900/90 border border-pumpkin-400 text-bone backdrop-blur-sm"
            }`}
          >
            <p className="font-medium">{message.text}</p>
            {message.type === "success" && message.eta !== null && (
              <p className="text-sm mt-2 opacity-90 text-bone">
                {message.eta === 0
                  ? "Your color will appear immediately!"
                  : message.eta < 60
                    ? `Estimated wait time: ${message.eta} second${message.eta !== 1 ? "s" : ""}`
                    : `Estimated wait time: ${Math.ceil(message.eta / 60)} minute${Math.ceil(message.eta / 60) !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorForm;
