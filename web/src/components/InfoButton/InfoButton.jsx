import InfoIcon from '../../assets/info.svg?react';
import { useScreenSize } from '../../libs/useScreenSize';

const SM = '32';
const LG = '64';

export const InfoButton = () => {

    const { isMobile } = useScreenSize();

    return <div className={`info-icon ${isMobile ? 'left-6' : 'right-6'}`}>
        <InfoIcon viewBox="0 0 64 64" width={isMobile ? SM : LG} height={isMobile ? SM : LG} />
    </div>
}