import { useEffect, useState } from "react";

const SM_BREAKPT = 768;

export const useScreenSize = () => {
    const [screenSize, setScreenSize] = useState({
        width: window.innerWidth ?? 0,
        height: window.innerHeight ?? 0
    });

    useEffect(() => {
        const handleResize = () => {
            setScreenSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        window.addEventListener('resize', handleResize);

        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = screenSize.width < SM_BREAKPT;

    return { ...screenSize, isMobile};
}