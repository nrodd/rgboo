import { Formik, Form, Field, ErrorMessage } from 'formik';
import { ColorInput } from './ColorInput';
import { colorFormSchema } from './colorForm.schema';

export const ColorForm = () => {

    const onSubmit = (values) => {
        window.alert('we got values:\n' + JSON.stringify(values, null, 2));
    }

    return <div className="w-lg py-4 bg-violet-900 rounded-md">
        <h1>Send a color</h1>
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
                <div className="flex flex-col">
                    <label htmlFor='username'>Name</label>
                    <Field id='username' name='username' placeholder='Jaxe11ingt0n' className="border-2 border-rose-800 rounded-sm" />
                    <ErrorMessage name='username' />
                    <label htmlFor='color'>Color</label>
                    <ColorInput />
                    <button type='submit'>Submit</button>
                </div>
            </Form>
        </Formik>
    </div>
}