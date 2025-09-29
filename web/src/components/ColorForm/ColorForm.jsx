import { Formik, Form, Field, ErrorMessage } from 'formik';
import { ColorInput } from './ColorInput';
import { colorFormSchema } from './colorForm.schema';

export const ColorForm = () => {

    const onSubmit = async (values) => {
        try {
            const response = await fetch('https://rgboo.com/api/color', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);
            const responseText = await response.text();
            console.log('Response body:', responseText);

            if (response.ok) {
                try {
                    const result = JSON.parse(responseText);
                    console.log('Color submitted successfully:', result);
                    // Add success feedback here if needed
                } catch (parseError) {
                    console.error('Failed to parse JSON response:', parseError);
                    console.log('Raw response:', responseText);
                }
            } else {
                console.error('Failed to submit color:', response.status, response.statusText);
                console.log('Error response body:', responseText);
            }
        } catch (error) {
            console.error('Error submitting color:', error);
            // Add error handling here if needed
        }
    };


    return <div className="px-6 md:mr-12 md:w-112">
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
                        <Field id='username' name='username' placeholder='Name' className="form-field pl-4 placeholder-bone" />
                        <ErrorMessage name='username' component="span" className="text-bone" />
                        <ColorInput />
                    </div>
                    <button type='submit' className="form-field form-button">Send</button>
                </div>
            </Form>
        </Formik>
    </div>
}