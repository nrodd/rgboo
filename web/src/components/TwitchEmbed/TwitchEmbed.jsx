import { useEffect, useRef } from 'react';

export const TwitchEmbed = ({ channel = 'roddzillaaa', className = '' }) => {
    const embedRef = useRef(null);

    useEffect(() => {
        // Load Twitch Embed script if not already loaded
        if (!window.Twitch) {
            const script = document.createElement('script');
            script.src = 'https://embed.twitch.tv/embed/v1.js';
            script.async = true;
            script.onload = () => initializeEmbed();
            script.onerror = (error) => {
                console.error('Failed to load Twitch embed script:', error);
            };
            document.body.appendChild(script);
        } else {
            initializeEmbed();
        }

        function initializeEmbed() {
            try {
                if (embedRef.current && window.Twitch) {
                    // Clear any existing embed
                    embedRef.current.innerHTML = '';

                    new window.Twitch.Embed(embedRef.current, {
                        width: '100%',
                        height: '100%',
                        channel: channel,
                        layout: 'video',
                        autoplay: true, // Disable autoplay to avoid deprecated warnings
                        parent: [window.location.hostname],
                        // Use allowfullscreen for better compatibility
                        allowfullscreen: true
                    });
                }
            } catch (error) {
                console.error('Failed to initialize Twitch embed:', error);
            }
        }

        // Cleanup function
        return () => {
            if (embedRef.current) {
                embedRef.current.innerHTML = '';
            }
        };
    }, [channel]);

    return (
        <div className={`twitch-embed-container w-full ${className}`}>
            {/* Responsive container with 16:9 aspect ratio */}
            <div className="aspect-video w-full overflow-hidden rounded-lg">
                <div
                    ref={embedRef}
                    className="w-full h-full"
                    style={{
                        minHeight: '200px',
                        visibility: 'visible',
                        display: 'block'
                    }}
                />
            </div>
        </div>
    );
};