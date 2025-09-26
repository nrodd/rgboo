import { useField } from 'formik';
import { RgbColorPicker } from 'react-colorful';

export const ColorInput = () => {
    const [, { value }, { setValue }] = useField('color');

    return <RgbColorPicker color={value} onChange={setValue} />
}