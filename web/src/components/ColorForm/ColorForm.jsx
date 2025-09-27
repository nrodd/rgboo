import { Formik, Form, Field, ErrorMessage } from 'formik';
import { ColorInput } from './ColorInput';
import { colorFormSchema } from './colorForm.schema';

export const ColorForm = () => {

    const onSubmit = (values) => {
        window.alert('we got values:\n' + JSON.stringify(values, null, 2));
    }

    return <div className="px-6">
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