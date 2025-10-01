import { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import { ColorInput } from './ColorInput';
import { colorFormSchema } from './colorForm.schema';

const COOLDOWN_KEY = 'rgboo_cooldown_end';

export const ColorForm = () => {
    const [message, setMessage] = useState({ type: '', text: '', eta: null });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [cooldownTime, setCooldownTime] = useState(0);
    const [isOnCooldown, setIsOnCooldown] = useState(false);

    // Check for existing cooldown on component mount
    useEffect(() => {
        const savedCooldownEnd = localStorage.getItem(COOLDOWN_KEY);
        if (savedCooldownEnd) {
            const endTime = new Date(savedCooldownEnd);
            const now = new Date();
            const remainingTime = Math.max(0, Math.ceil((endTime - now) / 1000));

            if (remainingTime > 0) {
                setCooldownTime(remainingTime);
                setIsOnCooldown(true);
            } else {
                // Cooldown expired, clean up
                localStorage.removeItem(COOLDOWN_KEY);
            }
        }
    }, []);

    // Auto-hide popup after 7 seconds
    useEffect(() => {
        if (showPopup) {
            const timer = setTimeout(() => {
                setShowPopup(false);
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [showPopup]);

    // Cooldown timer effect
    useEffect(() => {
        let interval;
        if (isOnCooldown && cooldownTime > 0) {
            interval = setInterval(() => {
                setCooldownTime(prev => {
                    if (prev <= 1) {
                        setIsOnCooldown(false);
                        localStorage.removeItem(COOLDOWN_KEY); // Clean up when cooldown ends
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isOnCooldown, cooldownTime]);

    const onSubmit = async (values, { setSubmitting }) => {
        setIsSubmitting(true);
        setMessage({ type: '', text: '', eta: null }); // Clear previous messages

        try {
            const response = await fetch('https://rgboo.com/api/color', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            const responseData = await response.json();

            if (response.ok) {
                // Success - show success message with ETA and start cooldown
                setMessage({
                    type: 'success',
                    text: `Color submitted successfully! You are #${responseData.queue_position} in the queue.`,
                    eta: responseData.estimated_wait_seconds
                });
                setShowPopup(true);

                // Start 30-second cooldown
                const cooldownEndTime = new Date(Date.now() + 30 * 1000); // 30 seconds from now
                localStorage.setItem(COOLDOWN_KEY, cooldownEndTime.toISOString());
                setCooldownTime(30);
                setIsOnCooldown(true);

                console.log('Color submitted successfully:', responseData);
                console.log('Queue Position:', responseData.queue_position);
                console.log('Estimated Wait Seconds:', responseData.estimated_wait_seconds);
            } else {
                // Handle different error scenarios
                if (response.status === 400 && responseData.code === 'PROFANITY_DETECTED') {
                    // Profanity detected
                    setMessage({
                        type: 'error',
                        text: 'Username contains inappropriate language. Please choose a different username.',
                        eta: null
                    });
                    setShowPopup(true);
                } else {
                    // Generic error
                    const errorMessage = responseData.error || 'Failed to submit color request. Please try again.';
                    setMessage({
                        type: 'error',
                        text: errorMessage,
                        eta: null
                    });
                    setShowPopup(true);
                }

                console.error('Failed to submit color:', response.status, responseData);
            }
        } catch (error) {
            // Network or other errors
            setMessage({
                type: 'error',
                text: 'Unable to connect to server. Please check your connection and try again.',
                eta: null
            });
            setShowPopup(true);

            console.error('Error submitting color:', error);
        } finally {
            setIsSubmitting(false);
            setSubmitting(false);
        }
    };


    return <div className="sm:px-6 md:mr-12 md:w-112">
        <Formik initialValues={{
            username: '',
            color: {
                r: 114,
                g: 44,
                b: 199
            }
        }}
            onSubmit={onSubmit}
            validationSchema={colorFormSchema}
        >
            <Form>
                <div className="flex flex-col space-y-8">
                    <div className="flex flex-col space-y-4">
                        <Field id='username' name='username' placeholder='Name' className="text-sm sm:text-base form-field pl-4 py-2 placeholder-bone" />
                        <ErrorMessage name='username' component="span" className="text-bone" />
                        <ColorInput />
                    </div>
                    <button
                        type='submit'
                        className={`form-field form-button ${isOnCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isSubmitting || isOnCooldown}
                    >
                        {isSubmitting
                            ? 'Sending...'
                            : isOnCooldown
                                ? `Wait ${cooldownTime}s`
                                : 'Send'
                        }
                    </button>
                </div>
            </Form>
        </Formik>

        {/* Popup Notification */}
        {showPopup && message.text && (
            <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out transform ${showPopup ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
                }`}>
                <div className={`mx-4 mt-4 p-4 rounded-lg shadow-lg text-center ${message.type === 'success'
                    ? 'bg-green-900/90 border border-pumpkin-400 text-bone backdrop-blur-sm'
                    : 'bg-red-900/90 border border-pumpkin-400 text-bone backdrop-blur-sm'
                    }`}>
                    <p className="font-medium">{message.text}</p>
                    {message.type === 'success' && message.eta !== null && (
                        <p className="text-sm mt-2 opacity-90 text-bone">
                            {message.eta === 0
                                ? 'Your color will appear immediately!'
                                : message.eta < 60
                                    ? `Estimated wait time: ${message.eta} second${message.eta !== 1 ? 's' : ''}`
                                    : `Estimated wait time: ${Math.ceil(message.eta / 60)} minute${Math.ceil(message.eta / 60) !== 1 ? 's' : ''}`
                            }
                        </p>
                    )}
                </div>
            </div>
        )}
    </div>
}