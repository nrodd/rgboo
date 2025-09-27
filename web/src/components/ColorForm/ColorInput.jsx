import { useField } from 'formik';
import { RgbColorPicker } from 'react-colorful';

export const ColorInput = () => {
    const [, { value }, { setValue }] = useField('color');

    return <div className="color-input">
        <RgbColorPicker color={value} onChange={setValue} />
    </div>
}