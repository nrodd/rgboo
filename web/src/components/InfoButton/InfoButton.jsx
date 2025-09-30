import { useState } from 'react';
import InfoIcon from '../../assets/info.svg?react';
import { useScreenSize } from '../../libs/useScreenSize';

const SM = '32';
const LG = '48';

export const InfoButton = () => {
    const [showTooltip, setShowTooltip] = useState(false);
    const { isMobile } = useScreenSize();

    return (
        <div
            className="info-icon right-6"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <InfoIcon viewBox="0 0 64 64" width={isMobile ? SM : LG} height={isMobile ? SM : LG} />

            {/* Tooltip Popup */}
            {showTooltip && (
                <div className="absolute z-50 -left-64 top-0 w-64 p-4 bg-arcana-900/95 border border-pumpkin-400 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 ease-out">
                    <div className="text-bone text-sm leading-relaxed">
                        <h3 className="font-bold text-base mb-2">RGB Boo Project</h3>
                        <p className="mb-2">
                            This project controls a physical LED strip in real-time! When you submit a color, it gets added to a queue.
                        </p>
                        <p>
                            Your color will light up the pumpkin for a few seconds when it's your turn. Watch the stream to see your color come to life!
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};